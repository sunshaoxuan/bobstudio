#!/usr/bin/env bash
#
# BOB Studio 配置脚本（交互式）
# 用途：
# - 收集/生成必要配置（尤其是 Google Gemini API Key）
# - 自动写入/更新 .env
# - 自动创建/更新 users.json 中的超级管理员，并写入加密后的 apiKeyEncrypted
#
# 运行：
#   sudo ./configure.sh
#
# 之后再运行：
#   sudo ./start.sh

set -euo pipefail

log() { echo -e "$*"; }

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

ensure_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    fail "请使用 root 运行（例如：sudo ./configure.sh）"
  fi
}

ensure_cmd() { command -v "$1" >/dev/null 2>&1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"
cd "$PROJECT_DIR"

ENV_FILE="${PROJECT_DIR}/.env"
ENV_EXAMPLE="${PROJECT_DIR}/env.example"
USERS_FILE="${PROJECT_DIR}/users.json"

install_base_packages() {
  if ! ensure_cmd apt-get; then
    fail "当前脚本仅内置支持 Ubuntu/Debian（缺少 apt-get）。请手动安装 Node.js 18+ / npm 后重试。"
  fi
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y --no-install-recommends ca-certificates curl git openssl
}

install_node_20_if_needed() {
  if ensure_cmd node && ensure_cmd npm; then
    local major
    major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
    if [ "$major" -ge 18 ]; then
      return 0
    fi
    log_yellow "⚠️ 检测到 Node 版本过低（$(node -v)），将升级到 Node 20..."
  else
    log "🔎 未检测到 node/npm，准备安装 Node 20..."
  fi

  install_base_packages
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs

  ensure_cmd node || fail "Node 安装失败"
  ensure_cmd npm || fail "npm 安装失败"
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$ENV_EXAMPLE" ]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      log_green "✅ 已创建 ${ENV_FILE}（来源：env.example）"
    else
      touch "$ENV_FILE"
      log_yellow "⚠️ 未找到 env.example，已创建空的 ${ENV_FILE}"
    fi
  fi
}

get_existing_admin_info() {
  # 输出三行：
  # ADMIN_USERNAME=...
  # ADMIN_EMAIL=...
  # ADMIN_HAS_KEY=0/1
  # ADMIN_HAS_PASSWORD=0/1
  if [ ! -f "$USERS_FILE" ] || ! ensure_cmd node; then
    echo "ADMIN_USERNAME=admin"
    echo "ADMIN_EMAIL=sunsx@briconbric.com"
    echo "ADMIN_HAS_KEY=0"
    echo "ADMIN_HAS_PASSWORD=0"
    return 0
  fi

  node - <<'NODE' "$USERS_FILE"
const fs = require("fs");
const usersFile = process.argv[1];
let users = [];
try {
  users = JSON.parse(fs.readFileSync(usersFile, "utf8") || "[]");
  if (!Array.isArray(users)) users = [];
} catch {
  users = [];
}
const admin = users.find((u) => u && u.isSuperAdmin) || null;
const username = admin?.username ? String(admin.username) : "admin";
const email = admin?.email ? String(admin.email) : "sunsx@briconbric.com";
const hasKey = Boolean((admin?.apiKeyEncrypted || admin?.apiKey || "").toString().trim());
const hasPassword = Boolean((admin?.password || "").toString().trim());
process.stdout.write(`ADMIN_USERNAME=${username}\nADMIN_EMAIL=${email}\nADMIN_HAS_KEY=${hasKey ? 1 : 0}\nADMIN_HAS_PASSWORD=${hasPassword ? 1 : 0}\n`);
NODE
}

set_env_kv() {
  local key="$1"
  local value="$2"

  # 幂等写入：先删除所有同名配置行，再追加一行，避免多次运行产生重复配置
  # 注意：只处理形如 KEY=... 的行，不修改被注释掉的行
  sed -i -E "/^[[:space:]]*${key}[[:space:]]*=/d" "$ENV_FILE"
  printf "\n%s=%s\n" "$key" "$value" >> "$ENV_FILE"
}

get_env_value() {
  local key="$1"
  # grep 不匹配时返回非0，必须吞掉
  local raw
  raw="$({ grep -E "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" 2>/dev/null || true; } | tail -n 1 | sed -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//")"
  raw="${raw%\"}"; raw="${raw#\"}"
  raw="${raw%\'}"; raw="${raw#\'}"
  printf "%s" "$raw"
}

