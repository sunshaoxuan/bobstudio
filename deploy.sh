#!/bin/bash

# BOB Studio 部署脚本
# 用于手动部署和更新应用

set -e  # 遇到错误立即退出

echo "🚀 开始部署 BOB Studio..."

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📁 当前目录: $SCRIPT_DIR"

# 拉取最新代码
echo "📥 拉取最新代码..."
git pull origin main

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建前端
echo "🔨 构建前端..."
npm run build

echo "✅ 部署完成！"
echo ""
echo "重启服务: sudo systemctl restart bobstudio"
echo "查看状态: sudo systemctl status bobstudio"
echo "查看日志: sudo journalctl -u bobstudio -f"


