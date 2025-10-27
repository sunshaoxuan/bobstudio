# 快速修复 413 Payload Too Large 错误

## ⚠️ 问题原因

413 错误是因为**请求体太大**被拦截。可能的拦截点：

1. **Nginx**（最常见）- 默认限制 1MB
2. **Node.js** - 我们已设置 200MB
3. **其他反向代理**（如 Apache、CDN）

## 🔍 第一步：确认您的架构

请告诉我您使用的是哪种部署方式：

### A. 使用 Nginx 反向代理
```
浏览器 → Nginx → Node.js (server.js)
```

### B. 直接使用 Node.js
```
浏览器 → Node.js (server.js)
```

### C. 其他（如 Apache、CDN）

## 🛠️ 解决方案

### 方案 A：如果使用 Nginx（最常见）

#### 1. 查看当前 Nginx 配置

```bash
# 查找 Nginx 配置文件
sudo nginx -t

# 查看当前的请求体大小限制
sudo nginx -T | grep client_max_body_size
```

如果没有输出或显示 `1m`，说明限制太小。

#### 2. 修改 Nginx 配置

找到您的 Nginx 配置文件（通常是下面之一）：

```bash
# 主配置文件
sudo nano /etc/nginx/nginx.conf

# 或站点配置文件
sudo nano /etc/nginx/sites-available/default
sudo nano /etc/nginx/sites-available/your-site
```

#### 3. 添加或修改配置

**选项 1：全局设置（推荐）**

在 `http {}` 块中添加：

```nginx
http {
    client_max_body_size 200M;
    client_body_timeout 600s;
    
    # ... 其他配置
}
```

**选项 2：只针对 API**

在 `server {}` 块中：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端
    location / {
        root /path/to/bobstudio/build;
        try_files $uri $uri/ /index.html;
    }
    
    # API - 增加限制
    location /api/ {
        client_max_body_size 200M;
        client_body_timeout 600s;
        
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # 增加超时时间
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        
        # 增加缓冲区
        proxy_buffering off;
        proxy_request_buffering off;
    }
    
    # 图片访问
    location /images/ {
        proxy_pass http://localhost:8080;
    }
}
```

#### 4. 测试并重新加载

```bash
# 测试配置语法
sudo nginx -t

# 如果显示 "syntax is ok"，重新加载
sudo nginx -s reload

# 或完全重启
sudo systemctl restart nginx
```

#### 5. 验证配置

```bash
# 确认新配置已生效
sudo nginx -T | grep client_max_body_size
# 应该看到: client_max_body_size 200M;
```

### 方案 B：如果直接使用 Node.js

```bash
# 1. 更新代码
cd ~/bobstudio
git pull origin main

# 2. 重启服务器
ps aux | grep server.js
kill <PID>
npm run server
```

Node.js 已经设置了 200MB 限制，应该够用了。

### 方案 C：检查其他可能的拦截点

#### CDN（如 Cloudflare）

如果使用 CDN，检查其配置：
- Cloudflare Free: 最大 100MB
- Cloudflare Pro: 最大 500MB

#### Apache

如果使用 Apache 作为反向代理：

```apache
<VirtualHost *:80>
    # 增加限制
    LimitRequestBody 209715200  # 200MB
    
    ProxyPass /api/ http://localhost:8080/api/
    ProxyPassReverse /api/ http://localhost:8080/api/
    
    # 增加超时
    ProxyTimeout 600
</VirtualHost>
```

## 🧪 测试步骤

修改配置后：

### 1. 清除浏览器缓存

按 `Ctrl + Shift + Delete`，清除缓存，或使用无痕模式。

### 2. 强制刷新

按 `Ctrl + Shift + R`（Windows）或 `Cmd + Shift + R`（Mac）

### 3. 查看错误详情

打开浏览器开发者工具（F12），切换到 Network 标签，点击失败的请求，查看：

- **Request Headers** - 确认请求发送到哪里
- **Response** - 查看具体错误信息
- **Status Code** - 如果还是 413，说明还有某处限制

### 4. 测试小图片

先用一个小提示词测试（生成小图），看是否能成功。如果小图成功，说明配置正确，只是单张图太大。

## 📊 诊断命令

运行以下命令并提供输出：

```bash
# 1. 检查 Nginx 状态
sudo systemctl status nginx

# 2. 查看 Nginx 配置
sudo nginx -T | grep -A 5 -B 5 "client_max_body_size"

# 3. 查看 Node.js 进程
ps aux | grep node

# 4. 查看端口占用
sudo netstat -tlnp | grep :80
sudo netstat -tlnp | grep :8080

# 5. 测试 API 是否可达
curl -I http://localhost:8080/api/health
```

## 🆘 如果还是不行

请提供以下信息：

1. **您的部署架构**（Nginx？直接Node.js？其他？）
2. **Nginx 配置文件内容**（如果使用）
   ```bash
   sudo cat /etc/nginx/nginx.conf
   sudo cat /etc/nginx/sites-available/your-site
   ```
3. **诊断命令的完整输出**
4. **浏览器 Network 标签中失败请求的完整信息**

## 💡 临时解决方案

如果配置修复需要时间，可以临时：

1. **降低图片质量** - 修改提示词，要求生成较小尺寸的图片
2. **使用无损压缩** - 生成后手动压缩
3. **分步保存** - 一次只生成一张图

## ✅ 成功标志

配置成功后，您应该看到：

**浏览器控制台：**
```
📤 开始上传图片到服务器...
✅ 图片上传成功: /images/user_xxx/xxx.png
==================================================
💾 开始保存历史记录到服务器
响应状态: 200 OK
✅ 历史记录已保存到服务器
==================================================
```

**服务器日志：**
```
📸 收到图片上传请求
用户: user_xxx
图片数据大小: XXX KB
✅ 图片上传成功: /images/user_xxx/xxx.png

============================================================
📥 收到保存历史记录请求
✅ JSON文件写入成功
============================================================
```

**文件系统：**
```bash
ls ~/bobstudio/images/user_xxx/  # 应该看到 .png 文件
ls ~/bobstudio/history/           # 应该看到 .json 文件
```

