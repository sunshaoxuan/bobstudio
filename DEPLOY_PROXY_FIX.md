# 🚀 快速部署指南 - 修复中国用户网络屏蔽问题

## 📋 修改摘要

✅ 已完成以下修改：

1. **后端** (`server.cjs`)：新增 Google API 代理端点
2. **前端** (`src/components/Studio.js`)：改为调用后端代理
3. **依赖** (`package.json`)：添加 `node-fetch` 兼容旧版 Node.js
4. **启动脚本** (`start.sh`)：添加环境变量配置

## 🔧 部署步骤

### 第 1 步：修改启动脚本中的密钥

编辑 `start.sh` 文件，将以下两行改成您自己的随机字符串：

```bash
export API_KEY_ENCRYPTION_SECRET="your-random-secret-key-change-this"
export SESSION_SECRET="your-session-secret-change-this"
```

**建议使用强随机字符串**，例如：
```bash
export API_KEY_ENCRYPTION_SECRET="k8sD9nM2pQ7wE3xR5tY9uI1oP0aS4fG6hJ8kL3zX2cV7bN4mQ"
export SESSION_SECRET="aB3cD5eF7gH9iJ2kL4mN6oP8qR1sT3uV5wX7yZ9aB2cD4eF6"
```

### 第 2 步：提交并推送代码

```bash
# 在本地执行
git add .
git commit -m "修复：通过后端代理Google API，解决中国用户访问问题"
git push origin main
```

### 第 3 步：服务器部署

**选项 A - 使用 systemd（推荐）：**

```bash
# 重启服务（会自动拉取最新代码并构建）
systemctl restart bobstudio

# 查看日志确认是否成功
journalctl -u bobstudio -f
```

**选项 B - 手动部署：**

```bash
cd /root/bobstudio

# 拉取最新代码
git pull origin main

# 安装依赖
npm install

# 构建前端
npm run build

# 重启服务
pm2 restart bobstudio
# 或者如果直接运行：
# killall node && nohup npm run server &
```

## ✅ 验证步骤

### 1. 检查服务器日志

```bash
# systemd
journalctl -u bobstudio -f

# pm2
pm2 logs bobstudio
```

应该能看到：
```
🚀 服务器运行在端口 8080
📁 历史记录存储在: /root/bobstudio/history
🌐 本地访问地址: http://localhost:8080
```

### 2. 测试 API 端点

```bash
# 在服务器上测试
curl http://localhost:8080/api/health
```

应该返回：
```json
{
  "status": "OK",
  "message": "Server is running"
}
```

### 3. 让用户测试

1. 让**中国用户**访问您的网站
2. 登录账号
3. 输入提示词，点击"生成图像"
4. 观察是否能成功生成（可能需要等待 30-60 秒）

## 🔍 排查问题

### 问题 1：服务器启动失败

```bash
# 检查 Node.js 版本
node --version

# 如果低于 14，需要升级：
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 问题 2：依赖安装失败

```bash
# 清理缓存重新安装
rm -rf node_modules package-lock.json
npm install
```

### 问题 3：仍然报错"图像生成失败"

**在浏览器中**按 F12 打开开发者工具，查看：

1. **Console 标签**：有没有网络错误？
2. **Network 标签**：找到 `gemini/generate` 请求，查看响应内容

**在服务器上**查看日志：
```bash
journalctl -u bobstudio -n 100  # 查看最近 100 行日志
```

### 问题 4：服务器无法访问 Google API

测试服务器网络：
```bash
# 测试是否能访问 Google API
curl -I https://generativelanguage.googleapis.com

# 应该返回 HTTP/2 405（说明能访问）
# 如果超时或连接失败，说明服务器也被屏蔽了
```

## 🎯 架构对比

### 修改前（❌ 中国用户无法使用）
```
[用户浏览器] --X--> [Google API]
    (中国)            (被屏蔽)
```

### 修改后（✅ 中国用户可以使用）
```
[用户浏览器] --> [您的服务器] --> [Google API]
    (中国)        (国外,代理)      (正常访问)
```

## 📊 预期效果

- ✅ 中国用户无需 VPN 即可使用
- ✅ API 密钥更安全（不直接暴露在浏览器）
- ✅ 统一的日志和错误处理
- ⚠️ 服务器带宽消耗增加（图像数据会经过服务器）

## 💡 提示

1. **首次生成可能较慢**（30-120秒），这是 Google API 的正常速度
2. **服务器必须在国外**或能够访问 Google API
3. **建议使用 CDN** 加速图片访问（如果流量大）

## 📞 需要帮助？

如果部署后仍有问题，请提供：
1. 服务器日志（最后 50 行）
2. 浏览器控制台截图
3. Network 标签的请求详情

---

**部署时间**：约 5-10 分钟
**难度**：⭐⭐ (简单)

