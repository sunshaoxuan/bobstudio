#!/usr/bin/env bash

# BOB Studio 启动入口（Bootstrap）
# 目标：
# - start.sh 只负责“更新到最新代码”，然后立刻 exec 最新的 run.sh 执行启动
# - 这样无需跑第二遍，更新完成后会立刻使用最新版本逻辑

set -euo pipefail

MODE="${1:-}" # --as-service: 在 systemd 中运行（不更新代码）

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
# 注意：如果你现在是通过 `bash start.sh` 运行，本段会为下次 `./start.sh` 生效
ensure_script_exec_permissions() {
  local scripts=(
    "${PROJECT_DIR}/start.sh"
    "${PROJECT_DIR}/run.sh"
    "${PROJECT_DIR}/configure.sh"
    "${PROJECT_DIR}/deploy.sh"
    "${PROJECT_DIR}/check-build.sh"
  )

  local changed="0"
  for f in "${scripts[@]}"; do
    if [ -f "$f" ] && [ ! -x "$f" ]; then
      chmod +x "$f" 2>/dev/null || true
      if [ -x "$f" ]; then
        changed="1"
      fi
    fi
  done

  if [ "$changed" = "1" ]; then
    log_green "✅ 已自动补齐脚本执行权限（start.sh/configure.sh 等）"
    log_green "   - 之后可直接使用 ./start.sh 和 ./configure.sh"
  fi
}

ensure_script_exec_permissions

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

  # 默认策略：只做 fast-forward 更新，避免覆盖本地修改
  # 如确实需要“强制覆盖到远端最新”，可设置 BOBSTUDIO_GIT_FORCE_RESET=1
  local force_reset="${BOBSTUDIO_GIT_FORCE_RESET:-0}"

  git fetch origin "${branch}" --prune
  local local_sha remote_sha
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse "origin/${branch}")"

  if [ "$local_sha" != "$remote_sha" ]; then
    log "⬆️ 发现更新：${local_sha:0:7} -> ${remote_sha:0:7}，开始同步..."
    if [ "$force_reset" = "1" ]; then
      log_yellow "⚠️ 已启用强制更新（BOBSTUDIO_GIT_FORCE_RESET=1）：将覆盖本地跟踪文件改动"
      git reset --hard "origin/${branch}"
      # 注意：不执行 git clean，避免误删本地文件/目录（尤其是部署产生的文件）
    else
      # 若“被 Git 跟踪的文件”有改动，直接中止，避免覆盖
      # 说明：运行时产生的未跟踪文件（如 .bobstudio/）不应阻止更新
      if ! git diff --quiet || ! git diff --cached --quiet; then
        log_yellow "⚠️ 检测到本地（已跟踪文件）存在未提交改动，为避免覆盖，已跳过自动更新"
        log_yellow "   - 将继续使用当前版本启动（本次不更新代码）"
        log_yellow "   - 如确需强制覆盖远端最新，请执行："
        log_yellow "     BOBSTUDIO_GIT_FORCE_RESET=1 ./start.sh"
        export BOBSTUDIO_CODE_UPDATED="0"
        return 0
      fi
      # 只允许快进
      git merge --ff-only "origin/${branch}"
    fi
    export BOBSTUDIO_CODE_UPDATED="1"
  else
    log "✅ 代码已是最新（${local_sha:0:7}）"
    export BOBSTUDIO_CODE_UPDATED="0"
  fi
}

main() {
  # service 模式：不更新代码，直接执行 run.sh
  if [ "$MODE" = "--as-service" ]; then
    exec "${PROJECT_DIR}/run.sh" --as-service
  fi

  # 更新代码（如需要）
  git_update_if_needed

  # 立刻执行最新的 run.sh（避免更新后还要跑第二遍）
  exec "${PROJECT_DIR}/run.sh" "$@"
}

main "$@"

