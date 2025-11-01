import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import Navigation from './Navigation';
import {
  User,
  Key,
  Edit,
  Save,
  Bell,
  Check,
} from 'lucide-react';

const Profile = () => {
  const { currentUser, changePassword, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // 个人资料编辑
  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  // 初始化个人资料
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || currentUser.username || '');
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  // 加载通知
  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('加载通知失败');
      const data = await res.json();
      const notifs = Array.isArray(data.notifications) ? data.notifications : [];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.read).length);
    } catch (error) {
      console.error('加载通知失败:', error);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    loadNotifications();
    
    // 定时刷新通知
    const interval = setInterval(loadNotifications, 30000); // 每30秒
    return () => clearInterval(interval);
  }, [currentUser, navigate, loadNotifications]);

  // 保存个人资料
  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ displayName, email })
      });
      
      if (!res.ok) throw new Error('更新失败');
      const data = await res.json();
      
      await refreshUser(); // 刷新用户信息
      setEditMode(false);
      alert(`✅ ${data.message}`);
    } catch (error) {
      console.error('更新个人资料失败:', error);
      alert('更新失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 标记通知为已读
  const markAsRead = async (notificationId) => {
    try {
      await fetch(`${API_BASE_URL}/api/notifications/${notificationId}/read`, {
        method: 'POST',
        credentials: 'include'
      });
      await loadNotifications();
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 全部标记为已读
  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      await Promise.all(
        unread.map(n => 
          fetch(`${API_BASE_URL}/api/notifications/${n.id}/read`, {
            method: 'POST',
            credentials: 'include'
          })
        )
      );
      await loadNotifications();
    } catch (error) {
      console.error('全部标记已读失败:', error);
    }
  };

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100">
      <Navigation />

      <div className="max-w-4xl mx-auto p-6">
        {/* 通知提醒 */}
        {notifications.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Bell className="w-5 h-5" />
                消息通知
                {unreadCount > 0 && (
                  <span className="text-sm px-2 py-1 bg-red-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </h2>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  全部标记为已读
                </button>
              )}
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {notifications.map(notif => (
                <div 
                  key={notif.id} 
                  className={`rounded-lg p-4 flex items-start justify-between ${
                    notif.read 
                      ? 'bg-gray-50 opacity-60' 
                      : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{notif.title}</span>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{notif.message}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(notif.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  {!notif.read && (
                    <button
                      onClick={() => markAsRead(notif.id)}
                      className="ml-2 p-2 text-green-600 hover:bg-green-50 rounded-full"
                      title="标记为已读"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 个人档案卡片 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              个人档案
            </h2>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit className="w-4 h-4" />
                编辑资料
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDisplayName(currentUser.displayName || currentUser.username || '');
                    setEmail(currentUser.email || '');
                    setEditMode(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={saveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                用户名
                <span className="ml-2 text-xs text-gray-400">（不可更改，用于登录）</span>
              </label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                <span className="text-lg font-medium">{currentUser.username}</span>
                {currentUser.isSuperAdmin && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                    👑 超级管理员
                  </span>
                )}
              </div>
            </div>
            
            {/* 显示名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                显示名称
                <span className="ml-2 text-xs text-gray-400">（可自定义昵称）</span>
              </label>
              {editMode ? (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入显示名称"
                />
              ) : (
                <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <span className="text-lg">{currentUser.displayName || currentUser.username}</span>
                </div>
              )}
            </div>
            
            {/* 邮箱 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址
              </label>
              {editMode ? (
                <>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="输入新邮箱"
                  />
                  <p className="text-xs text-orange-600 mt-2 bg-orange-50 p-2 rounded">
                    ⚠️ 修改邮箱需要验证，验证邮件将发送到新邮箱地址
                  </p>
                </>
              ) : (
                <>
                  <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <span className="text-lg">{currentUser.email}</span>
                  </div>
                  {currentUser.pendingEmail && (
                    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-sm text-orange-700">
                        📧 待验证邮箱: <strong>{currentUser.pendingEmail}</strong>
                      </p>
                      <p className="text-xs text-orange-600 mt-1">
                        请查收验证邮件并点击链接完成验证
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {/* 账户状态 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                账户状态
              </label>
              <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  currentUser.isActive 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {currentUser.isActive ? '✓ 已激活' : '✗ 未激活'}
                </span>
              </div>
            </div>
            
            {/* 修改密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                账户安全
              </label>
              <button
                onClick={async () => {
                  if (window.confirm('系统将发送验证邮件到您的注册邮箱，确认继续吗？')) {
                    const result = await changePassword();
                    if (result.success) {
                      alert(`✅ ${result.message}\n\n请查收邮件并点击链接完成密码修改。`);
                    } else {
                      alert(`❌ ${result.message}`);
                    }
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <Key className="w-4 h-4" />
                修改密码
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

