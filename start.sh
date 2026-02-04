#!/usr/bin/env bash

# BOB Studio 一键启动脚本（Ubuntu/Debian 友好）
# 目标：
# - 任意目录 clone 后，直接运行 ./start.sh 即可完成：更新代码 -> 安装 Node/npm -> 安装依赖 -> 构建 -> 创建/更新 systemd 自启动 -> 启动服务
# - 避免 systemd 递归调用（服务模式下不再创建/启动 service）

set -euo pipefail

MODE="${1:-}" # --as-service: 在 systemd 中运行（不安装/启动 service）

log() { echo -e "$*"; }
fail() { echo -e "❌ $*" >&2; exit 1; }

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_DIR="$SCRIPT_DIR"
SERVICE_NAME="${BOBSTUDIO_SERVICE_NAME:-bobstudio}"
LOG_DIR="/var/log/${SERVICE_NAME}"
OUTPUT_LOG="${LOG_DIR}/output.log"
ERROR_LOG="${LOG_DIR}/error.log"

# 让 node_modules/.bin 优先
export PATH="${PROJECT_DIR}/node_modules/.bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

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
  # 用 apt 安装基础依赖（仅 Ubuntu/Debian）
  ensure_root_for_system_tasks
  if ! ensure_cmd apt-get; then
    return 1
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends ca-certificates curl git
}

install_node_20_nodesource() {
  # 安装 Node.js 20（包含 npm）— 适配 Vite 6（需要 Node >= 18）
  ensure_root_for_system_tasks
  install_packages_apt >/dev/null
  # 若 node/npm 都存在，则无需安装
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
      log "⚠️ 未找到 env.example，跳过 .env 生成"
    fi
  fi
}

git_update_if_needed() {
  # 仅在存在 git 仓库时执行
  if [ ! -d "${PROJECT_DIR}/.git" ]; then
    log "ℹ️ 未检测到 .git，跳过代码更新"
    return 0
  fi
  if ! ensure_cmd git; then
    log "🔎 未检测到 git，开始安装..."
    install_packages_apt
  fi

  local branch="${BOBSTUDIO_BRANCH:-main}"
  local auto_update="${BOBSTUDIO_AUTO_UPDATE:-1}"
  if [ "$auto_update" != "1" ]; then
    log "ℹ️ 已禁用自动更新（BOBSTUDIO_AUTO_UPDATE=$auto_update），跳过 git 更新"
    return 0
  fi

  log "🔄 检查并同步最新代码（${branch}）..."
  git fetch origin "${branch}" --prune
  local local_sha remote_sha
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse "origin/${branch}")"

  if [ "$local_sha" != "$remote_sha" ]; then
    log "⬆️ 发现更新：${local_sha:0:7} -> ${remote_sha:0:7}，开始同步..."
    git reset --hard "origin/${branch}"
    git clean -fd
    export BOBSTUDIO_CODE_UPDATED="1"
  else
    log "✅ 代码已是最新（${local_sha:0:7}）"
    export BOBSTUDIO_CODE_UPDATED="0"
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
    log "📦 安装依赖..."
    # 优先使用 npm ci（更稳定、可复现）
    if [ -f "$lock_file" ]; then
      npm ci
      sha256sum "$lock_file" | awk '{print $1}' > "$last_sha_file"
    else
      npm install
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
  fi
  if [ "${BOBSTUDIO_CODE_UPDATED:-0}" = "1" ] || [ "${BOBSTUDIO_DEPS_UPDATED:-0}" = "1" ]; then
    need_build="1"
  fi
  if [ "${BOBSTUDIO_FORCE_BUILD:-0}" = "1" ]; then
    need_build="1"
  fi

  if [ "$need_build" = "1" ]; then
    log "🔨 构建前端..."
    if command -v stdbuf >/dev/null 2>&1; then
      npm run build 2>&1 | stdbuf -oL -eL tee /tmp/build.log
      BUILD_EXIT_CODE=${PIPESTATUS[0]}
    else
      npm run build
      BUILD_EXIT_CODE=$?
    fi

    if [ "${BUILD_EXIT_CODE}" -eq 0 ]; then
      log "✅ 前端构建完成"
    else
      log "❌ 构建失败，退出码: ${BUILD_EXIT_CODE}"
      log "📋 查看详细日志: cat /tmp/build.log 2>/dev/null || tail -50 ${OUTPUT_LOG}"
      exit "${BUILD_EXIT_CODE}"
    fi
  else
    log "✅ 前端构建已存在且无需更新（跳过构建）"
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
ExecStart=${PROJECT_DIR}/start.sh --as-service
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

  # service 模式下，不做 service 安装/启动（避免递归）
  if [ "$MODE" != "--as-service" ]; then
    git_update_if_needed
    ensure_dependencies
    build_frontend_if_needed
    install_or_update_systemd_service
    start_service_or_run_foreground
  else
    # 在 systemd 里运行：允许更新/装依赖/构建（默认开启，可用环境变量关闭）
    git_update_if_needed
    ensure_dependencies
    build_frontend_if_needed
    log "🚀 启动服务器..."
    export NODE_ENV=production
    exec npm run server
  fi
}

main "$@"

