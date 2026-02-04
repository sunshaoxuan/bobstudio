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

backup_and_normalize_env_file() {
  # 规范化 .env：
  # - 修复 KEY= 在一行、值跑到下一行的情况（合并为 KEY=value）
  # - 对无法识别的“孤立行”（没有等号）进行注释，避免影响读取
  # - 保留注释与空行
  #
  # 说明：只要检测到存在“孤立行”或“KEY= 空值 + 下一行值”的情况，才会写回并生成备份
  local file="$ENV_FILE"
  [ -f "$file" ] || return 0

  local tmp
  tmp="$(mktemp)"
  local changed="0"

  awk '
    function strip_cr(s) { sub(/\r$/, "", s); return s }
    function is_key_line(s) { return (s ~ /^[ \t]*[A-Za-z_][A-Za-z0-9_]*[ \t]*=/) }
    function trim(s) { sub(/^[ \t]+/, "", s); sub(/[ \t]+$/, "", s); return s }
    BEGIN { pending_key = ""; empty_count = 0 }
    {
      line = strip_cr($0)
    }
    # 空行处理：最多保留一个连续空行
    /^[ \t]*$/ {
      empty_count++
      if (empty_count == 1) {
        print line
      }
      next
    }
    # 非空行：重置空行计数
    {
      empty_count = 0
    }
    # 注释原样保留
    /^[ \t]*#/ { print line; next }
    {
      if (pending_key != "") {
        # pending_key 表示上一行是 KEY= 且值为空，尝试把当前行作为值合并
        if (!is_key_line(line)) {
          print pending_key "=" line
          pending_key = ""
          next
        } else {
          # 下一行已经是另一个 KEY=，则把 pending_key 原样写回空值
          print pending_key "="
          pending_key = ""
          # 继续处理当前行
        }
      }
    }
    {
      if (is_key_line(line)) {
        # 规范化成 KEY=value（去掉 key 周围空白）
        key = line
        sub(/=.*/, "", key)
        key = trim(key)
        val = line
        sub(/^[^=]*=/, "", val)
        val = trim(val)
        if (val == "") {
          pending_key = key
          next
        }
        print key "=" val
        next
      }
    }
    # 其它无等号的孤立行：注释掉
    { print "# ORPHAN_LINE: " line }
  ' "$file" > "$tmp"

  # 清理文件末尾的多余空行：删除末尾所有空行
  # 使用 awk 找到最后一个非空行，然后只输出到那里
  awk '
    {lines[NR]=$0; if (NF || /^[[:space:]]*#/) last_non_empty=NR}
    END {
      for (i=1; i<=last_non_empty; i++) print lines[i]
      if (last_non_empty > 0) print ""
    }
  ' "$tmp" > "${tmp}.clean" && mv "${tmp}.clean" "$tmp"
  
  # 判断是否真的发生变化（通过是否产生 ORPHAN_LINE 或 pending_key 合并）
  if grep -q "^# ORPHAN_LINE:" "$tmp" 2>/dev/null; then
    changed="1"
  fi
  # 若原文件存在 KEY= 空值且下一行是值，这次会被合并，文件内容会变化；用 diff 判断
  if ! diff -q "$file" "$tmp" >/dev/null 2>&1; then
    changed="1"
  fi

  # 如果内容有变化，或者强制清理模式，都写回文件
  local force_clean="${1:-0}"
  if [ "$changed" = "1" ] || [ "$force_clean" = "1" ]; then
    local ts
    ts="$(date +%Y%m%d-%H%M%S)"
    if [ "$changed" = "1" ]; then
      cp "$file" "${file}.bak.${ts}"
      log_green "✅ 已规范化 ${file}（并备份为 ${file}.bak.${ts}）"
    else
      log "🧹 清理 ${file} 格式..."
    fi
    mv "$tmp" "$file"
  else
    rm -f "$tmp"
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

  USERS_FILE_PATH="$USERS_FILE" node <<'NODE'
const fs = require("fs");
const usersFile = process.env.USERS_FILE_PATH;
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

get_admin_state_summary() {
  # 输出管理员状态摘要（不输出敏感明文）
  # ADMIN_PASSWORD_HASH_PREFIX=xxxxxxxx
  # ADMIN_HAS_KEY=0/1
  # ADMIN_APIKEY_ENCRYPTED_LEN=123
  # ADMIN_LOCKED=0/1
  if [ ! -f "$USERS_FILE" ] || ! ensure_cmd node; then
    echo "ADMIN_PASSWORD_HASH_PREFIX="
    echo "ADMIN_HAS_KEY=0"
    echo "ADMIN_APIKEY_ENCRYPTED_LEN=0"
    echo "ADMIN_LOCKED=0"
    return 0
  fi
  USERS_FILE_PATH="$USERS_FILE" node <<'NODE'
const fs = require("fs");
const usersFile = process.env.USERS_FILE_PATH;
let users = [];
try {
  users = JSON.parse(fs.readFileSync(usersFile, "utf8") || "[]");
  if (!Array.isArray(users)) users = [];
} catch (e) {
  console.error("ERROR reading users.json:", e.message);
  users = [];
}
const admin = users.find((u) => u && u.isSuperAdmin) || null;
const pw = (admin?.password || "").toString();
const pwPrefix = pw ? pw.slice(0, 8) : "";
const enc = (admin?.apiKeyEncrypted || admin?.apiKey || "").toString();
const hasKey = Boolean(enc.trim());
const encLen = enc ? enc.length : 0;
const locked = Boolean(admin?.lockedUntil && new Date(admin.lockedUntil) > new Date());
console.log("ADMIN_PASSWORD_HASH_PREFIX=" + pwPrefix);
console.log("ADMIN_HAS_KEY=" + (hasKey ? 1 : 0));
console.log("ADMIN_APIKEY_ENCRYPTED_LEN=" + encLen);
console.log("ADMIN_LOCKED=" + (locked ? 1 : 0));
NODE
}

set_env_kv() {
  local key="$1"
  local value="$2"

  # 幂等写入：先删除所有同名配置行和相关的孤立行注释，再追加一行
  # 使用临时文件处理，可以更精确地删除紧跟在 KEY= 行后面的孤立行
  local tmp_file
  tmp_file="$(mktemp)"
  local skip_orphans=0
  
  while IFS= read -r line || [ -n "$line" ]; do
    # 检查是否是匹配的 KEY= 行
    if [[ "$line" =~ ^[[:space:]]*${key}[[:space:]]*= ]]; then
      skip_orphans=1
      continue
    fi
    
    # 如果正在跳过孤立行，检查当前行
    if [ "$skip_orphans" = "1" ]; then
      # 如果是 ORPHAN_LINE 注释，跳过
      if [[ "$line" =~ ^[[:space:]]*#.*ORPHAN_LINE ]]; then
        continue
      fi
      # 如果是空行，停止跳过
      if [[ -z "$line" || "$line" =~ ^[[:space:]]*$ ]]; then
        skip_orphans=0
        printf '\n' >> "$tmp_file"
        continue
      fi
      # 如果是另一个 KEY= 行，停止跳过
      if [[ "$line" =~ ^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*[[:space:]]*= ]]; then
        skip_orphans=0
      else
        # 其他情况继续跳过（可能是孤立的值行）
        continue
      fi
    fi
    
    # 输出这一行
    printf '%s\n' "$line" >> "$tmp_file"
  done < "$ENV_FILE"
  
  # 追加新值：检查文件末尾是否有空行，避免重复添加
  local last_char=""
  if [ -s "$tmp_file" ]; then
    last_char="$(tail -c 1 "$tmp_file" 2>/dev/null || echo "")"
  fi
  # 如果文件不为空且最后不是换行，添加换行
  if [ -s "$tmp_file" ] && [ "$last_char" != "" ] && [ "$last_char" != $'\n' ]; then
    printf '\n' >> "$tmp_file"
  fi
  # 追加新键值对
  printf "%s=%s\n" "$key" "$value" >> "$tmp_file"
  
  # 替换原文件
  mv "$tmp_file" "$ENV_FILE"
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
      read -r -s -p "${prompt}（回车保留默认）: " out </dev/tty
      echo "" >/dev/tty
      if [ -z "$out" ]; then out="$default"; fi
    else
      read -r -s -p "${prompt}: " out </dev/tty
      echo "" >/dev/tty
    fi
  else
    if [ -n "$default" ]; then
      read -r -p "${prompt}（默认：${default}）: " out </dev/tty
      if [ -z "$out" ]; then out="$default"; fi
    else
      read -r -p "${prompt}: " out </dev/tty
    fi
  fi
  printf "%s" "$out"
}

mask_tail() {
  # 输出末尾 n 位（默认 6），过短则输出全部
  local s="$1"
  local n="${2:-6}"
  local len="${#s}"
  if [ "$len" -le "$n" ]; then
    printf "%s" "$s"
  else
    printf "%s" "${s:len-n:n}"
  fi
}

prompt_secret_with_confirm() {
  # 明文输入（便于粘贴/校对），回车后清屏并给出“长度 + 末尾几位”用于确认
  # 说明：用户希望可见输入、回车后再清除，避免输错又无法确认
  # 参数：
  #   $1: prompt
  #   $2: allow_empty (0/1)
  #   $3: min_len (0 表示不限制)
  local prompt="$1"
  local allow_empty="${2:-0}"
  local min_len="${3:-0}"
  local out="" ans=""
  local require_confirm="${BOBSTUDIO_CONFIRM_SECRET_INPUT:-0}"

  while true; do
    # 从 tty 读取，避免 stdin 缓冲/重定向导致的异常
    read -r -p "${prompt}: " out </dev/tty
    echo "" >/dev/tty

    # 尝试清除刚才那一行输入（尽量不把敏感信息留在屏幕上）
    if [ -t 1 ] && [ "${NO_COLOR:-0}" != "1" ]; then
      # 上移一行并清除该行
      printf "\033[1A\r\033[2K" >/dev/tty
    fi

    # 去掉首尾空白（避免误输入空格）
    out="$(echo -n "$out" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
    # 去掉不可见控制字符（兼容某些终端的粘贴控制码）
    out="$(printf "%s" "$out" | tr -d '\000-\037\177')"

    if [ -z "$out" ] && [ "$allow_empty" = "1" ]; then
      log_green "✅ 已选择保留现有值（未修改）" >&2
      printf "%s" ""
      return 0
    fi

    if [ "$min_len" -gt 0 ] && [ "${#out}" -lt "$min_len" ]; then
      log_yellow "⚠️ 输入长度看起来太短（${#out} < ${min_len}），请重新输入" >&2
      continue
    fi

    # 默认不需要二次回车确认：输入后直接继续，但会输出摘要供核对
    # 如确需二次确认，可设置 BOBSTUDIO_CONFIRM_SECRET_INPUT=1
    # 注意：日志输出到 stderr，避免被命令替换捕获
    echo "已输入（长度: ${#out}，末尾: $(mask_tail "$out" 6)）" >&2
    if [ "$require_confirm" != "1" ]; then
      printf "%s" "$out"
      return 0
    fi

    echo "确认使用？直接回车确认，输入 r 重输" >&2
    read -r ans </dev/tty
    if [ -z "$ans" ] || [[ "$ans" =~ ^[Yy]$ ]]; then
      printf "%s" "$out"
      return 0
    fi
    log_yellow "重新输入..." >&2
  done
}

prompt_password_twice() {
  # 密码输入两次确认（不回显，不展示摘要）
  # 参数：
  #   $1: prompt
  #   $2: allow_empty (0/1) 允许留空表示“不修改/保留”
  local prompt="$1"
  local allow_empty="${2:-0}"
  local p1="" p2=""
  while true; do
    read -r -s -p "${prompt}: " p1 </dev/tty
    echo "" >/dev/tty
    if [ -z "$p1" ] && [ "$allow_empty" = "1" ]; then
      printf "%s" ""
      return 0
    fi
    if [ -z "$p1" ] && [ "$allow_empty" != "1" ]; then
      log_yellow "⚠️ 密码不能为空，请重新输入"
      continue
    fi
    read -r -s -p "请再次输入以确认: " p2 </dev/tty
    echo "" >/dev/tty
    if [ "$p1" != "$p2" ]; then
      log_yellow "⚠️ 两次输入不一致，请重试"
      continue
    fi
    printf "%s" "$p1"
    return 0
  done
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

// 防呆：清除登录锁定/重置令牌，避免改完密码仍无法登录
admin.loginAttempts = 0;
admin.lockedUntil = null;
delete admin.resetToken;
delete admin.resetTokenExpiresAt;

if (apiKey) {
  admin.apiKeyEncrypted = encryptSensitiveValue(String(apiKey).trim());
  // 保持兼容：清理 legacy 明文字段
  delete admin.apiKey;
}

fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), "utf8");
NODE
}

assert_admin_written() {
  # 写入后强校验（不输出敏感明文）
  # 参数：
  #   $1 require_password: 0/1
  #   $2 require_key: 0/1
  local require_password="${1:-0}"
  local require_key="${2:-0}"

  if ! ensure_cmd node; then
    log_red "❌ 校验失败：未检测到 node，无法验证 users.json 写入结果"
    exit 1
  fi
  if [ ! -f "$USERS_FILE" ]; then
    log_red "❌ 校验失败：未找到 ${USERS_FILE}"
    exit 1
  fi

  # 输出一行 JSON 摘要，便于肉眼检查
  local summary_json=""
  summary_json="$(node -e '
    const fs=require("fs");
    const usersFile=process.argv[1];
    let users=[];
    try{ users=JSON.parse(fs.readFileSync(usersFile,"utf8")||"[]"); if(!Array.isArray(users)) users=[]; }catch{ users=[]; }
    const a=users.find(u=>u && u.isSuperAdmin) || null;
    const password=(a?.password||"").toString();
    const apiEnc=(a?.apiKeyEncrypted||a?.apiKey||"").toString();
    const out={
      hasSuperAdmin: Boolean(a),
      username: a?.username || "",
      email: a?.email || "",
      passwordHashPrefix: password ? password.slice(0,8) : "",
      apiKeyEncryptedLen: apiEnc ? apiEnc.length : 0,
      lockedUntil: a?.lockedUntil || null,
      loginAttempts: a?.loginAttempts ?? null,
    };
    console.log(JSON.stringify(out));
  ' "$USERS_FILE" 2>/dev/null || true)"

  log "校验摘要: ${summary_json}"

  # 机器判断
  node -e '
    const fs=require("fs");
    const usersFile=process.argv[1];
    const requirePassword=process.argv[2]==="1";
    const requireKey=process.argv[3]==="1";
    let users=[];
    try{ users=JSON.parse(fs.readFileSync(usersFile,"utf8")||"[]"); if(!Array.isArray(users)) users=[]; }catch{ users=[]; }
    const a=users.find(u=>u && u.isSuperAdmin) || null;
    if(!a) process.exit(10);
    const password=(a.password||"").toString().trim();
    const apiEnc=(a.apiKeyEncrypted||a.apiKey||"").toString().trim();
    if(requirePassword && !password) process.exit(11);
    if(requireKey && !apiEnc) process.exit(12);
    process.exit(0);
  ' "$USERS_FILE" "$require_password" "$require_key"

  local code="$?"
  if [ "$code" -eq 0 ]; then
    log_green "✅ 校验通过：users.json 已正确写入"
    return 0
  fi
  case "$code" in
    10) log_red "❌ 校验失败：users.json 中未找到超级管理员（isSuperAdmin=true）" ;;
    11) log_red "❌ 校验失败：管理员密码未写入（password 为空）" ;;
    12) log_red "❌ 校验失败：Gemini API Key 未写入（apiKeyEncrypted/apiKey 为空）" ;;
    *)  log_red "❌ 校验失败：未知错误码 ${code}" ;;
  esac
  log_red "请把上面的“校验摘要”那一行发我，我可以进一步定位。"
  exit 1
}

