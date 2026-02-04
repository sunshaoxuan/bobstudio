# AI 模型配置说明

## 概述

`models.cjs` 文件统一管理项目中所有 AI 模型的配置参数。**所有配置均从 `.env` 环境变量读取**，不再硬编码默认值。

## 配置项说明

### 必需的环境变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `GEMINI_API_BASE_URL` | Gemini API 基础 URL | `https://generativelanguage.googleapis.com/v1beta/models` |
| `GEMINI_TEXT_MODEL` | 文本模型（提示词优化） | `gemini-3-flash` |
| `GEMINI_IMAGE_MODEL` | 图像生成模型 | `gemini-3-pro-image-preview` |

### 可选的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `GEMINI_TEXT_TEMPERATURE` | 文本生成温度参数（0.0-1.0） | `0.7` |
| `GEMINI_TEXT_MAX_TOKENS` | 文本最大输出 token 数 | `500` |

## .env 配置示例

```env
# ===== AI 模型配置（必填）=====
GEMINI_API_BASE_URL=https://generativelanguage.googleapis.com/v1beta/models

# 文本模型 - gemini-3-flash 性价比最高
GEMINI_TEXT_MODEL=gemini-3-flash

# 图像生成模型 - gemini-3-pro-image-preview 目前最好
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview

# 文本模型生成参数（可选）
GEMINI_TEXT_TEMPERATURE=0.7
GEMINI_TEXT_MAX_TOKENS=500
```

## 使用方法

在代码中引入配置：

```javascript
const modelConfig = require("./config/models.cjs");

// 文本模型
const textModel = modelConfig.text.model;
const generationConfig = modelConfig.text.generationConfig;

// 图像生成模型
const imageModel = modelConfig.image.model;

// 获取 API 端点
const textEndpoint = modelConfig.getTextEndpoint();
const imageEndpoint = modelConfig.getImageEndpoint();
```

## 当前推荐模型

| 用途 | 推荐模型 | 说明 |
|------|----------|------|
| 文本/提示词优化 | `gemini-3-flash` | 性价比最高的语言模型 |
| 图像生成 | `gemini-3-pro-image-preview` | 目前最好的生图模型 |
