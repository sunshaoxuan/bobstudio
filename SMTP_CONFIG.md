# BOB Studio 邮件服务配置指南

## 🔧 SMTP/ESMTP 配置说明

BOB Studio 支持多种邮件服务提供商，包括 Gmail、Outlook、QQ邮箱、163邮箱等，以及自定义SMTP服务器。

## 📋 配置文件位置

- **邮件配置**: `src/config/email.js`
- **邮件服务**: `src/services/emailService.js`
- **环境变量**: 项目根目录的 `.env` 文件

## 🚀 快速配置

### 1. 复制环境变量模板

```bash
cp env.example .env
```

### 2. 编辑 `.env` 文件

根据您选择的邮件服务提供商填写相应配置：

#### Gmail 配置示例
```env
REACT_APP_EMAIL_PROVIDER=gmail
REACT_APP_EMAIL_USER=your-email@gmail.com
REACT_APP_EMAIL_PASS=your-app-password
REACT_APP_EMAIL_FROM_NAME=BOB Studio
REACT_APP_EMAIL_FROM=your-email@gmail.com
REACT_APP_EMAIL_ENABLED=true
```

#### Outlook 配置示例
```env
REACT_APP_EMAIL_PROVIDER=outlook
REACT_APP_EMAIL_USER=your-email@outlook.com
REACT_APP_EMAIL_PASS=your-password
REACT_APP_EMAIL_FROM_NAME=BOB Studio
REACT_APP_EMAIL_FROM=your-email@outlook.com
REACT_APP_EMAIL_ENABLED=true
```

#### QQ邮箱配置示例
```env
REACT_APP_EMAIL_PROVIDER=qq
REACT_APP_EMAIL_USER=your-email@qq.com
REACT_APP_EMAIL_PASS=your-authorization-code
REACT_APP_EMAIL_FROM_NAME=BOB Studio
REACT_APP_EMAIL_FROM=your-email@qq.com
REACT_APP_EMAIL_ENABLED=true
```

#### 自定义SMTP服务器
```env
REACT_APP_EMAIL_PROVIDER=custom
REACT_APP_EMAIL_USER=your-email@yourdomain.com
REACT_APP_EMAIL_PASS=your-password
REACT_APP_SMTP_HOST=smtp.yourdomain.com
REACT_APP_SMTP_PORT=587
REACT_APP_SMTP_SECURE=false
REACT_APP_SMTP_TLS_REJECT=false
REACT_APP_EMAIL_FROM_NAME=BOB Studio
REACT_APP_EMAIL_FROM=your-email@yourdomain.com
REACT_APP_EMAIL_ENABLED=true
```

## 🔐 获取应用密码/授权码

### Gmail
1. 登录Google账户
2. 访问 [Google账户安全设置](https://myaccount.google.com/security)
3. 启用"两步验证"
4. 生成"应用专用密码"
5. 使用生成的16位密码作为 `REACT_APP_EMAIL_PASS`

### QQ邮箱
1. 登录QQ邮箱
2. 进入"设置" → "账户"
3. 开启"POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务"
4. 获取授权码
5. 使用授权码作为 `REACT_APP_EMAIL_PASS`

### 163邮箱
1. 登录163邮箱
2. 进入"设置" → "POP3/SMTP/IMAP"
3. 开启"IMAP/SMTP服务"
4. 设置客户端授权密码
5. 使用授权密码作为 `REACT_APP_EMAIL_PASS`

## ⚙️ 高级配置选项

### 发送限制配置
```env
# 每小时最大发送邮件数量
REACT_APP_EMAIL_RATE_LIMIT=100

# 重试次数
REACT_APP_EMAIL_RETRY_ATTEMPTS=3

# 重试延迟（毫秒）
REACT_APP_EMAIL_RETRY_DELAY=1000
```

### SSL/TLS 配置
```env
# 是否使用SSL (通常465端口使用)
REACT_APP_SMTP_SECURE=true

# 是否拒绝未授权的TLS证书
REACT_APP_SMTP_TLS_REJECT=false
```

## 🎨 邮件模板自定义

邮件模板位于 `src/services/emailService.js` 中的 `emailTemplates` 对象：

- `activation`: 账户激活邮件
- `passwordReset`: 密码重置邮件  
- `adminNotification`: 管理员通知邮件

每个模板支持 HTML 和纯文本格式。

## 🧪 测试邮件配置

1. 以超级管理员身份登录 (`admin@bobstudio.com` / `admin123`)
2. 访问管理端 `/admin`
3. 在"邮件服务状态"面板中点击"测试邮件"
4. 检查您的邮箱是否收到测试邮件

## 📊 邮件发送状态监控

管理端提供实时邮件服务状态监控：

- **服务状态**: 已启用/已禁用
- **当前提供商**: 正在使用的SMTP提供商
- **已发送邮件**: 当前时间窗口内已发送数量
- **发送限制**: 发送数量/最大限制

## 🔍 故障排除

### 常见问题

1. **认证失败**
   - 检查用户名和密码是否正确
   - 确认已启用"不太安全的应用访问"或使用应用专用密码

2. **连接超时**
   - 检查SMTP服务器地址和端口
   - 确认网络防火墙设置

3. **SSL/TLS错误**
   - 尝试设置 `REACT_APP_SMTP_TLS_REJECT=false`
   - 检查端口配置（587通常不使用SSL，465使用SSL）

### 调试模式

开发环境下可以禁用邮件发送，使用控制台输出：

```env
REACT_APP_EMAIL_ENABLED=false
```

### 支持的SMTP端口

- **587**: STARTTLS (推荐)
- **465**: SSL/TLS 
- **25**: 不加密 (不推荐)

## 🌟 支持的邮件服务商

| 服务商 | 配置名称 | SMTP服务器 | 端口 | 加密方式 |
|--------|----------|------------|------|----------|
| Gmail | `gmail` | smtp.gmail.com | 587 | STARTTLS |
| Outlook | `outlook` | smtp-mail.outlook.com | 587 | STARTTLS |
| QQ邮箱 | `qq` | smtp.qq.com | 587 | STARTTLS |
| 163邮箱 | `netease163` | smtp.163.com | 587 | STARTTLS |
| 自定义 | `custom` | 自定义 | 自定义 | 自定义 |

## 🔒 安全建议

1. **使用应用专用密码**而不是账户密码
2. **启用两步验证**提高账户安全性
3. **定期更换授权码**
4. **不要在代码中硬编码密码**，始终使用环境变量
5. **生产环境使用加密连接**

## 📱 生产环境部署

在生产环境中部署时：

1. 确保 `.env` 文件不被提交到版本控制
2. 使用环境变量或密钥管理服务
3. 启用邮件发送: `REACT_APP_EMAIL_ENABLED=true`
4. 配置适当的发送限制
5. 监控邮件发送状态和错误日志

---

**注意**: 当前实现是前端模拟的邮件服务。在真实的生产环境中，建议将邮件发送功能移至后端服务，以保护SMTP凭据安全。