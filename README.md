# BOB Studio 项目说明

BOB Studio 是一套面向团队与个人创作者的 AI 图像工作室解决方案，提供用户管理、会话历史存档、API Key 管控以及多种图像生成模式。项目基于 React 前端与 Node.js/Express 后端构建，适用于私有化部署或企业内网场景。

## 项目结构

```
├── server.js                 // Node.js 后端服务，负责鉴权、用户管理、历史记录等
├── users.json                // 轻量用户数据存储（默认采用本地 JSON 文件，可扩展为数据库）
├── history/                  // 每位用户的图像生成历史文件
├── src/
│   ├── components/           // 前端视图组件（Studio、Admin、Stats 等）
│   ├── contexts/             // React Context（认证状态、统计信息）
│   ├── config/               // 系统级配置项
│   └── ...
└── README.md
```

## 核心功能

- **用户认证与 Session 管理**：基于 Express Session 实现登录态维持，支持管理员与普通用户的角色划分。
- **用户后台（Admin Dashboard）**：
  - 创建/删除用户、激活状态开关
  - API Key 管控：可统一配置或允许用户自助维护
  - 重置密码、历史统计概览
- **工作室前端（Studio）**：
  - 文本生成图像、图像编辑/合成等模式
  - 支持上传素材、查看生成历史、导出备份
  - 自助配置 API Key（若管理员开通）
- **统计中心（Stats）**：
  - 普通用户查看个人数据
  - 管理员查看整体概览及按用户维度的使用量
- **历史记录持久化**：按用户 ID 存储至 `history/history-*.json`，并提供读取、保存、清理接口。
- **安全与合规**：
  - API Key 加密存储（AES-256-GCM），避免明文落盘
  - 会话态重新同步用户信息，确保状态实时更新
  - 支持配置开发/生产环境的跨域策略与 Session 安全项

## 系统架构

```
[React 前端]  <->  [Express/Node.js 后端]  <->  [本地 JSON / 可选数据库]
```

- 前端通过 `fetch` 与后端 RESTful 接口交互，默认端口：
  - 前端开发：`http://localhost:3000`
  - 后端服务：默认监听 8080（会自动回退到备用端口）
- `users.json` 与 `history/` 目录可替换为数据库实现（如 MongoDB / PostgreSQL）。

## 环境与依赖

- Node.js 18+
- npm 8+
- 主要依赖：React 19、React Router 6、Express 4、express-session、lucide-react、Recharts 等

### 环境变量

复制 `env.example` 为 `.env`，根据需求设置：

| 变量 | 说明 |
| --- | --- |
| `NODE_ENV` | 环境标记（development/production） |
| `API_KEY_ENCRYPTION_SECRET` | API Key 加密密钥（必须更换为高强度值） |
| 邮件相关变量 | 用于账号激活/通知的 SMTP 配置，可参考 `SMTP_CONFIG.md` |

## 本地开发

```bash
npm install         # 安装依赖
npm run server      # 启动后端服务（默认 8080）
npm start           # 启动前端开发服务器（默认 3000）
```

> 提示：`npm run dev` 可并行启动前后端。

## 编译与发布

```bash
npm run build       # 构建前端生产包
npm run server      # 在生产环境启动后端（需自行配置进程守护）
```

> 每次提交代码前需执行 `npm run build` 确保编译通过。

前端构建产物位于 `build/`，后端可通过 Nginx/AP的 或直接 Node 运行，建议结合 PM2 等管理工具。

## API 概览

- 认证：`POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
- 用户管理（管理员）：
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `PUT /api/admin/users/:id`
  - `DELETE /api/admin/users/:id`
  - `POST /api/admin/users/:id/reset-password`
  - `POST /api/admin/users/:id/api-key`
  - `GET /api/admin/users/:id/api-key`
- 用户自助 API Key：`POST /api/me/api-key`
- 图像历史：`GET/POST/DELETE /api/history/:userId`
- 统计：`GET /api/stats?scope=self|summary|user`

## 安全设计

1. **API Key 加密存储**：
   - 使用 AES-256-GCM，加密后的密文保存在 `users.json` 中。
   - 支持旧数据迁移：发现明文 `apiKey` 会自动加密。
2. **权限控制**：管理员可控制用户是否可自助配置 API Key；普通用户永远无法读取其他用户配置。
3. **Session 管理**：登录后返回 `session.user`，并在 `GET /api/auth/me` 中实时刷新。

## 常见问题

| 问题 | 说明 |
| --- | --- |
| 构建失败 | 检查 `npm run build` 输出，确保终端环境变量正确设置 |
| API Key 不生效 | 管理端确认 `showApiConfig`、`hasApiKey` 状态，并检查密钥有效性 |
| 历史记录缺失 |确认 `history` 目录存在写入权限，或查看后端日志 |

## 扩展建议

- 将用户数据迁移至数据库（MongoDB / PostgreSQL），以支持更复杂的搜索和审计。
- 集成 OAuth / 单点登录体系，提升企业环境兼容性。
- 引入队列系统或云函数处理高并发图像生成请求。

---

如需更多参考，可查看以下文档：
- `SERVER_SETUP.md`：后端部署指南
- `SMTP_CONFIG.md`：邮件服务配置
- `src/services/`：前端服务请求封装
