# API 端口配置说明

## 重要说明

**生产环境无需配置**，前端会自动使用相对路径（空字符串），与您的 Nginx 配置完美配合。

## 配置方式

### 方式一：使用环境变量（推荐）

创建 `.env` 文件：

```bash
# 开发环境后端 API 地址
REACT_APP_API_URL=http://localhost:3001
```

### 方式二：直接修改端口

如果不想使用环境变量，可以直接修改默认端口：

**src/contexts/AuthContext.js** (第 46-48 行):
```javascript
const API_BASE = process.env.NODE_ENV === 'development' 
  ? (process.env.REACT_APP_API_URL || 'http://localhost:YOUR_PORT')
  : '';
```

**src/components/Studio.js** (多处):
```javascript
const baseURL = process.env.NODE_ENV === 'development' 
  ? (process.env.REACT_APP_API_URL || 'http://localhost:YOUR_PORT')
  : '';
```

## 不同环境的配置

### 开发环境

前后端分离开发时需要指定后端地址：

```bash
# .env
NODE_ENV=development
REACT_APP_API_URL=http://localhost:3001  # 或您的后端端口
```

然后：
```bash
# 终端 1：启动后端
PORT=3001 npm run server

# 终端 2：启动前端
npm start
```

### 生产环境（Nginx 反向代理）

**无需配置**，代码会自动使用相对路径。

您的 Nginx 配置示例：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/bobstudio/build;
        try_files $uri $uri/ /index.html;
    }

    # API 代理到 Node.js
    location /api/ {
        proxy_pass http://localhost:8080;  # 您的实际后端端口
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # 图片文件代理
    location /images/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
    }
}
```

### 生产环境（直接使用 server.js）

如果直接用 `npm run server` 运行，也无需配置：

```bash
# 服务器会同时服务前端和后端
PORT=8080 npm run server
```

访问: `http://your-domain:8080`

## 当前默认配置

- **开发环境**: `http://localhost:8080`（如未设置 `REACT_APP_API_URL`）
- **生产环境**: 相对路径（空字符串），使用当前域名和端口

## 修改后端端口

如果要修改后端监听端口，设置环境变量即可：

```bash
PORT=3001 npm run server
```

或在 `.env` 文件中：
```bash
PORT=3001
```

## 常见问题

### Q: 为什么生产环境不需要配置？

A: 生产环境中，前端代码使用相对路径（如 `/api/login`），浏览器会自动使用当前页面的域名和端口，这样：
- 如果通过 Nginx 访问，请求会被 Nginx 代理到后端
- 如果直接访问 Node.js，前后端在同一端口，请求直接到达后端

### Q: 我的 Nginx 配置在不同端口，需要改代码吗？

A: **不需要**！生产环境代码自动使用相对路径，与您的 Nginx 配置完全兼容。

### Q: 我修改了端口，需要重新构建吗？

A: 
- 使用环境变量：需要重新 `npm run build`
- 直接修改代码：需要重新 `npm run build`

### Q: 如何验证配置是否正确？

打开浏览器控制台（F12），查看网络请求：
- 开发环境应该看到完整 URL：`http://localhost:8080/api/...`
- 生产环境应该看到相对路径：`/api/...`

## 如果您使用的是其他端口

请在 `.env` 文件中设置：

```bash
# 如果您的后端在 3001 端口
REACT_APP_API_URL=http://localhost:3001

# 如果您的后端在 9000 端口
REACT_APP_API_URL=http://localhost:9000
```

然后重新构建：
```bash
npm run build
```

## 注意事项

1. **修改 `.env` 后必须重启开发服务器或重新构建**
2. **`.env` 文件不应提交到 Git**（已在 .gitignore 中）
3. **生产环境部署时不需要设置 `REACT_APP_API_URL`**

