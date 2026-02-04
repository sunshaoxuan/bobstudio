/**
 * API 配置
 */

// API 基础URL（生产环境使用同域相对路径；需要指定时设置 VITE_API_URL）
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// API 超时配置（毫秒）
export const API_TIMEOUT = 300000; // 5分钟

// 请求默认配置
export const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
};

// 请求默认选项
export const DEFAULT_OPTIONS = {
  credentials: "include", // 包含cookies
  headers: DEFAULT_HEADERS,
};

