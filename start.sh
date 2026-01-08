#!/bin/bash

# BOB Studio 启动脚本

set -e  # 遇到错误立即退出

# 进入项目目录
cd /root/bobstudio

# 设置PATH（必须包含node_modules/.bin）
export PATH=/root/bobstudio/node_modules/.bin:/usr/local/bin:/usr/bin:/bin

echo "🔄 强制同步最新代码..."
# 强制重置到远程仓库，覆盖所有本地修改
/usr/bin/git fetch origin
/usr/bin/git reset --hard origin/main
/usr/bin/git clean -fd  # 清理未跟踪的文件

echo "📦 安装依赖（包括开发依赖）..."
# 不设置NODE_ENV=production，以便安装devDependencies（react-scripts需要）
/usr/bin/npm install

echo "🔨 构建前端..."
# 确保输出不被缓冲（如果系统支持）
if command -v stdbuf >/dev/null 2>&1; then
    /usr/bin/npm run build 2>&1 | stdbuf -oL -eL tee /tmp/build.log
    BUILD_EXIT_CODE=${PIPESTATUS[0]}
else
    /usr/bin/npm run build
    BUILD_EXIT_CODE=$?
fi

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "✅ 前端构建完成"
else
    echo "❌ 构建失败，退出码: $BUILD_EXIT_CODE"
    echo "📋 查看详细日志: cat /tmp/build.log 2>/dev/null || tail -50 /var/log/bobstudio/output.log"
    exit $BUILD_EXIT_CODE
fi

echo "🚀 启动服务器..."
# 启动服务器时才设置为生产环境
export NODE_ENV=production
exec /usr/bin/npm run server

