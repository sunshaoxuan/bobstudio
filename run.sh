#!/usr/bin/env bash

# BOB Studio 执行脚本（由 start.sh 更新代码后调用）
# 说明：
# - run.sh 负责安装 Node/npm、安装依赖、构建、检查 API Key、创建/更新 systemd、启动服务
# - start.sh 只负责把代码更新到最新，然后 exec 最新的 run.sh（避免“更新后要跑第二遍”）

set -euo pipefail

MODE="${1:-}" # --as-service: 在 systemd 中运行

log() { echo -e "$*"; }

# 颜色输出（无论 stdout 是否为 TTY 都输出；如需关闭可设置 NO_COLOR=1）
if [ "${NO_COLOR:-0}" = "1" ]; then
  RED=""; YELLOW=""; GREEN=""; NC=""
else
  RED="\033[31m"
  YELLOW="\033[33m"
  GREEN="\033[32m"
  NC="\033[0m"
fi

log_red() { echo -e "${RED}$*${NC}"; }
log_yellow() { echo -e "${YELLOW}$*${NC}"; }
log_green() { echo -e "${GREEN}$*${NC}"; }

fail() { log_red "❌ $*"; exit 1; }

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_DIR="$SCRIPT_DIR"
SERVICE_NAME="${BOBSTUDIO_SERVICE_NAME:-bobstudio}"
LOG_DIR="/var/log/${SERVICE_NAME}"
OUTPUT_LOG="${LOG_DIR}/output.log"
ERROR_LOG="${LOG_DIR}/error.log"

# 确保脚本具备执行权限（有些环境 clone 后不会保留 +x）
ensure_script_exec_permissions() {
  local scripts=(
    "${PROJECT_DIR}/start.sh"
    "${PROJECT_DIR}/run.sh"
    "${PROJECT_DIR}/configure.sh"
    "${PROJECT_DIR}/deploy.sh"
    "${PROJECT_DIR}/check-build.sh"
  )

  for f in "${scripts[@]}"; do
    if [ -f "$f" ] && [ ! -x "$f" ]; then
      chmod +x "$f" 2>/dev/null || true
    fi
  done
}

ensure_script_exec_permissions

# 让 node_modules/.bin 优先
export PATH="${PROJECT_DIR}/node_modules/.bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

is_valid_env_key() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

load_env_file_exports() {
  # 从 .env 导出变量到当前进程环境（不依赖 systemd）
  local env_file="${PROJECT_DIR}/.env"
  if [ ! -f "$env_file" ]; then
    return 0
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" != *"="* ]] && continue

    local key="${line%%=*}"
    local val="${line#*=}"
    key="$(echo -n "$key" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
    val="$(echo -n "$val" | sed -E 's/^[[:space:]]+//')"

    if ! is_valid_env_key "$key"; then
      continue
    fi
    export "$key=$val"
  done < "$env_file"
}

get_env_value_from_file() {
  # 读取 .env 中某个 KEY 的值（兼容 KEY=\nVALUE）
  local key="$1"
  local file="$2"
  awk -v key="$key" '
    function trim(s) { sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); return s }
    function strip_cr(s) { sub(/\r$/, "", s); return s }
    BEGIN { want_next = 0 }
    { $0 = strip_cr($0) }
    /^[ \t]*#/ { next }
    /^[ \t]*$/ { next }
    {
      if (want_next == 1) {
        if ($0 !~ /^[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*=/) {
          print $0
        }
        exit
      }
    }
    {
      re = "^[ \t]*" key "[ \t]*="
      if ($0 ~ re) {
        line = $0
        sub(re, "", line)
        line = trim(line)
        if (line ~ /^"/) { sub(/^"/, "", line); sub(/"$/, "", line) }
        else if (line ~ /^\047/) { sub(/^\047/, "", line); sub(/\047$/, "", line) }
        if (length(line) > 0) { print line; exit }
        want_next = 1
      }
    }
  ' "$file"
}

ensure_root_for_system_tasks() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    fail "需要 root 权限以安装依赖/创建 systemd 服务。请用 root 执行（例如 sudo ./start.sh）。"
  fi
}

ensure_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1
}

ensure_log_dir() {
  ensure_root_for_system_tasks
  mkdir -p "$LOG_DIR"
  touch "$OUTPUT_LOG" "$ERROR_LOG"
}

install_packages_apt() {
  ensure_root_for_system_tasks
  if ! ensure_cmd apt-get; then
    return 1
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends ca-certificates curl git
}

