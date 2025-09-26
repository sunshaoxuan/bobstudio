# 服务器端历史记录功能设置

## 概述

BOB Studio 现在支持服务器端历史记录存储，这意味着：
- 🔄 **自动保存**：生成图片后自动保存到服务器
- 🔄 **自动加载**：登录后自动从服务器加载历史记录
- 💾 **持久保存**：历史记录保存在服务器文件中，重启后不会丢失
- 👥 **多用户支持**：每个用户有独立的历史记录文件

## 安装依赖

```bash
npm install express cors concurrently
```

## 启动方式

### 1. 仅启动后端服务器
```bash
npm run server
```
服务器将在端口 3001 运行

### 2. 同时启动前端和后端（开发模式）
```bash
npm run dev
```
- 前端：http://localhost:3000
- 后端：http://localhost:3001

### 3. 生产环境
```bash
npm run build
npm run build:full
```

## 文件结构

```
project/
├── server.js              # 后端服务器
├── history/               # 历史记录存储目录（自动创建）
│   ├── history-user1.json # 用户1的历史记录
│   ├── history-user2.json # 用户2的历史记录
│   └── ...
├── src/                   # 前端源码
└── build/                 # 前端构建文件
```

## API 接口

### 获取历史记录
```
GET /api/history/:userId
```

### 保存历史记录
```
POST /api/history/:userId
Content-Type: application/json

[历史记录数组]
```

### 删除历史记录
```
DELETE /api/history/:userId
```

### 健康检查
```
GET /api/health
```

## 功能特点

1. **自动同步**：所有操作（添加、删除、清空）都会自动同步到服务器
2. **错误处理**：网络错误时不影响本地操作，只在控制台显示警告
3. **用户隔离**：每个用户的历史记录独立存储
4. **备份功能**：仍然支持手动导入/导出功能作为备份

## 注意事项

- 第一次运行时会自动创建 `history/` 目录
- 历史记录文件格式为 JSON，可以手动查看和编辑
- 建议定期备份 `history/` 目录
- 如果需要部署到生产环境，建议使用 PM2 或类似工具管理进程

## 故障排除

### 端口冲突
如果端口 3001 被占用，可以设置环境变量：
```bash
PORT=3002 npm run server
```

### 权限问题
确保应用有权限在项目目录创建 `history/` 文件夹

### 网络问题
如果前端无法连接后端，检查：
1. 后端服务器是否正常启动
2. 端口是否正确
3. CORS 设置是否正确