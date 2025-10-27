# Nginx 配置说明

## 修复 413 Payload Too Large 错误

如果您使用 Nginx 反向代理，需要增加请求体大小限制。

### 修改 Nginx 配置

编辑您的 Nginx 配置文件：

```bash
sudo nano /etc/nginx/nginx.conf
# 或
sudo nano /etc/nginx/sites-available/your-site
```

### 添加或修改以下配置

```nginx
http {
    # 增加请求体大小限制到 100MB
    client_max_body_size 100M;
    
    # 其他配置...
}

server {
    listen 80;
    server_name your-domain.com;
    
    # 也可以在 server 块中设置
    client_max_body_size 100M;
    
    # 前端静态文件
    location / {
        root /path/to/bobstudio/build;
        try_files $uri $uri/ /index.html;
    }

    # API 代理到 Node.js
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 增加代理超时时间（处理大文件上传）
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # 增加缓冲区大小
        proxy_buffers 8 16k;
        proxy_buffer_size 32k;
    }
    
    # 图片文件代理
    location /images/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        
        # 图片访问也可能需要较大的响应体
        proxy_buffers 8 16k;
        proxy_buffer_size 32k;
    }
}
```

### 重启 Nginx

```bash
# 测试配置是否正确
sudo nginx -t

# 重新加载配置
sudo nginx -s reload

# 或完全重启
sudo systemctl restart nginx
```

## 如果不使用 Nginx

如果您直接使用 `npm run server`，无需额外配置，服务器已经设置了 100MB 限制。

## 验证配置

配置完成后，在浏览器中生成图片，不应再看到 413 错误。

## 常见问题

### Q: 为什么需要 100MB？

A: 图片 BASE64 编码后会比原始大小大约 33%。一张 2-3MB 的图片编码后可能达到 3-4MB，多张图片的历史记录可能超过 50MB。

### Q: 会影响服务器性能吗？

A: 这只是允许的最大值，不会影响正常的小请求。只有在上传大图片时才会使用到。

### Q: 还是报 413 错误？

检查以下几点：
1. Nginx 配置是否正确重载：`sudo nginx -s reload`
2. Node.js 服务器是否重启
3. 浏览器缓存是否清除（Ctrl+Shift+R 强制刷新）
4. 检查是否有多层代理（如 CDN）也有限制

### Q: 如何查看当前 Nginx 的限制？

```bash
# 查看配置
sudo nginx -T | grep client_max_body_size

# 如果没有输出，说明使用默认值 1MB
```

## 安全建议

如果担心恶意大文件攻击，可以：

1. 只在特定 API 路由增加限制：
```nginx
location /api/history/ {
    client_max_body_size 100M;
    proxy_pass http://localhost:8080;
}

location /api/ {
    client_max_body_size 10M;  # 其他API保持较小限制
    proxy_pass http://localhost:8080;
}
```

2. 添加请求频率限制：
```nginx
# 在 http 块中
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;

# 在 location 块中
location /api/history/ {
    limit_req zone=api burst=5;
    client_max_body_size 100M;
    proxy_pass http://localhost:8080;
}
```

## 推荐配置

对于 BOB Studio，推荐设置：
- `client_max_body_size`: 100M（历史记录保存）
- `proxy_connect_timeout`: 300s
- `proxy_send_timeout`: 300s
- `proxy_read_timeout`: 300s