install_node_20_nodesource() {
  ensure_root_for_system_tasks
  install_packages_apt >/dev/null
  if ensure_cmd node && ensure_cmd npm; then
    return 0
  fi
  log "📦 安装 Node.js 20（NodeSource）..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

ensure_node_and_npm() {
  if ensure_cmd node && ensure_cmd npm; then
    local major
    major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
    if [ "$major" -lt 18 ]; then
      log "⚠️ 当前 Node 版本过低（$(node -v)），升级到 Node 20..."
      install_node_20_nodesource
    fi
    return 0
  fi

  log "🔎 未检测到 node/npm，开始安装..."
  install_node_20_nodesource

  ensure_cmd node || fail "安装后仍找不到 node，请检查系统环境"
  ensure_cmd npm || fail "安装后仍找不到 npm，请检查系统环境"
}

ensure_env_file() {
  if [ ! -f "${PROJECT_DIR}/.env" ]; then
    log "📝 未找到 .env，自动从 env.example 生成..."
    if [ -f "${PROJECT_DIR}/env.example" ]; then
      cp "${PROJECT_DIR}/env.example" "${PROJECT_DIR}/.env"
      log "✅ 已创建 .env（请按需修改其中配置）"
    else
      log_yellow "⚠️ 未找到 env.example，跳过 .env 生成"
    fi
  fi
}

check_google_api_key_config() {
  local env_file="${PROJECT_DIR}/.env"
  local users_file="${PROJECT_DIR}/users.json"
  local has_issue="0"
  local missing_key="0"

  log ""
  log "🔎 检查 Google Gemini API Key 配置..."

  if [ -f "$env_file" ]; then
    local enc_secret=""
    enc_secret="$(get_env_value_from_file "API_KEY_ENCRYPTION_SECRET" "$env_file" || true)"
    if [ -z "$enc_secret" ]; then
      log_yellow "⚠️ 未在 ${env_file} 中检测到 API_KEY_ENCRYPTION_SECRET"
      log_yellow "   - 请维护: ${env_file} -> API_KEY_ENCRYPTION_SECRET（必须设置为随机强密钥）"
      has_issue="1"
    elif [ "$enc_secret" = "change-me-to-random-secret" ] || [ "$enc_secret" = "change-me-bobstudio-secret" ]; then
      log_yellow "⚠️ 检测到 API_KEY_ENCRYPTION_SECRET 仍为默认值（不安全，也可能导致迁移/解密问题）"
      log_yellow "   - 请维护: ${env_file} -> API_KEY_ENCRYPTION_SECRET（改为随机强密钥，并妥善保存）"
      has_issue="1"
    else
      log_green "✅ 已检测到 API_KEY_ENCRYPTION_SECRET（长度: ${#enc_secret}）"
      export API_KEY_ENCRYPTION_SECRET="$enc_secret"
    fi
  else
    log_yellow "⚠️ 未找到 ${env_file}"
    log_yellow "   - 请维护: 创建 ${env_file}，并配置 API_KEY_ENCRYPTION_SECRET（随机强密钥）"
    has_issue="1"
  fi

  if [ ! -f "$users_file" ]; then
    log_yellow "⚠️ 未找到 ${users_file}"
    log_yellow "   - 当前策略为“没有 API Key 不允许启动”"
    has_issue="1"
    missing_key="1"
  else
    if ensure_cmd node; then
      if node -e '
        const fs = require("fs");
        const p = process.argv[1];
        let users;
        try { users = JSON.parse(fs.readFileSync(p, "utf8")); } catch { process.exit(2); }
        const admin = Array.isArray(users) ? users.find(u => u && u.isSuperAdmin) : null;
        const v = admin ? (admin.apiKeyEncrypted || admin.apiKey || "") : "";
        const ok = typeof v === "string" ? v.trim().length > 0 : Boolean(v);
        process.exit(ok ? 0 : 1);
      ' "$users_file"; then
        log_green "✅ 已检测到 users.json 中存在已配置 API Key 的超级管理员"
      else
        local code="$?"
        if [ "$code" = "2" ]; then
          log_yellow "⚠️ 无法解析 ${users_file}（JSON 格式可能损坏）"
        else
          log_yellow "⚠️ 未检测到已配置 API Key 的超级管理员"
          missing_key="1"
        fi
        has_issue="1"
      fi
    else
      log_yellow "⚠️ 未检测到 node，无法解析 users.json 以检查 API Key"
      has_issue="1"
      missing_key="1"
    fi
  fi

  if [ "$has_issue" = "0" ]; then
    log_green "✅ 结论：已检测到可用的 Gemini API Key 配置"
  else
    log_red "❌ 结论：未检测到可用的 Google/Gemini API Key，已中止启动服务"
    log_red "   - 推荐先运行：sudo bash ${PROJECT_DIR}/configure.sh"
    if [ "$missing_key" = "1" ]; then
      log_red "   - 重点：当前缺少 API Key"
    fi
    exit 1
  fi
}

ensure_dependencies() {
  ensure_node_and_npm

  local cache_dir="${PROJECT_DIR}/.bobstudio"
  mkdir -p "$cache_dir"
  local lock_file="${PROJECT_DIR}/package-lock.json"
  local last_sha_file="${cache_dir}/last_package_lock_sha256"

  local need_install="0"
  if [ ! -d "${PROJECT_DIR}/node_modules" ]; then
    need_install="1"
  fi
  if [ -f "$lock_file" ]; then
    local current_sha=""
    current_sha="$(sha256sum "$lock_file" | awk '{print $1}')"
    local last_sha=""
    last_sha="$(cat "$last_sha_file" 2>/dev/null || true)"
    if [ "$current_sha" != "$last_sha" ]; then
      need_install="1"
    fi
  fi

  if [ "${BOBSTUDIO_FORCE_NPM_INSTALL:-0}" = "1" ]; then
    need_install="1"
  fi

  if [ "$need_install" = "1" ]; then
    log "📦 安装依赖（包括 devDependencies，构建前端需要 vite）..."
    # 临时取消 NODE_ENV，确保安装 devDependencies
    local old_node_env="${NODE_ENV:-}"
    unset NODE_ENV
    if [ -f "$lock_file" ]; then
      npm ci
      sha256sum "$lock_file" | awk '{print $1}' > "$last_sha_file"
    else
      npm install
    fi
    # 恢复 NODE_ENV（如果之前设置了）
    if [ -n "$old_node_env" ]; then
      export NODE_ENV="$old_node_env"
    fi
    export BOBSTUDIO_DEPS_UPDATED="1"
  else
    log "✅ 依赖已是最新（跳过安装）"
    export BOBSTUDIO_DEPS_UPDATED="0"
  fi
}

build_frontend_if_needed() {
  ensure_node_and_npm
  local need_build="0"

  if [ ! -d "${PROJECT_DIR}/build" ]; then
    need_build="1"
    log "🔨 build 目录不存在，需要构建"
  fi
  
  # 如果代码已更新，必须重新构建
  if [ "${BOBSTUDIO_CODE_UPDATED:-0}" = "1" ]; then
    need_build="1"
    log "🔨 检测到代码已更新，需要重新构建"
  fi
  
  if [ "${BOBSTUDIO_DEPS_UPDATED:-0}" = "1" ]; then
    need_build="1"
    log "🔨 检测到依赖已更新，需要重新构建"
  fi
  
  if [ "${BOBSTUDIO_FORCE_BUILD:-0}" = "1" ]; then
    need_build="1"
    log "🔨 强制构建模式已启用"
  fi

  # 检查源代码文件是否比构建文件新（时间戳比较）
  # 即使代码没有通过 git 更新，如果源代码文件比构建文件新，也应该重新构建
  if [ "$need_build" = "0" ] && [ -d "${PROJECT_DIR}/build" ]; then
    local build_index="${PROJECT_DIR}/build/index.html"
    if [ -f "$build_index" ]; then
      local src_newer="0"
      # 检查主要源代码文件和配置文件
      for src_file in \
        "${PROJECT_DIR}/src/components/Studio.js" \
        "${PROJECT_DIR}/src/components/Admin/AdminDashboard.js" \
        "${PROJECT_DIR}/package.json" \
        "${PROJECT_DIR}/vite.config.js" \
        "${PROJECT_DIR}/src/index.jsx"; do
        if [ -f "$src_file" ] && [ "$src_file" -nt "$build_index" ] 2>/dev/null; then
          src_newer="1"
          log "🔨 检测到源代码文件比构建文件新: $(basename "$src_file")"
          break
        fi
      done
      if [ "$src_newer" = "1" ]; then
        need_build="1"
      fi
    fi
  fi

  if [ "$need_build" = "1" ]; then
    # 构建前确认 vite 可执行文件存在（vite 在 devDependencies 中）
    # 即使 ensure_dependencies 显示已是最新，也可能缺少 devDependencies
    local vite_bin="${PROJECT_DIR}/node_modules/.bin/vite"
    # 使用更可靠的检查方式：检查文件是否存在（包括符号链接）且可执行
    local vite_exists="0"
    if [ -e "$vite_bin" ] && [ -x "$vite_bin" ]; then
      vite_exists="1"
    elif command -v vite >/dev/null 2>&1; then
      # 如果 vite 在 PATH 中也可以
      vite_exists="1"
    fi
    
    if [ "$vite_exists" = "0" ]; then
      log_yellow "⚠️ 未找到 vite 可执行文件（可能在 NODE_ENV=production 下安装过）"
      log_yellow "   强制重新安装依赖（包括 devDependencies）..."
      # 临时取消 NODE_ENV，确保安装 devDependencies
      local old_node_env="${NODE_ENV:-}"
      unset NODE_ENV
      # 使用 npm install 而不是 npm ci，因为 npm install 只会补充缺失的包，更快
      # npm install 默认会安装所有依赖（包括 devDependencies），只要 NODE_ENV 不是 production
      if [ -f "${PROJECT_DIR}/package-lock.json" ]; then
        # npm ci 会删除整个 node_modules 并重新安装，但能确保一致性
        log "   执行: npm ci（这将重新安装所有依赖）..."
        npm ci
      else
        log "   执行: npm install（这将补充缺失的依赖）..."
        npm install
      fi
      # 恢复 NODE_ENV（如果之前设置了）
      if [ -n "$old_node_env" ]; then
        export NODE_ENV="$old_node_env"
      fi
      # 安装后再次检查
      vite_exists="0"
      if [ -e "$vite_bin" ] && [ -x "$vite_bin" ]; then
        vite_exists="1"
      elif command -v vite >/dev/null 2>&1; then
        vite_exists="1"
      fi
      if [ "$vite_exists" = "0" ]; then
        log_red "❌ 安装依赖后仍未找到 vite，构建无法继续"
        log_red "   请检查: ls -la ${PROJECT_DIR}/node_modules/.bin/vite"
        log_red "   或手动执行: cd ${PROJECT_DIR} && unset NODE_ENV && npm install"
        exit 1
      fi
      log_green "✅ vite 已安装"
    fi
    
    log "🔨 开始构建前端..."
    # 使用 node 直接调用 vite.js，避免 npm run 在子 shell 中找不到 vite 命令的问题
    local vite_js="${PROJECT_DIR}/node_modules/vite/bin/vite.js"
    if [ -f "$vite_js" ]; then
      if command -v stdbuf >/dev/null 2>&1; then
        node "$vite_js" build 2>&1 | stdbuf -oL -eL tee /tmp/build.log
        BUILD_EXIT_CODE=${PIPESTATUS[0]}
      else
        node "$vite_js" build
        BUILD_EXIT_CODE=$?
      fi
    else
      # 回退到 npm run build
      if command -v stdbuf >/dev/null 2>&1; then
        npm run build 2>&1 | stdbuf -oL -eL tee /tmp/build.log
        BUILD_EXIT_CODE=${PIPESTATUS[0]}
      else
        npm run build
        BUILD_EXIT_CODE=$?
      fi
    fi

    if [ "${BUILD_EXIT_CODE}" -eq 0 ]; then
      log_green "✅ 前端构建完成"
    else
      log_red "❌ 构建失败，退出码: ${BUILD_EXIT_CODE}"
      log "📋 查看详细日志: cat /tmp/build.log 2>/dev/null || tail -50 ${OUTPUT_LOG}"
      exit "${BUILD_EXIT_CODE}"
    fi
  else
    log_green "✅ 前端构建已存在且无需更新（跳过构建）"
  fi
}

install_or_update_systemd_service() {
  ensure_root_for_system_tasks
  if ! ensure_cmd systemctl; then
    log "ℹ️ 未检测到 systemd（systemctl 不存在），跳过自启动服务创建"
    return 0
  fi

  local service_path="/etc/systemd/system/${SERVICE_NAME}.service"
  log "🧩 创建/更新 systemd 服务: ${service_path}"

  cat > "$service_path" <<EOF
[Unit]
Description=BOB Studio Node.js Application
Documentation=https://github.com/sunshaoxuan/bobstudio
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${PROJECT_DIR}
Environment=NODE_ENV=production
ExecStart=${PROJECT_DIR}/run.sh --as-service
Restart=on-failure
RestartSec=10
StandardOutput=append:${OUTPUT_LOG}
StandardError=append:${ERROR_LOG}
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "${SERVICE_NAME}" >/dev/null
}

start_service_or_run_foreground() {
  if ensure_cmd systemctl; then
    log "🚀 启动服务（systemd）..."
    systemctl restart "${SERVICE_NAME}"
    systemctl --no-pager --full status "${SERVICE_NAME}" || true
    log "📋 日志（最后 50 行）: ${OUTPUT_LOG}"
    tail -n 50 "${OUTPUT_LOG}" || true
    return 0
  fi

  log "🚀 启动服务器（前台）..."
  export NODE_ENV=production
  exec npm run server
}

main() {
  ensure_env_file
  ensure_log_dir
  load_env_file_exports

  # 由 start.sh 负责更新代码；这里确保变量存在
  export BOBSTUDIO_CODE_UPDATED="${BOBSTUDIO_CODE_UPDATED:-0}"

  ensure_dependencies
  build_frontend_if_needed
  check_google_api_key_config

  if [ "$MODE" != "--as-service" ]; then
    install_or_update_systemd_service
    start_service_or_run_foreground
  else
    log "🚀 启动服务器..."
    export NODE_ENV=production
    exec npm run server
  fi
}

main "$@"

