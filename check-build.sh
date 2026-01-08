#!/bin/bash

# 构建诊断脚本

echo "🔍 检查构建状态..."
echo ""

# 检查是否有构建进程在运行
echo "1. 检查构建进程:"
ps aux | grep -E "(vite|npm|node)" | grep -v grep || echo "  没有找到相关进程"
echo ""

# 检查磁盘空间
echo "2. 检查磁盘空间:"
df -h / | tail -1
echo ""

# 检查内存使用
echo "3. 检查内存使用:"
free -h
echo ""

# 检查 node_modules 是否存在
echo "4. 检查依赖安装:"
if [ -d "node_modules" ]; then
    echo "  ✅ node_modules 存在"
    echo "  依赖数量: $(ls -1 node_modules | wc -l)"
else
    echo "  ❌ node_modules 不存在"
fi
echo ""

# 检查 config 目录
echo "5. 检查配置文件:"
if [ -f "config/models.js" ]; then
    echo "  ✅ config/models.js 存在"
    # 检查语法
    if node -c config/models.js 2>/dev/null; then
        echo "  ✅ config/models.js 语法正确"
    else
        echo "  ❌ config/models.js 语法错误"
        node -c config/models.js
    fi
else
    echo "  ❌ config/models.js 不存在"
fi
echo ""

# 检查 server.cjs 是否能正常加载 config
echo "6. 检查 server.cjs 配置加载:"
if node -e "require('./config/models')" 2>&1; then
    echo "  ✅ server.cjs 可以正常加载 config/models.js"
else
    echo "  ❌ server.cjs 无法加载 config/models.js"
fi
echo ""

# 尝试手动构建（带详细输出）
echo "7. 尝试手动构建（前10行输出）:"
cd /root/bobstudio 2>/dev/null || cd "$(dirname "$0")"
npm run build 2>&1 | head -20 || echo "构建命令执行失败"
