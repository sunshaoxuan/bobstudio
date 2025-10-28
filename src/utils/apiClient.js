/**
 * 统一的 API 客户端
 * 提供超时控制、错误处理、重试逻辑
 */

import { API_BASE_URL, API_TIMEOUT, DEFAULT_OPTIONS } from '../config/api';

/**
 * 带超时的 fetch
 * @param {string} url - 请求URL
 * @param {object} options - fetch选项
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<Response>}
 */
export const fetchWithTimeout = async (url, options = {}, timeout = API_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`请求超时（${timeout / 1000}秒）`);
    }
    throw error;
  }
};

/**
 * 统一的 API 请求函数
 * @param {string} endpoint - API端点（如 '/api/auth/login'）
 * @param {object} options - 请求选项
 * @param {object} config - 额外配置
 * @returns {Promise<any>} 返回解析后的JSON数据
 */
export const apiRequest = async (endpoint, options = {}, config = {}) => {
  const {
    timeout = API_TIMEOUT,
    retry = false,
    maxRetries = 3,
    retryDelay = 1000,
  } = config;

  const url = `${API_BASE_URL}${endpoint}`;
  const finalOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    headers: {
      ...DEFAULT_OPTIONS.headers,
      ...(options.headers || {}),
    },
  };

  let lastError = null;
  const maxAttempts = retry ? maxRetries : 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🌐 API请求 [${attempt}/${maxAttempts}]: ${options.method || 'GET'} ${endpoint}`);

      const response = await fetchWithTimeout(url, finalOptions, timeout);

      console.log(`📡 响应状态: ${response.status} ${response.statusText}`);

      // 处理响应
      if (response.ok) {
        // 尝试解析JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          console.log(`✅ 请求成功`);
          return data;
        }
        // 如果不是JSON，返回text
        const text = await response.text();
        return text;
      }

      // 处理错误响应
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText || response.statusText };
      }

      const error = new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = errorData;

      // 不重试的错误（4xx客户端错误）
      if (response.status >= 400 && response.status < 500) {
        throw error;
      }

      // 5xx服务器错误可以重试
      lastError = error;
      if (attempt < maxAttempts) {
        console.warn(`⚠️ 请求失败，${retryDelay}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      throw error;

    } catch (error) {
      lastError = error;

      // 网络错误可以重试
      if (attempt < maxAttempts && (error.message.includes('网络') || error.message.includes('超时') || error.message.includes('fetch'))) {
        console.warn(`⚠️ ${error.message}，${retryDelay}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
};

/**
 * GET 请求
 */
export const apiGet = (endpoint, config = {}) => {
  return apiRequest(endpoint, { method: 'GET' }, config);
};

/**
 * POST 请求
 */
export const apiPost = (endpoint, data = null, config = {}) => {
  return apiRequest(
    endpoint,
    {
      method: 'POST',
      body: data ? JSON.stringify(data) : null,
    },
    config
  );
};

/**
 * PUT 请求
 */
export const apiPut = (endpoint, data = null, config = {}) => {
  return apiRequest(
    endpoint,
    {
      method: 'PUT',
      body: data ? JSON.stringify(data) : null,
    },
    config
  );
};

/**
 * DELETE 请求
 */
export const apiDelete = (endpoint, config = {}) => {
  return apiRequest(endpoint, { method: 'DELETE' }, config);
};

/**
 * 上传文件请求（multipart/form-data）
 */
export const apiUpload = (endpoint, formData, config = {}) => {
  return apiRequest(
    endpoint,
    {
      method: 'POST',
      body: formData,
      headers: {
        // 不设置 Content-Type，让浏览器自动设置 multipart/form-data
      },
    },
    config
  );
};

