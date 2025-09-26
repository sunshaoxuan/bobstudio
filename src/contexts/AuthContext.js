import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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

  const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include' // 包含cookies
      });
      
      if (response.ok) {
        const data = await response.json();
        const normalizedUser = normalizeUser(data.user);
        setCurrentUser(normalizedUser);
        console.log('✅ 用户已登录:', data.user.username);
      } else {
        setCurrentUser(null);
        console.log('❌ 用户未登录');
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  // 检查当前登录状态
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  // 用户登录
  const login = async (identifier, password) => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login?ts=${Date.now()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 包含cookies
        body: JSON.stringify({ 
          identifier: typeof identifier === 'string' ? identifier.trim() : '',
          password 
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        const normalizedUser = normalizeUser(data.user);
        setCurrentUser(normalizedUser);
        console.log('✅ 登录成功:', data.user.username);
        return { success: true, message: data.message };
      } else {
        return { success: false, message: data.error };
      }
    } catch (error) {
      console.error('登录失败:', error);
      return { success: false, message: '网络连接失败，请重试' };
    }
  };

  // 用户登出
  const logout = async () => {
    try {
      console.log('🚪 执行退出登录');
      
      const response = await fetch(`${API_BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include', // 包含cookies
      });

      if (response.ok) {
        setCurrentUser(null);
        setStats({ loading: false, scope: 'self', payload: null });
        console.log('✅ 退出成功');
        window.location.href = '/login';
      } else {
        console.error('退出失败');
        // 即使服务器退出失败，也强制清空前端状态
        setCurrentUser(null);
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('退出请求失败:', error);
      // 网络错误时也强制退出
      setCurrentUser(null);
      window.location.href = '/login';
    }
  };

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
      const response = await fetch(`${API_BASE}/api/stats?${params.toString()}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || '获取统计数据失败');
      }

      const data = await response.json();
      setStats({ loading: false, scope: data.scope, payload: data, requestedScope: options.scope || 'self' });
      return { success: true, data };
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setStats({ loading: false, scope: 'self', payload: null, requestedScope: options.scope || 'self' });
      return { success: false, error: error.message };
    }
  }, [API_BASE, currentUser]);

  const value = {
    currentUser,
    loading,
    login,
    logout,
    checkAuthStatus,
    fetchStats,
    statsState: stats
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};