# 邮箱提供商预设
get_email_preset() {
  local provider="$1"
  local field="$2"
  case "${provider}_${field}" in
    gmail_host) echo "smtp.gmail.com" ;;
    gmail_port) echo "587" ;;
    gmail_secure) echo "false" ;;
    outlook_host) echo "smtp.office365.com" ;;
    outlook_port) echo "587" ;;
    outlook_secure) echo "false" ;;
    qq_host) echo "smtp.qq.com" ;;
    qq_port) echo "587" ;;
    qq_secure) echo "false" ;;
    netease163_host) echo "smtp.163.com" ;;
    netease163_port) echo "465" ;;
    netease163_secure) echo "true" ;;
    *) echo "" ;;
  esac
}

configure_email_provider() {
  log ""
  log "### 配置邮件服务（用于密码重置等功能）"
  log ""
  log "选择邮件服务提供商："
  log "  1) Gmail（需要应用专用密码）"
  log "  2) Outlook / Office 365"
  log "  3) QQ 邮箱（需要授权码）"
  log "  4) 网易 163 邮箱（需要授权码）"
  log "  5) 自定义 SMTP"
  log "  6) 跳过（不配置邮件服务）"
  log ""
  local choice=""
  read -r -p "请选择 [1-6，默认 6]: " choice </dev/tty
  choice="${choice:-6}"
  local provider=""
  case "$choice" in
    1) provider="gmail" ;;
    2) provider="outlook" ;;
    3) provider="qq" ;;
    4) provider="netease163" ;;
    5) provider="custom" ;;
    *) provider="skip" ;;
  esac
  if [ "$provider" = "skip" ]; then
    set_env_kv "REACT_APP_EMAIL_ENABLED" "false"
    log_yellow "⚠️ 已跳过邮件配置（密码重置功能将不可用）"
    return 0
  fi
  set_env_kv "REACT_APP_EMAIL_PROVIDER" "$provider"
  if [ "$provider" != "custom" ]; then
    set_env_kv "REACT_APP_SMTP_HOST" "$(get_email_preset "$provider" host)"
    set_env_kv "REACT_APP_SMTP_PORT" "$(get_email_preset "$provider" port)"
    set_env_kv "REACT_APP_SMTP_SECURE" "$(get_email_preset "$provider" secure)"
    log_green "✅ 已选择 $provider"
  else
    local smtp_host="" smtp_port="" smtp_secure=""
    read -r -p "SMTP 服务器地址: " smtp_host </dev/tty
    read -r -p "SMTP 端口 [587]: " smtp_port </dev/tty
    smtp_port="${smtp_port:-587}"
    read -r -p "使用 SSL/TLS [y/N]: " smtp_secure </dev/tty
    [[ "$smtp_secure" =~ ^[Yy]$ ]] && smtp_secure="true" || smtp_secure="false"
    set_env_kv "REACT_APP_SMTP_HOST" "$smtp_host"
    set_env_kv "REACT_APP_SMTP_PORT" "$smtp_port"
    set_env_kv "REACT_APP_SMTP_SECURE" "$smtp_secure"
    log_green "✅ 已配置自定义 SMTP"
  fi
  set_env_kv "REACT_APP_EMAIL_ENABLED" "true"
  local email_user="" email_pass="" email_from_name=""
  read -r -p "邮箱账户（发件地址）: " email_user </dev/tty
  set_env_kv "REACT_APP_EMAIL_USER" "$email_user"
  set_env_kv "REACT_APP_EMAIL_FROM" "$email_user"
  email_pass="$(prompt_secret_with_confirm "邮箱密码/授权码" 0 1)"
  set_env_kv "REACT_APP_EMAIL_PASS" "$email_pass"
  read -r -p "发件人显示名称 [BOB Studio]: " email_from_name </dev/tty
  email_from_name="${email_from_name:-BOB Studio}"
  set_env_kv "REACT_APP_EMAIL_FROM_NAME" "$email_from_name"
  log_green "✅ 邮件服务配置完成"
}

