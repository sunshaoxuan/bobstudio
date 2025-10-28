# API Key 使用限制说明

## 📋 功能概述

为了合理管理 API 成本，系统实现了以下用户管理逻辑：

## 🎯 用户类型与 API Key 配置

### 1️⃣ 自注册用户
- **默认状态**：无 API Key
- **使用方式**：需要自行配置 Google Gemini API Key
- **获取方法**：访问 https://aistudio.google.com/apikey

### 2️⃣ 管理员分配 API Key 的用户
- **初始状态**：管理员为用户配置 API Key（体验额度）
- **限制**：生成 **30 张图片**后自动清空 API Key
- **后续使用**：需要用户自行配置 API Key 继续使用

## 🔑 30 张图片限制机制

### 计数规则
```javascript
// 统计包括所有记录（包括已删除的）
// 因为生成过就产生了 API 成本
const totalCount = historyData.length; // 包括 deleted: true 的记录
```

### 自动清空逻辑
```javascript
// server.cjs - updateUserStats 函数
const FREE_GENERATION_LIMIT = 30;

if (totalCount >= FREE_GENERATION_LIMIT && user.apiKeyEncrypted) {
  user.apiKeyEncrypted = "";
  user.showApiConfig = false;
  console.log(`🔒 用户已生成 ${totalCount} 张图片，已自动清空API Key`);
}
```

### 用户提示
当达到 30 张限制时，系统会：
1. ✅ 自动清空管理员分配的 API Key
2. ✅ 弹窗提示用户
3. ✅ 告知如何获取自己的 API Key
4. ✅ 刷新用户信息

## 📊 用户体验流程

### 管理员分配体验额度
```
注册 → 管理员分配 API Key → 生成 1-30 张图片 → 达到限制 → 弹窗提示 → 用户自行配置
```

### 自注册用户
```
注册 → 自行配置 API Key → 无限制使用
```

## 💡 前端提示信息

### 达到30张限制
```javascript
"🎉 您已完成 30 张图片的免费体验！

管理员分配的体验 API Key 已自动清空。
请在右上角个人信息中配置您自己的 Google Gemini API Key 继续使用。

如何获取 API Key：
1. 访问 https://aistudio.google.com/apikey
2. 创建并复制您的 API Key
3. 在个人信息中填入 API Key 即可继续创作"
```

### 没有 API Key 时
```javascript
"需要配置 API Key

请在右上角个人信息中配置您的 Google Gemini API Key。

获取方法：访问 https://aistudio.google.com/apikey 创建免费 API Key"
```

## 🔧 技术实现

### 后端逻辑（server.cjs）

#### 1. 统计更新时检查限制
```javascript
const updateUserStats = async (userId, historyData) => {
  // ... 计算统计 ...
  
  // 检查是否达到限制
  const FREE_GENERATION_LIMIT = 30;
  if (totalCount >= FREE_GENERATION_LIMIT && user.apiKeyEncrypted) {
    user.apiKeyEncrypted = "";
    user.showApiConfig = false;
  }
  
  return { apiKeyCleared: totalCount >= FREE_GENERATION_LIMIT && user.apiKeyEncrypted === "" };
};
```

#### 2. 保存历史记录时返回状态
```javascript
app.post("/api/history/:userId", async (req, res) => {
  // ... 保存历史 ...
  
  const statsResult = await updateUserStats(userId, historyData);
  
  res.json({ 
    message: "History saved successfully",
    recordCount: historyData.length,
    apiKeyCleared: statsResult?.apiKeyCleared || false,
    reachedLimit: historyData.length >= 30
  });
});
```

### 前端逻辑（Studio.js）

#### 3. 保存历史后检查状态
```javascript
const saveHistoryToServer = useCallback(async (historyData, userId) => {
  // ... 保存请求 ...
  
  if (result.apiKeyCleared) {
    alert("🎉 您已完成 30 张图片的免费体验！\n\n...");
    refreshUserInfo(currentUser.id); // 刷新用户信息
  }
}, [currentUser, refreshUserInfo]);
```

## 📈 统计显示

### 用户统计数据结构
```javascript
user.generationStats = {
  today: 5,        // 今日生成
  thisMonth: 28,   // 本月生成
  total: 30        // 总计生成（包括已删除）
};
```

### 管理员可见信息
- ✅ 查看用户总生成数
- ✅ 查看已删除记录数
- ✅ 所有历史记录（含已删除标记）

## 🎯 业务逻辑总结

| 用户类型 | API Key 来源 | 限制 | 达到限制后 |
|---------|-------------|------|-----------|
| **自注册** | 用户自己配置 | 无限制 | - |
| **管理员体验** | 管理员分配 | 30 张 | 自动清空，需用户自行配置 |

## ⚠️ 注意事项

1. **计数包括已删除**：删除图片不会减少计数，因为生成过就产生了成本
2. **自动清空不可逆**：达到 30 张后自动清空，无法恢复
3. **用户需自行配置**：清空后必须用户自己配置 API Key
4. **体验友好**：提供详细的获取 API Key 指引

## 🚀 部署说明

1. 代码已推送到仓库
2. 服务器重启后生效
3. 不影响现有用户（只在达到限制时触发）
4. 管理员可继续为新用户分配体验 API Key

---

**更新日期**：2025-10-28  
**功能状态**：✅ 已实现并测试

