# BOB Studio 生产环境部署指南

## ⚠️ 生产环境登录失败问题排查

如果您的应用部署到生产环境后出现"网络连接失败，请重试"的错误，请按以下步骤排查。

## 问题原因

您的应用采用前后端分离架构：
- **前端**：React 应用（打包在 `build/` 目录）
- **后端**：Node.js/Express 服务器（`server.js`）

在生产环境中，前后端应该在**同一个域名和端口**下运行。

## 推荐的部署方式

### 方式一：使用 server.js 直接服务（最简单）

`server.js` 已经配置好了服务静态文件，您只需要：

```bash
# 1. 构建前端
npm run build

# 2. 启动服务器（会同时服务前端静态文件和后端 API）
npm run server
```

服务器会自动：
- 服务 `build/` 目录中的前端静态文件
- 处理所有 `/api/*` 的 API 请求
- 所有其他路由返回 React 应用的 `index.html`

**访问地址**：`http://your-domain:8080`

### 方式二：使用 Nginx 反向代理

如果您想使用 Nginx，配置示例：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 服务静态文件
    location / {
        root /path/to/nano-banana-studio/build;
        try_files $uri $uri/ /index.html;
    }

    # 代理 API 请求到 Node.js 服务器
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

同时启动 Node.js 服务器：

```bash
# 构建前端
npm run build

# 启动后端服务器（仅处理 API 请求）
npm run server
```

## 环境变量配置

创建 `.env` 文件（参考 `env.example`）：

```bash
# 复制示例文件
cp env.example .env
```

生产环境关键配置：

```env
NODE_ENV=production
PORT=8080
SESSION_SECRET=your-strong-random-secret-here
API_KEY_ENCRYPTION_SECRET=your-strong-random-secret-here

# 如果使用 HTTPS
USE_HTTPS=true
```

## 使用 PM2 管理进程

推荐使用 PM2 来管理 Node.js 服务器：

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start server.js --name "bob-studio"

# 查看状态
pm2 status

# 查看日志
pm2 logs bob-studio

# 设置开机自启
pm2 startup
pm2 save
```

## 验证部署

1. **检查服务器是否运行**：
   ```bash
   curl http://localhost:8080/api/health
   ```
   应该返回：
   ```json
   {"status":"OK","message":"Server is running",...}
   ```

2. **检查前端是否可访问**：
   在浏览器访问 `http://your-domain:8080`，应该看到登录页面。

3. **尝试登录**：
   打开浏览器开发者工具（F12），查看 Console 标签：
   - 应该看到 `🔗 尝试登录，API 地址: /api/auth/login?...`
   - 应该看到 `📡 登录响应状态: 200`（成功）
   - 如果看到错误，控制台会有更详细的错误信息

## 常见问题

### 1. "无法连接到服务器"

**症状**：打开浏览器控制台看到 "Failed to fetch" 错误

**原因**：后端服务器没有启动

**解决**：
```bash
npm run server
```

### 2. "404 Not Found"

**症状**：访问 `/api/*` 返回 404

**原因**：前端和后端不在同一个域名下

**解决**：
- 确保前后端部署在同一域名端口
- 或者使用 Nginx 反向代理

### 3. CORS 错误

**症状**：控制台显示跨域错误

**原因**：服务器 CORS 配置问题

**检查**：查看 `server.js` 第 84-89 行的 CORS 配置
```javascript
app.use(
  cors({
    origin: process.env.NODE_ENV === "development" ? "http://localhost:3005" : true,
    credentials: true,
  }),
);
```

### 4. Session 不工作

**症状**：登录后刷新页面又退出登录

**原因**：Cookies 配置问题

**检查**：
- 确保 `server.js` 中的 `credentials: 'include'` 配置正确
- 如果使用 HTTPS，确保 `USE_HTTPS=true`

## 更新后的错误提示

现在登录失败会显示更详细的错误信息：

1. **无法连接到服务器**：会提示 "请确保后端服务已启动（运行 npm run server）"
2. **其他网络错误**：会显示具体的错误消息

请查看浏览器控制台获取更详细的诊断信息。

## 需要帮助？

如果问题仍然存在，请提供以下信息：

1. 浏览器控制台的完整错误信息
2. 服务器日志（运行 `npm run server` 的终端输出）
3. 您的部署方式（直接使用 server.js 还是使用 Nginx）
4. 访问的 URL

