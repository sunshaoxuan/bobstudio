# BOB Studio

🎨 面向团队与个人创作者的 AI 图像工作室解决方案

## 📋 项目简介

BOB Studio 提供完整的 AI 图像生成平台，支持用户管理、会话历史、API Key 管控以及多种图像生成模式。基于 React + Node.js/Express 构建，适用于私有化部署。

## ✨ 核心功能

### 🔐 用户管理
- Session 认证，角色权限控制
- 邮件激活注册
- API Key 加密存储（AES-256-GCM）
- 30张体验额度自动管理

### 🎨 图像生成
- 文本生图（Text-to-Image）
- 图像编辑（Image Edit）
- 图像合成（Image Compose）
- 后端 Google API 代理（解决网络屏蔽）

### 📊 数据管理
- 历史记录逻辑删除
- 实时统计刷新
- 管理员全局视图
- 图片本地存储

### 👨‍💼 管理功能
- 用户CRUD管理
- API Key分配与监控
- 使用统计与分析
- 已删除记录可见

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 8+

### 开发环境
```bash
# 安装依赖
npm install

# 启动后端（端口8080）
npm run server

# 启动前端（端口3000）
npm start
```

### 生产部署
```bash
# 构建前端
npm run build

# 启动服务
npm run server

# 或使用 systemd（推荐）
sudo systemctl start bobstudio
```

## 📝 环境配置

复制 `env.example` 为 `.env`：

```env
# 基础配置
NODE_ENV=production
PORT=8080
SESSION_SECRET=your-strong-secret
API_KEY_ENCRYPTION_SECRET=your-encryption-secret

# 邮件配置
SMTP_HOST=mail.briconbric.com
SMTP_PORT=465
SMTP_USER=postmaster@briconbric.com
SMTP_PASS=your-password
SITE_URL=https://your-domain.com
```

## 🗂️ 项目结构

```
├── server.cjs              # Node.js 后端服务
├── users.json              # 用户数据存储
├── history/                # 图像历史记录
├── images/                 # 上传图片存储
├── sessions/               # Session 文件
├── src/
│   ├── components/         # React 组件
│   │   ├── Studio.js       # 工作室主界面
│   │   ├── Admin/          # 管理后台
│   │   └── Stats.js        # 统计页面
│   ├── contexts/           # React Context
│   └── services/           # API 服务
└── CHANGELOG.md            # 完整文档和版本记录
```

## 📖 API 概览

### 认证
```
POST   /api/auth/login              # 登录
POST   /api/auth/logout             # 登出
GET    /api/auth/me                 # 获取当前用户
POST   /api/auth/register           # 注册
GET    /api/auth/activate/:token    # 激活账号
```

### 用户管理（管理员）
```
GET    /api/admin/users             # 获取用户列表
POST   /api/admin/users             # 创建用户
PUT    /api/admin/users/:id         # 更新用户
DELETE /api/admin/users/:id         # 删除用户
POST   /api/admin/users/:id/api-key # 设置API Key
GET    /api/admin/users/:id/api-key # 获取API Key
```

### 图像生成
```
POST   /api/gemini/generate         # Google API 代理
POST   /api/upload                  # 上传图片
```

### 历史记录
```
GET    /api/history/:userId         # 获取历史
POST   /api/history/:userId         # 保存历史
DELETE /api/history/:userId         # 清空历史
```

### 统计
```
GET    /api/stats?scope=self        # 个人统计
GET    /api/stats?scope=summary     # 全局统计（管理员）
GET    /api/stats?scope=user&userId=xxx  # 指定用户（管理员）
```

## 🔒 安全设计

1. **API Key 加密**：AES-256-GCM 加密存储
2. **Session 管理**：express-session + file-store
3. **权限控制**：基于角色的访问控制（RBAC）
4. **数据隔离**：用户只能访问自己的数据

## 📊 功能特性

### 30张图片限制
- 自注册用户：需自行配置 API Key
- 管理员分配：30张体验额度，用完自动清空
- 计数规则：包括已删除记录

### 逻辑删除
- 删除标记为 `deleted: true`
- 统计数据包括已删除（反映真实成本）
- 普通用户不可见，管理员可见红色标签

### 后端代理
- 解决中国用户 Google API 访问问题
- 所有请求通过服务器代理
- 详细日志记录（用户、模式、耗时）

## 📚 文档

- **[CHANGELOG.md](./CHANGELOG.md)** - 完整的版本记录、配置说明、部署指南

## 🛠️ 技术栈

### 后端
- Node.js + Express
- express-session
- nodemailer
- crypto-js

### 前端
- React 18.3.1
- React Router 6.28.0
- Vite 6.4.1
- Tailwind CSS
- Lucide React
- Recharts

### 部署
- Ubuntu + Systemd
- Nginx 反向代理
- Git 版本控制

## 🤝 贡献指南

```bash
# 1. Fork 项目
# 2. 创建功能分支
git checkout -b feature/amazing-feature

# 3. 提交更改
git commit -m "Add: amazing feature"

# 4. 推送到分支
git push origin feature/amazing-feature

# 5. 创建 Pull Request
```

## 📄 许可证

本项目仅供内部使用，未开放公开许可。

## 📞 联系方式

- 项目维护：BOB Studio Team
- 网站：https://studio.briconbric.com
- 邮箱：postmaster@briconbric.com

---

**最后更新**：2025-10-28  
**版本**：1.0.0  
**状态**：✅ 正常维护
