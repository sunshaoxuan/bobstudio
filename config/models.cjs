/**
 * AI 模型配置
 * 所有配置项均从环境变量读取，请在 .env 文件中配置
 * 默认值来自 env.example，代码中不硬编码
 */

const path = require('path');
const fs = require('fs');

function getDefaultFromExample(key) {
  try {
    const examplePath = path.join(__dirname, '..', 'env.example');
    const content = fs.readFileSync(examplePath, 'utf8');
    const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'm'));
    if (match) {
      const val = match[1].trim().split(/\s+#/)[0].trim();
      return val;
    }
  } catch (_) {}
  return undefined;
}

// 必需的环境变量检查
const requiredEnvVars = [
  'GEMINI_API_BASE_URL',
  'GEMINI_TEXT_MODEL',
  'GEMINI_IMAGE_MODEL',
];

const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingVars.length > 0) {
  console.warn(`⚠️ 缺少模型配置环境变量: ${missingVars.join(', ')}`);
  console.warn('   请在 .env 文件中配置，参考 env.example');
}

module.exports = {
  // Gemini API 基础 URL
  GEMINI_API_BASE_URL: process.env.GEMINI_API_BASE_URL,

  // 文本模型（提示词优化）
  text: {
    model: process.env.GEMINI_TEXT_MODEL,
    generationConfig: (() => {
      const temp = parseFloat(process.env.GEMINI_TEXT_TEMPERATURE || getDefaultFromExample('GEMINI_TEXT_TEMPERATURE'));
      const tokens = parseInt(process.env.GEMINI_TEXT_MAX_TOKENS || getDefaultFromExample('GEMINI_TEXT_MAX_TOKENS'), 10);
      const cfg = {};
      if (Number.isFinite(temp)) cfg.temperature = temp;
      if (Number.isFinite(tokens) && tokens > 0) cfg.maxOutputTokens = tokens;
      return cfg;
    })(),
  },

  // 图像生成模型
  image: {
    model: process.env.GEMINI_IMAGE_MODEL,
  },

  // 获取文本模型 API 端点
  getTextEndpoint: function() {
    return `${this.GEMINI_API_BASE_URL}/${this.text.model}:generateContent`;
  },

  // 获取图像生成 API 端点
  getImageEndpoint: function() {
    return `${this.GEMINI_API_BASE_URL}/${this.image.model}:generateContent`;
  }
};
