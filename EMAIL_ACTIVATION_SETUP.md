# 📧 邮件激活系统配置指南

## 功能说明

现在用户注册时会自动发送激活邮件，必须通过邮箱链接激活后才能登录使用。

## 📝 配置步骤

### 1. 邮件服务器配置（已内置）

默认配置已经设置好，但可以通过环境变量覆盖：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `SMTP_HOST` | `mail.briconbric.com` | SMTP 服务器地址 |
| `SMTP_PORT` | `587` | SMTP 端口（587=TLS） |
| `SMTP_USER` | `postmaster@briconbric.com` | SMTP 用户名 |
| `SMTP_PASS` | `BtZhY1^3` | SMTP 密码 |
| `SITE_URL` | `https://studio.briconbric.com` | 网站域名 |
| `EMAIL_FROM` | `BOB Studio <postmaster@briconbric.com>` | 发件人显示 |

### 2. 在服务器上设置环境变量（可选）

如果需要修改配置，在 `start.sh` 中添加：

```bash
export SMTP_HOST="your-smtp-server.com"
export SMTP_PORT="587"
export SMTP_USER="your-email@domain.com"
export SMTP_PASS="your-password"
export SITE_URL="https://your-domain.com"
export EMAIL_FROM="Your App <noreply@domain.com>"
```

### 3. 重启服务

```bash
systemctl restart bobstudio
```

## 📧 邮件模板

激活邮件内容包括：
- ✅ 欢迎信息
- ✅ 激活按钮
- ✅ 激活链接（24小时有效）
- ✅ 响应式 HTML 设计

## 🔍 测试流程

### 1. 注册新用户

访问：`https://studio.briconbric.com/register`

填写：
- 用户名
- 邮箱
- 密码

### 2. 检查邮箱

- 查看收件箱
- 如果没收到，检查垃圾邮件
- 邮件标题：**激活您的 BOB Studio 账户**

### 3. 点击激活链接

链接格式：`https://studio.briconbric.com/activate/{token}`

### 4. 激活成功

- 显示成功页面
- 可以立即登录使用

## 🚨 故障排查

### 邮件发送失败

查看服务器日志：
```bash
journalctl -u bobstudio -f | grep "邮件"
```

常见错误：

**1. SMTP 连接失败**
```
❌ 发送激活邮件失败: Error: connect ECONNREFUSED
```
**解决**：检查 SMTP 服务器地址和端口

**2. 认证失败**
```
❌ 发送激活邮件失败: Error: Invalid login
```
**解决**：检查 SMTP 用户名和密码

**3. 被拒绝**
```
❌ 发送激活邮件失败: Error: Mail command failed
```
**解决**：检查发件人邮箱是否被允许发送

### 激活链接无效

**原因1：链接过期（24小时）**
- 用户需要重新注册

**原因2：令牌错误**
- 检查链接是否完整复制

## 📊 日志监控

**成功的注册+发送邮件：**
```
[2025-10-28 18:00:00.123] ✅ 用户注册成功: testuser (test@example.com)
[2025-10-28 18:00:01.456] 📧 激活邮件已发送: test@example.com | MessageID: <xxx@mail.briconbric.com>
```

**成功的激活：**
```
[2025-10-28 18:05:00.789] ✅ 用户激活成功: testuser (test@example.com)
```

## 🔒 安全特性

1. **激活令牌**：64位随机十六进制字符串
2. **有效期**：24小时自动过期
3. **一次性**：激活后令牌立即失效
4. **未激活无法登录**：防止垃圾注册

## 🎯 工作流程

```
用户注册
    ↓
生成激活令牌（24h有效）
    ↓
保存用户（isActive=false）
    ↓
发送激活邮件
    ↓
用户点击链接
    ↓
验证令牌（检查过期）
    ↓
激活账户（isActive=true）
    ↓
可以登录使用
```

## 📧 邮件服务器要求

- 支持 SMTP/TLS（端口587）或 SMTPS（端口465）
- 允许第三方应用发送邮件
- 发送限额足够（建议至少100封/天）

## 🆘 如果邮件服务不可用

注册API会自动回滚：
- 如果邮件发送失败，用户数据不会保存
- 返回错误提示："注册失败：无法发送激活邮件"
- 用户可以稍后重试

## 💡 优化建议

### 1. 使用专业邮件服务

推荐服务商：
- **SendGrid**：免费 100封/天
- **Mailgun**：免费 5000封/月
- **Amazon SES**：$0.10/1000封

### 2. 添加邮件队列

对于高并发，建议使用：
- Redis + Bull
- RabbitMQ
- AWS SQS

### 3. 邮件模板管理

- 使用专业的邮件模板引擎
- 支持多语言
- A/B 测试

---

**配置时间**：5分钟
**难度**：⭐（简单）
**状态**：✅ 已配置并测试

