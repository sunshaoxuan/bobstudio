# BOB Studio Systemd 服务配置指南

## 📋 前置要求

- Ubuntu 系统（16.04+）
- Node.js 和 npm 已安装
- 项目已克隆到服务器

## 🚀 安装步骤

### 1. 修改服务配置文件

编辑 `bobstudio.service` 文件，修改以下内容：

```bash
# 替换为你的实际用户名
User=YOUR_USERNAME

# 替换为你的项目实际路径（两处）
WorkingDirectory=/path/to/nano-banana-studio
ExecStartPre=/bin/bash -c 'cd /path/to/nano-banana-studio && git pull origin main'
ExecStartPre=/bin/bash -c 'cd /path/to/nano-banana-studio && npm install'
ExecStartPre=/bin/bash -c 'cd /path/to/nano-banana-studio && npm run build'
```

例如：
```bash
User=ubuntu
WorkingDirectory=/home/ubuntu/nano-banana-studio
```

### 2. 创建日志目录

```bash
sudo mkdir -p /var/log/bobstudio
sudo chown YOUR_USERNAME:YOUR_USERNAME /var/log/bobstudio
```

### 3. 复制服务文件到系统目录

```bash
sudo cp bobstudio.service /etc/systemd/system/
```

### 4. 重新加载 systemd 配置

```bash
sudo systemctl daemon-reload
```

### 5. 启用并启动服务

```bash
# 启用服务（开机自启）
sudo systemctl enable bobstudio

# 启动服务
sudo systemctl start bobstudio

# 查看服务状态
sudo systemctl status bobstudio
```

## 📝 常用命令

### 查看服务状态
```bash
sudo systemctl status bobstudio
```

### 启动服务
```bash
sudo systemctl start bobstudio
```

### 停止服务
```bash
sudo systemctl stop bobstudio
```

### 重启服务
```bash
sudo systemctl restart bobstudio
```

### 查看日志（实时）
```bash
sudo journalctl -u bobstudio -f
```

### 查看日志（最近100行）
```bash
sudo journalctl -u bobstudio -n 100
```

### 查看应用日志
```bash
# 查看输出日志
sudo tail -f /var/log/bobstudio/output.log

# 查看错误日志
sudo tail -f /var/log/bobstudio/error.log
```

### 禁用自动启动
```bash
sudo systemctl disable bobstudio
```

## 🔄 手动部署更新

如果你想手动部署更新而不重启服务，使用 `deploy.sh` 脚本：

```bash
# 给脚本执行权限（只需要执行一次）
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh

# 部署完成后重启服务
sudo systemctl restart bobstudio
```

## 🐛 故障排查

### 服务无法启动

1. 检查服务状态和日志：
```bash
sudo systemctl status bobstudio
sudo journalctl -u bobstudio -n 50
```

2. 检查文件路径是否正确
3. 检查用户权限是否正确
4. 检查端口是否被占用：
```bash
sudo lsof -i :8080
```

### 查看详细启动日志
```bash
sudo journalctl -u bobstudio -b
```

### 检查服务配置是否正确
```bash
sudo systemctl cat bobstudio
```

## 🔒 安全建议

1. **不要使用 root 用户运行服务**
   - 使用普通用户（如 ubuntu, www-data 等）

2. **设置环境变量**
   - 在服务文件中添加敏感配置：
   ```ini
   Environment="SESSION_SECRET=your-secret-key"
   Environment="API_KEY_ENCRYPTION_SECRET=your-encryption-key"
   ```

3. **配置防火墙**
   ```bash
   sudo ufw allow 8080/tcp
   ```

4. **使用反向代理（推荐）**
   - 使用 Nginx 作为反向代理，隐藏端口8080
   - 配置SSL证书

## 📊 监控服务

### 查看服务运行时间
```bash
sudo systemctl show bobstudio --property=ActiveEnterTimestamp
```

### 查看服务重启次数
```bash
sudo systemctl show bobstudio --property=NRestarts
```

## ⚙️ 高级配置

### 修改服务文件后
```bash
# 1. 重新加载配置
sudo systemctl daemon-reload

# 2. 重启服务
sudo systemctl restart bobstudio
```

### 完全卸载服务
```bash
# 1. 停止并禁用服务
sudo systemctl stop bobstudio
sudo systemctl disable bobstudio

# 2. 删除服务文件
sudo rm /etc/systemd/system/bobstudio.service

# 3. 重新加载配置
sudo systemctl daemon-reload
```

## 📌 注意事项

1. **Git 认证**：确保服务器能够无需密码拉取代码（配置 SSH key）
2. **Node 版本**：确保系统 Node.js 版本满足项目要求
3. **端口冲突**：确保 8080 端口未被占用
4. **日志轮转**：考虑配置 logrotate 定期清理日志文件