configure_ai_models() {
  log ""
  log "### 配置 AI 模型"
  local current_text="" current_image=""
  current_text="$(get_env_value "GEMINI_TEXT_MODEL")"
  current_image="$(get_env_value "GEMINI_IMAGE_MODEL")"
  if [ -n "$current_text" ] && [ -n "$current_image" ]; then
    log_green "✅ 已检测到 AI 模型配置"
    log "   - 文本模型: $current_text"
    log "   - 图像模型: $current_image"
    local change=""
    read -r -p "是否要修改？[y/N]: " change </dev/tty
    [[ ! "$change" =~ ^[Yy]$ ]] && return 0
  fi
  set_env_kv "GEMINI_API_BASE_URL" "https://generativelanguage.googleapis.com/v1beta/models"
  log ""
  log "选择文本模型（用于提示词优化）："
  log "  1) gemini-3-flash（推荐，性价比最高）"
  log "  2) gemini-3-pro（更强大，成本较高）"
  log "  3) 自定义"
  local tc=""
  read -r -p "请选择 [1-3，默认 1]: " tc </dev/tty
  tc="${tc:-1}"
  case "$tc" in
    1) set_env_kv "GEMINI_TEXT_MODEL" "gemini-3-flash" ;;
    2) set_env_kv "GEMINI_TEXT_MODEL" "gemini-3-pro" ;;
    3) local cm=""; read -r -p "输入文本模型名称: " cm </dev/tty; set_env_kv "GEMINI_TEXT_MODEL" "$cm" ;;
  esac
  log ""
  log "选择图像生成模型："
  log "  1) gemini-3-pro-image-preview（推荐，目前最好）"
  log "  2) 自定义"
  local ic=""
  read -r -p "请选择 [1-2，默认 1]: " ic </dev/tty
  ic="${ic:-1}"
  case "$ic" in
    1) set_env_kv "GEMINI_IMAGE_MODEL" "gemini-3-pro-image-preview" ;;
    2) local im=""; read -r -p "输入图像模型名称: " im </dev/tty; set_env_kv "GEMINI_IMAGE_MODEL" "$im" ;;
  esac
  set_env_kv "GEMINI_TEXT_TEMPERATURE" "0.7"
  set_env_kv "GEMINI_TEXT_MAX_TOKENS" "500"
  log_green "✅ AI 模型配置完成"
}

