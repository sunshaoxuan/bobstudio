# AI 模型配置说明

## 概述

`models.js` 文件统一管理项目中所有 AI 模型的配置参数，包括：
- 提示词优化模型（文本模型）
- 图像生成模型

## 配置项说明

### 1. 提示词优化模型（optimize）

用于优化用户输入的提示词，提升图像生成质量。

- **primary**: 主模型，默认 `gemini-3-pro-preview`
- **fallback**: 回退模型，当主模型失败时使用，默认 `gemini-2.0-flash-exp`
- **generationConfig**: 生成配置
  - `temperature`: 温度参数，控制输出的随机性（0.0-1.0），默认 0.7
  - `maxOutputTokens`: 最大输出 token 数，默认 500

### 2. 图像生成模型（image）

用于实际的图像生成、编辑和合成。

- **model**: 图像生成模型，默认 `gemini-3-pro-image-preview`（最新的 Gemini 3.0 Pro 图像生成模型，2025年11月发布）

## 环境变量配置

可以通过环境变量覆盖默认配置，在 `.env` 文件中设置：

```env
# 提示词优化模型
GEMINI_OPTIMIZE_MODEL=gemini-3-pro-preview
GEMINI_OPTIMIZE_FALLBACK_MODEL=gemini-2.0-flash-exp

# 图像生成模型
GEMINI_IMAGE_MODEL=gemini-3-pro-image-preview
```

## 使用方法

在代码中引入配置：

```javascript
const modelConfig = require("./config/models");

// 使用提示词优化模型
const primaryModel = modelConfig.optimize.primary;
const fallbackModel = modelConfig.optimize.fallback;
const generationConfig = modelConfig.optimize.generationConfig;

// 使用图像生成模型
const imageModel = modelConfig.image.model;

// 获取 API 端点
const optimizeEndpoint = modelConfig.getOptimizeEndpoint(modelId);
const imageEndpoint = modelConfig.getImageEndpoint();
```

## 修改模型

如需更换模型，只需：

1. 修改 `config/models.js` 中的默认值，或
2. 在 `.env` 文件中设置对应的环境变量

无需修改业务代码，所有模型引用会自动使用新配置。
