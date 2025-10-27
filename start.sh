#!/bin/bash

# BOB Studio 启动脚本

set -e  # 遇到错误立即退出

# 进入项目目录
cd /root/bobstudio

# 设置PATH（必须包含node_modules/.bin）
export PATH=/root/bobstudio/node_modules/.bin:/usr/local/bin:/usr/bin:/bin

echo "🔄 拉取最新代码..."
/usr/bin/git pull origin main

echo "📦 安装依赖（包括开发依赖）..."
# 不设置NODE_ENV=production，以便安装devDependencies（react-scripts需要）
/usr/bin/npm install

echo "🔨 构建前端..."
/usr/bin/npm run build

echo "🚀 启动服务器..."
# 启动服务器时才设置为生产环境
export NODE_ENV=production
exec /usr/bin/npm run server

