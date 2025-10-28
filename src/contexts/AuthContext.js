import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost } from '../utils/apiClient';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 规范化邮箱：去首尾空格并转小写
const defaultStats = {
  today: 0,
  thisMonth: 0,
  total: 0
};

const normalizeUser = (user) => {
  if (!user) return null;

  const stats = user.generationStats;
  const normalizedStats = stats && typeof stats === 'object'
    ? {
        today: Number.isFinite(stats.today) ? stats.today : 0,
        thisMonth: Number.isFinite(stats.thisMonth) ? stats.thisMonth : 0,
        total: Number.isFinite(stats.total) ? stats.total : 0
      }
    : { ...defaultStats };

  return {
    ...user,
    generationStats: normalizedStats,
    showApiConfig: Boolean(user.showApiConfig),
    isActive: Boolean(user.isActive),
    isSuperAdmin: Boolean(user.isSuperAdmin)
  };
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ loading: false, scope: 'self', payload: null, requestedScope: 'self' });

  const checkAuthStatus = useCallback(async () => {
    try {
      const data = await apiGet('/api/auth/me');
      const normalizedUser = normalizeUser(data.user);
      setCurrentUser(normalizedUser);
      console.log('✅ 用户已登录:', data.user.username);
    } catch (error) {
      console.error('检查登录状态失败:', error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // 检查当前登录状态
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // 用户登录
  const login = async (identifier, password) => {
    try {
      console.log('🔗 尝试登录...');
      
      const data = await apiPost('/api/auth/login', {
        identifier: typeof identifier === 'string' ? identifier.trim() : '',
        password 
      });

      const normalizedUser = normalizeUser(data.user);
      setCurrentUser(normalizedUser);
      console.log('✅ 登录成功:', data.user.username);
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 登录异常:', error);
      let errorMessage = error.message || '登录失败';
      if (error.status === 401) {
        errorMessage = '用户名或密码错误';
      } else if (error.status === 403) {
        errorMessage = '账号未激活或已被禁用';
      }
      return { success: false, message: errorMessage };
    }
  };

  // 用户注册
  const register = async (email, password, username) => {
    try {
      const data = await apiPost('/api/auth/register', {
        email: email.trim(),
        password,
        username: username.trim()
      });

      console.log('✅ 注册成功:', username);
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 注册异常:', error);
      return { success: false, message: error.message || '注册失败' };
    }
  };

  // 激活账户
  const activateAccount = async (token) => {
    try {
      const data = await apiGet(`/api/auth/activate/${token}`);
      console.log('✅ 账户激活成功');
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 激活异常:', error);
      return { success: false, message: error.message || '激活失败' };
    }
  };

  // 用户登出
  const logout = async () => {
    try {
      console.log('🚪 执行退出登录');
      await apiPost('/api/auth/logout');
      setCurrentUser(null);
      setStats({ loading: false, scope: 'self', payload: null });
      console.log('✅ 退出成功');
      window.location.href = '/login';
    } catch (error) {
      console.error('退出请求失败:', error);
      // 网络错误时也强制退出
      setCurrentUser(null);
      window.location.href = '/login';
    }
  };

  // 忘记密码
  const forgotPassword = async (username) => {
    try {
      const data = await apiPost('/api/auth/forgot-password', { username: username.trim() });
      console.log('✅ 密码重置请求成功');
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 密码重置请求失败:', error);
      return { success: false, message: error.message || '请求失败' };
    }
  };

  // 重置密码
  const resetPassword = async (token, newPassword) => {
    try {
      const data = await apiPost(`/api/auth/reset-password/${token}`, { newPassword });
      console.log('✅ 密码重置成功');
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 密码重置失败:', error);
      return { success: false, message: error.message || '重置失败' };
    }
  };

  // 修改密码（已登录用户）
  const changePassword = async () => {
    try {
      const data = await apiPost('/api/auth/change-password');
      console.log('✅ 修改密码邮件已发送');
      return { success: true, message: data.message };
    } catch (error) {
      console.error('❌ 修改密码请求失败:', error);
      return { success: false, message: error.message || '请求失败' };
    }
  };

  // 刷新当前用户信息（包括统计数据）
  const refreshUser = useCallback(async () => {
    if (!currentUser) {
      console.log('⚠️ 未登录，无法刷新用户信息');
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const data = await apiGet('/api/auth/refresh');
      const normalizedUser = normalizeUser(data.user);
      setCurrentUser(normalizedUser);
      console.log('🔄 用户信息已刷新:', normalizedUser.generationStats);
      return { success: true, user: normalizedUser };
    } catch (error) {
      console.error('刷新用户信息失败:', error);
      return { success: false, error: error.message };
    }
  }, [currentUser]);

  const fetchStats = useCallback(async (options = {}) => {
    if (!currentUser) {
      setStats({ loading: false, scope: 'self', payload: null });
      return { success: false, error: 'Not authenticated' };
    }

    const params = new URLSearchParams();
    if (options.scope) params.set('scope', options.scope);
    if (options.userId) params.set('userId', options.userId);

    setStats(prev => ({ ...prev, loading: true, requestedScope: options.scope || 'self' }));
    
    try {
      const data = await apiGet(`/api/stats?${params.toString()}`);
      setStats({ loading: false, scope: data.scope, payload: data, requestedScope: options.scope || 'self' });
      return { success: true, data };
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setStats({ loading: false, scope: 'self', payload: null, requestedScope: options.scope || 'self' });
      return { success: false, error: error.message };
    }
  }, [currentUser]);

  const value = {
    currentUser,
    loading,
    login,
    register,
    activateAccount,
    logout,
    forgotPassword,
    resetPassword,
    changePassword,
    checkAuthStatus,
    refreshUser,
    fetchStats,
    statsState: stats
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
