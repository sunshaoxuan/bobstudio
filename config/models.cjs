/**
 * AI 模型配置
 * 统一管理所有 AI 模型参数，方便后续修改和维护
 */

module.exports = {
  // Gemini API 基础URL
  GEMINI_API_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/models",
  
  // 提示词优化模型（文本模型）
  optimize: {
    // 主模型（用于提示词优化）
    primary: process.env.GEMINI_OPTIMIZE_MODEL || "gemini-3-pro-preview",
    // 回退模型（当主模型失败时使用）
    fallback: process.env.GEMINI_OPTIMIZE_FALLBACK_MODEL || "gemini-2.0-flash-exp",
    // 生成配置
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 500,
    }
  },
  
  // 图像生成模型
  image: {
    // 图像生成模型（文本生图/图像编辑/图像合成）
    // 使用最新的 Gemini 3.0 Pro 图像生成模型（2025年11月发布）
    // 注意：邮件提到的 gemini-2.5-flash-image-preview 停用不影响此模型
    model: process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview",
  },
  
  // 获取完整的模型API端点
  getOptimizeEndpoint: function(modelId) {
    return `${this.GEMINI_API_BASE_URL}/${modelId}:generateContent`;
  },
  
  // 获取图像生成API端点
  getImageEndpoint: function() {
    return `${this.GEMINI_API_BASE_URL}/${this.image.model}:generateContent`;
  }
};
