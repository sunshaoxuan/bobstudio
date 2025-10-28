import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, requireAdmin = false }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return null;
  }

  // 未登录用户，跳转到登录页
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // 已登录但权限不足（非管理员访问管理端），跳转到用户工作台
  if (requireAdmin && !currentUser.isSuperAdmin) {
    console.warn('⚠️ 非管理员尝试访问管理端，已重定向到工作台');
    return <Navigate to="/studio" replace />;
  }

  return children;
};

export default ProtectedRoute;

