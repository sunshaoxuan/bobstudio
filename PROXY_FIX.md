# Google API 代理修复说明

## 问题描述

中国用户无法直接访问 Google API（`generativelanguage.googleapis.com`），导致图像生成功能失败。

## 解决方案

通过后端服务器代理 Google API 请求：

```
用户浏览器 → 您的服务器 → Google API
     ↓
  可以访问    ↓           ↓
              代理转发    实际 API
```

## 修改内容

### 1. 后端新增代理 API (`server.cjs`)

- 新增 `/api/gemini/generate` 端点
- 接收前端请求，转发到 Google API
- 返回 Google API 的响应

### 2. 前端调用后端代理 (`src/components/Studio.js`)

- 修改 `callAPI` 函数
- 不再直接调用 Google API
- 改为调用自己的后端代理 API

## 部署步骤

### 1. 检查 Node.js 版本

确保服务器使用 Node.js 18 或更高版本（内置 fetch 支持）：

```bash
node --version
```

如果版本低于 18，需要安装 `node-fetch`：

```bash
npm install node-fetch
```

### 2. 提交代码并部署

```bash
# 在本地提交代码
git add .
git commit -m "修复：通过后端代理Google API，解决中国用户网络屏蔽问题"
git push origin main

# 在服务器上重启服务（systemd 方式）
systemctl restart bobstudio

# 或使用其他方式重启
```

### 3. 测试

1. 让中国用户访问您的网站
2. 登录账号
3. 尝试生成图像
4. 检查是否成功

## 优势

✅ 解决了中国用户网络屏蔽问题
✅ 用户无需使用 VPN 或代理
✅ 服务器在国外可以正常访问 Google API
✅ 前端代码更安全（API 密钥通过服务器传递）
✅ 统一的错误处理和日志记录

## 注意事项

1. **服务器位置**：您的服务器必须能够访问 Google API（通常在国外）
2. **带宽消耗**：图像数据会经过您的服务器，请确保带宽充足
3. **超时设置**：保持当前的 5 分钟超时设置（AI 生成图像可能需要较长时间）

## 兼容性

- ✅ Node.js 18+：内置 fetch，无需额外依赖
- ⚠️ Node.js 16-17：需要安装 `node-fetch` 包
- ❌ Node.js 14 及以下：不推荐使用

## 如果问题仍然存在

1. 检查服务器日志：`journalctl -u bobstudio -f`
2. 查看浏览器控制台是否有错误
3. 确认服务器能否访问 Google API：`curl https://generativelanguage.googleapis.com`
4. 检查防火墙设置是否阻止了出站 HTTPS 连接