configure_server_port() {
  log ""
  log "### 配置服务器端口"
  local current=""
  current="$(get_env_value "PORT")"
  current="${current:-8080}"
  local new=""
  read -r -p "服务器端口 [${current}]: " new </dev/tty
  new="${new:-$current}"
  set_env_kv "PORT" "$new"
  log_green "✅ 服务器端口: $new"
}

main() {
  ensure_root
  install_node_20_if_needed
  ensure_env_file
  backup_and_normalize_env_file

  # 读取现有管理员信息（如存在）
  local existing_admin_username="admin"
  local existing_admin_email="sunsx@briconbric.com"
  local existing_admin_has_key="0"
  local existing_admin_has_password="0"
  local admin_info_output=""
  admin_info_output="$(get_existing_admin_info)"
  while IFS='=' read -r k v; do
    k="$(printf '%s' "$k" | tr -d '\r')"
    v="$(printf '%s' "$v" | tr -d '\r')"
    case "$k" in
      ADMIN_USERNAME) existing_admin_username="$v" ;;
      ADMIN_EMAIL) existing_admin_email="$v" ;;
      ADMIN_HAS_KEY) existing_admin_has_key="$v" ;;
      ADMIN_HAS_PASSWORD) existing_admin_has_password="$v" ;;
    esac
  done <<< "$admin_info_output"

  log ""
  log "=========================================="
  log "     BOB Studio 配置向导"
  log "=========================================="
  log "配置将写入: .env 和 users.json"
  log ""

  # 1) API_KEY_ENCRYPTION_SECRET
  log "### 配置安全密钥"
  local current_enc
  current_enc="$(get_env_value "API_KEY_ENCRYPTION_SECRET")"
  if [ -z "$current_enc" ] || [ "$current_enc" = "change-me-to-random-secret" ] || [ "$current_enc" = "change-me-bobstudio-secret" ]; then
    log_yellow "⚠️ 当前 ${ENV_FILE} 中 API_KEY_ENCRYPTION_SECRET 未设置或为默认值"
    local new_enc
    # 允许留空（将自动生成），输入后会给出摘要确认避免输错
    new_enc="$(prompt_secret_with_confirm "请输入 API_KEY_ENCRYPTION_SECRET（留空则自动生成）" 1 0)"
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

  # 3) 服务器端口
  configure_server_port

  # 4) AI 模型配置
  configure_ai_models

  # 5) 邮件服务配置
  configure_email_provider

  # 6) Gemini API Key
  log ""
  log "### 配置 Gemini API Key"
  log "（将加密写入 users.json 的 apiKeyEncrypted）"
  local gemini_key=""
  if [ "$existing_admin_has_key" = "1" ]; then
    log_green "✅ 检测到超级管理员已配置 API Key（可直接回车跳过）"
    gemini_key="$(prompt_secret_with_confirm "Gemini API Key（回车保留现有）" 1 0)"
    gemini_key="$(echo -n "$gemini_key" | tr -d '[:space:]')"
  else
    while true; do
      # 最小长度 20 只是防呆提示，不代表真实 Key 格式校验
      gemini_key="$(prompt_secret_with_confirm "Gemini API Key" 0 20)"
      gemini_key="$(echo -n "$gemini_key" | tr -d '[:space:]')"
      if [ "${#gemini_key}" -ge 20 ]; then
        break
      fi
      log_yellow "⚠️ 看起来太短了，请重新输入"
    done
  fi

  # 7) 超级管理员信息
  log ""
  log "### 配置超级管理员账号"
  log "（默认读取现有配置，可直接回车保留）"
  local admin_username admin_email admin_password
  admin_username="$(prompt_value "管理员用户名" "$existing_admin_username" 0)"
  admin_email="$(prompt_value "管理员邮箱" "$existing_admin_email" 0)"

  if [ "$existing_admin_has_password" = "1" ]; then
    admin_password="$(prompt_password_twice "管理员密码（留空保持不变）" 1)"
  else
    log_yellow "⚠️ 首次配置建议你设置一个新管理员密码（将写入 users.json，为 sha256 哈希）"
    admin_password="$(prompt_password_twice "管理员密码" 0)"
  fi

  log ""
  log "📝 写入 users.json（或更新其中的超级管理员）..."

  # 写入前摘要（用于确认是否真的发生变化）
  local before_pw_prefix="" before_has_key="" before_key_len="" before_locked=""
  local state_output=""
  state_output="$(get_admin_state_summary)"
  while IFS='=' read -r k v; do
    k="$(printf '%s' "$k" | tr -d '\r\n')"
    v="$(printf '%s' "$v" | tr -d '\r\n')"
    case "$k" in
      ADMIN_PASSWORD_HASH_PREFIX) before_pw_prefix="$v" ;;
      ADMIN_HAS_KEY) before_has_key="$v" ;;
      ADMIN_APIKEY_ENCRYPTED_LEN) before_key_len="$v" ;;
      ADMIN_LOCKED) before_locked="$v" ;;
    esac
  done <<< "$state_output"

  write_admin_user_and_key "$admin_username" "$admin_email" "$admin_password" "$gemini_key" "$current_enc"

  # 强校验：如果这次确实输入了新密码/新 Key，就必须写入成功
  local require_password="0"
  local require_key="0"
  if [ -n "$(echo -n "$admin_password" | sed -E 's/[[:space:]]//g')" ]; then
    require_password="1"
  fi
  if [ -n "$(echo -n "$gemini_key" | sed -E 's/[[:space:]]//g')" ]; then
    require_key="1"
  fi
  assert_admin_written "$require_password" "$require_key"

  # 写入后摘要（以 users.json 实际内容为准，避免出现“校验通过但摘要为空”的矛盾）
  local after_pw_prefix="" after_has_key="" after_key_len="" after_locked=""
  state_output="$(get_admin_state_summary)"
  while IFS='=' read -r k v; do
    k="$(printf '%s' "$k" | tr -d '\r\n')"
    v="$(printf '%s' "$v" | tr -d '\r\n')"
    case "$k" in
      ADMIN_PASSWORD_HASH_PREFIX) after_pw_prefix="$v" ;;
      ADMIN_HAS_KEY) after_has_key="$v" ;;
      ADMIN_APIKEY_ENCRYPTED_LEN) after_key_len="$v" ;;
      ADMIN_LOCKED) after_locked="$v" ;;
    esac
  done <<< "$state_output"

  log ""
  log "### 配置结果摘要（不包含敏感明文）"
  log "   - 密码 hash 前缀（前->后）: ${before_pw_prefix:-<empty>} -> ${after_pw_prefix:-<empty>}"
  log "   - API Key 密文字段长度（前->后）: ${before_key_len:-0} -> ${after_key_len:-0}"
  if [ -n "$after_pw_prefix" ]; then
    if [ "$before_pw_prefix" != "$after_pw_prefix" ]; then
      log_green "✅ 管理员密码：已更新（hash 前缀 ${after_pw_prefix}）"
    else
      log_yellow "⚠️ 管理员密码：未更新（保持原密码）"
    fi
  else
    log_red "❌ 管理员密码：未写入（password 为空）"
  fi

  if [ "$after_has_key" = "1" ] && [ "${after_key_len:-0}" -gt 0 ]; then
    log_green "✅ Gemini API Key：已配置（已加密存储，长度 ${after_key_len}）"
  else
    log_red "❌ Gemini API Key：未配置（apiKeyEncrypted 为空）"
  fi

  if [ "$after_locked" = "1" ]; then
    log_red "❌ 账户状态：仍处于锁定（请等待 lockedUntil 到期）"
  else
    log_green "✅ 账户状态：未锁定（loginAttempts 已清零）"
  fi

  # 基础权限收紧
  chmod 600 "$ENV_FILE" 2>/dev/null || true
  chmod 600 "$USERS_FILE" 2>/dev/null || true

  # 最后再次规范化 .env 文件，清理所有多余空行
  log ""
  log "🧹 清理 .env 文件格式..."
  backup_and_normalize_env_file 1

  log_green "✅ 配置完成"
  log ""
  log "下一步：运行一键启动脚本"
  log "  sudo ./start.sh"
}

main "$@"