gen_secret() {
  if ensure_cmd openssl; then
    openssl rand -hex 32
  else
    # 兜底
    head -c 32 /dev/urandom | base64 | tr -d '\n' | head -c 64
  fi
}

prompt_value() {
  local prompt="$1"
  local default="${2:-}"
  local secret="${3:-0}" # 1=隐藏输入
  local out=""
  if [ "$secret" = "1" ]; then
    if [ -n "$default" ]; then
      read -r -s -p "${prompt}（回车保留默认）: " out
      echo ""
      if [ -z "$out" ]; then out="$default"; fi
    else
      read -r -s -p "${prompt}: " out
      echo ""
    fi
  else
    if [ -n "$default" ]; then
      read -r -p "${prompt}（默认：${default}）: " out
      if [ -z "$out" ]; then out="$default"; fi
    else
      read -r -p "${prompt}: " out
    fi
  fi
  printf "%s" "$out"
}

write_admin_user_and_key() {
  local admin_username="$1"
  local admin_email="$2"
  local admin_password="$3"
  local api_key="$4"
  local enc_secret="$5"

  # 用 node 生成 users.json（避免依赖 jq/python）
  USERS_FILE="$USERS_FILE" \
  ADMIN_USERNAME="$admin_username" \
  ADMIN_EMAIL="$admin_email" \
  ADMIN_PASSWORD="$admin_password" \
  GEMINI_API_KEY="$api_key" \
  API_KEY_ENCRYPTION_SECRET="$enc_secret" \
    node - <<'NODE'
const fs = require("fs");
const crypto = require("crypto");

const usersFile = process.env.USERS_FILE;
const adminUsername = (process.env.ADMIN_USERNAME || "").trim();
const adminEmail = (process.env.ADMIN_EMAIL || "").trim();
const adminPassword = (process.env.ADMIN_PASSWORD || "");
const apiKey = (process.env.GEMINI_API_KEY || "").trim();
const secret = process.env.API_KEY_ENCRYPTION_SECRET;

if (!usersFile || !secret) {
  console.error("missing required env vars for configure");
  process.exit(2);
}

const API_KEY_IV_LENGTH = 12;
const API_KEY_KEY = crypto.createHash("sha256").update(secret).digest();

function hashPassword(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

function encryptSensitiveValue(plainText = "") {
  if (!plainText) return "";
  const iv = crypto.randomBytes(API_KEY_IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", API_KEY_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

let users = [];
try {
  if (fs.existsSync(usersFile)) {
    const raw = fs.readFileSync(usersFile, "utf8");
    users = JSON.parse(raw || "[]");
    if (!Array.isArray(users)) users = [];
  }
} catch {
  users = [];
}

let admin = users.find((u) => u && u.isSuperAdmin);
if (!admin) {
  admin = {
    id: "super-admin-001",
    createdAt: new Date().toISOString(),
  };
  users.push(admin);
}

// 仅在提供了值时才更新，确保脚本可重复运行且不破坏已有配置
if (adminUsername) admin.username = adminUsername;
if (!admin.username) admin.username = "admin";

if (adminEmail) admin.email = adminEmail.toLowerCase();
if (!admin.email) admin.email = "sunsx@briconbric.com";

if (String(adminPassword || "").trim()) {
  admin.password = hashPassword(String(adminPassword));
}

admin.isActive = true;
admin.isSuperAdmin = true;
admin.showApiConfig = false;

if (apiKey) {
  admin.apiKeyEncrypted = encryptSensitiveValue(String(apiKey).trim());
  // 保持兼容：清理 legacy 明文字段
  delete admin.apiKey;
}

fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
NODE
}

main() {
  ensure_root
  install_node_20_if_needed
  ensure_env_file

  # 读取现有管理员信息（如存在）
  local existing_admin_username="admin"
  local existing_admin_email="sunsx@briconbric.com"
  local existing_admin_has_key="0"
  local existing_admin_has_password="0"
  while IFS='=' read -r k v; do
    case "$k" in
      ADMIN_USERNAME) existing_admin_username="$v" ;;
      ADMIN_EMAIL) existing_admin_email="$v" ;;
      ADMIN_HAS_KEY) existing_admin_has_key="$v" ;;
      ADMIN_HAS_PASSWORD) existing_admin_has_password="$v" ;;
    esac
  done < <(get_existing_admin_info)

  log ""
  log "### 配置 BOB Studio（将写入 .env 和 users.json）"
  log ""

  # 1) API_KEY_ENCRYPTION_SECRET
  local current_enc
  current_enc="$(get_env_value "API_KEY_ENCRYPTION_SECRET")"
  if [ -z "$current_enc" ] || [ "$current_enc" = "change-me-to-random-secret" ] || [ "$current_enc" = "change-me-bobstudio-secret" ]; then
    log_yellow "⚠️ 当前 ${ENV_FILE} 中 API_KEY_ENCRYPTION_SECRET 未设置或为默认值"
    local new_enc
    new_enc="$(prompt_value "请输入 API_KEY_ENCRYPTION_SECRET（留空则自动生成）" "" 1)"
    if [ -z "$new_enc" ]; then
      new_enc="$(gen_secret)"
      log_green "✅ 已自动生成 API_KEY_ENCRYPTION_SECRET"
    fi
    set_env_kv "API_KEY_ENCRYPTION_SECRET" "$new_enc"
    current_enc="$new_enc"
    log_green "✅ 已写入 ${ENV_FILE} -> API_KEY_ENCRYPTION_SECRET"
    # 写入后校验，避免出现“换行分裂/空值”导致 start.sh 读不到
    if [ -z "$(get_env_value "API_KEY_ENCRYPTION_SECRET")" ]; then
      log_red "❌ 写入失败：${ENV_FILE} 中 API_KEY_ENCRYPTION_SECRET 仍为空"
      log_red "   - 请检查 ${ENV_FILE} 中是否出现了换行分裂（如 KEY= 在一行、值在下一行）"
      exit 1
    fi
  else
    log_green "✅ 已检测到 API_KEY_ENCRYPTION_SECRET（长度: ${#current_enc}）"
  fi

  # 2) SESSION_SECRET（顺便补齐，避免用默认）
  local current_session
  current_session="$(get_env_value "SESSION_SECRET")"
  if [ -z "$current_session" ] || [ "$current_session" = "change-me-to-random-secret" ]; then
    local new_session
    new_session="$(gen_secret)"
    set_env_kv "SESSION_SECRET" "$new_session"
    log_green "✅ 已设置 SESSION_SECRET（自动生成）"
  fi

  # 3) Gemini API Key
  log ""
  log "请输入 Google Gemini API Key（将加密写入 users.json 的 apiKeyEncrypted）"
  local gemini_key=""
  if [ "$existing_admin_has_key" = "1" ]; then
    log_green "✅ 检测到超级管理员已配置 API Key（可直接回车跳过）"
    read -r -s -p "Gemini API Key（回车保留现有）: " gemini_key
    echo ""
    gemini_key="$(echo -n "$gemini_key" | tr -d '[:space:]')"
  else
    while true; do
      gemini_key="$(prompt_value "Gemini API Key" "" 1)"
      gemini_key="$(echo -n "$gemini_key" | tr -d '[:space:]')"
      if [ "${#gemini_key}" -ge 20 ]; then
        break
      fi
      log_yellow "⚠️ 看起来太短了，请重新输入"
    done
  fi

  # 4) 超级管理员信息（可选）
  log ""
  log "配置超级管理员账号（默认读取现有配置，可直接回车保留）"
  local admin_username admin_email admin_password
  admin_username="$(prompt_value "管理员用户名" "$existing_admin_username" 0)"
  admin_email="$(prompt_value "管理员邮箱" "$existing_admin_email" 0)"

  if [ "$existing_admin_has_password" = "1" ]; then
    read -r -s -p "管理员密码（留空保持不变）: " admin_password
    echo ""
  else
    admin_password="$(prompt_value "管理员密码（会写入 users.json，为 sha256 哈希）" "twgdh169" 1)"
  fi

  log ""
  log "📝 写入 users.json（或更新其中的超级管理员）..."
  write_admin_user_and_key "$admin_username" "$admin_email" "$admin_password" "$gemini_key" "$current_enc"

  # 基础权限收紧
  chmod 600 "$ENV_FILE" 2>/dev/null || true
  chmod 600 "$USERS_FILE" 2>/dev/null || true

  log_green "✅ 配置完成"
  log ""
  log "下一步：运行一键启动脚本"
  log "  sudo ./start.sh"
}

main "$@"

