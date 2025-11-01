import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import {
  Home,
  LogOut,
  UserPlus,
  UserMinus,
  Shield,
  BarChart3,
  Users,
  User,
  Search,
  X,
  Key,
  Edit,
  Save,
  Bell,
  Check,
} from 'lucide-react';

const Friends = () => {
  const { currentUser, logout, changePassword, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // 个人资料编辑
  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  
  // 添加好友
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

  // 初始化个人资料
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || currentUser.username || '');
      setEmail(currentUser.email || '');
    }
  }, [currentUser]);

  // 加载好友列表
  const loadFriends = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/friends`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('加载好友失败');
      const data = await res.json();
      setFriends(Array.isArray(data.friends) ? data.friends : []);
    } catch (error) {
      console.error('加载好友失败:', error);
      alert('加载好友列表失败');
    }
  }, []);

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
    
    const init = async () => {
      setLoading(true);
      await Promise.all([loadFriends(), loadNotifications()]);
      setLoading(false);
    };
    
    init();
    
    // 定时刷新通知
    const interval = setInterval(loadNotifications, 30000); // 每30秒
    return () => clearInterval(interval);
  }, [currentUser, navigate, loadFriends, loadNotifications]);

  // 搜索用户
  const searchUser = async () => {
    if (!searchQuery.trim()) {
      alert('请输入用户名或邮箱');
      return;
    }
    
    setSearching(true);
    setSearchResult(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: searchQuery.trim() })
      });
      
      if (!res.ok) throw new Error('搜索失败');
      const data = await res.json();
      
      if (data.found) {
        // 检查是否已经是好友
        const isFriend = friends.some(f => f.id === data.user.id);
        setSearchResult({
          ...data.user,
          isFriend
        });
      } else {
        alert('未找到该用户，请检查用户名或邮箱是否正确');
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
      alert('搜索失败，请重试');
    } finally {
      setSearching(false);
    }
  };

  // 添加好友
  const addFriend = async (friendId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/friends/${friendId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('添加好友失败');
      
      await Promise.all([loadFriends(), loadNotifications()]);
      setSearchResult(null);
      setSearchQuery('');
      setShowAddModal(false);
      alert('✅ 好友添加成功，对方已收到通知');
    } catch (error) {
      console.error('添加好友失败:', error);
      alert('添加好友失败，请重试');
    }
  };

  // 移除好友
  const removeFriend = async (friendId, friendName) => {
    const friend = friends.find(f => f.id === friendId);
    if (friend?.isSuperAdmin) {
      alert('❌ 无法移除与管理员的默认好友关系');
      return;
    }

    if (!window.confirm(`确定要移除好友「${friendName}」吗？`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/friends/${friendId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '移除好友失败');
      }
      await loadFriends();
      alert('✅ 已移除好友');
    } catch (error) {
      console.error('移除好友失败:', error);
      alert(error.message || '移除好友失败，请重试');
    }
  };

  // 保存个人资料
  const saveProfile = async () => {
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

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                👥 好友管理
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              <Link
                to="/studio"
                className="flex items-center gap-1 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
                title="工作室"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">工作室</span>
              </Link>
              <Link
                to="/stats"
                className="flex items-center gap-1 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
                title="统计"
              >
                <BarChart3 className="w-4 h-4" />
                <span className="hidden sm:inline">统计</span>
              </Link>
              {currentUser.isSuperAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-1 sm:gap-2 text-yellow-600 hover:text-yellow-800 transition-colors text-sm sm:text-base"
                  title="管理端"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">管理端</span>
                </Link>
              )}
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
                className="flex items-center gap-1 sm:gap-2 text-blue-600 hover:text-blue-800 transition-colors text-sm sm:text-base"
                title="修改密码"
              >
                <Key className="w-4 h-4" />
                <span className="hidden sm:inline">修改密码</span>
              </button>
              <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[100px] sm:max-w-none">
                {currentUser.displayName || currentUser.username}
                {currentUser.isSuperAdmin && (
                  <span className="ml-1 text-yellow-600">👑</span>
                )}
              </span>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-red-600 hover:text-red-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                退出
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        {/* 通知提醒 */}
        {unreadCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-blue-600" />
                <span className="text-blue-700 font-medium">
                  您有 {unreadCount} 条未读通知
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
              {notifications.filter(n => !n.read).slice(0, 5).map(notif => (
                <div key={notif.id} className="bg-white rounded p-3 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{notif.title}</div>
                    <div className="text-sm text-gray-600 mt-1">{notif.message}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {new Date(notif.createdAt).toLocaleString('zh-CN')}
                    </div>
                  </div>
                  <button
                    onClick={() => markAsRead(notif.id)}
                    className="ml-2 p-1 text-green-600 hover:bg-green-50 rounded"
                    title="标记为已读"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 个人档案卡片 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              个人档案
            </h2>
            {!editMode ? (
              <button
                onClick={() => setEditMode(true)}
                className="flex items-center gap-2 px-3 py-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                <Edit className="w-4 h-4" />
                编辑
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDisplayName(currentUser.displayName || currentUser.username || '');
                    setEmail(currentUser.email || '');
                    setEditMode(false);
                  }}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={saveProfile}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  保存
                </button>
              </div>
            )}
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">用户名（不可更改）</label>
                <div className="text-lg font-medium flex items-center gap-2">
                  {currentUser.username}
                  {currentUser.isSuperAdmin && (
                    <span className="text-sm px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
                      👑 超级管理员
                    </span>
                  )}
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">显示名称</label>
                {editMode ? (
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="输入显示名称"
                  />
                ) : (
                  <div className="text-lg">{currentUser.displayName || currentUser.username}</div>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">邮箱</label>
                {editMode ? (
                  <>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="输入新邮箱"
                    />
                    <p className="text-xs text-orange-600 mt-1">
                      ⚠️ 修改邮箱需要验证，验证邮件将发送到新邮箱
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-lg">{currentUser.email}</div>
                    {currentUser.pendingEmail && (
                      <p className="text-xs text-orange-600 mt-1">
                        待验证邮箱: {currentUser.pendingEmail}
                      </p>
                    )}
                  </>
                )}
              </div>
              
              <div>
                <label className="text-sm text-gray-500">好友数量</label>
                <div className="text-lg font-medium">{friends.length} 位好友</div>
              </div>
            </div>
          </div>
        </div>

        {/* 好友列表 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="w-5 h-5" />
              我的好友
              <span className="text-sm text-gray-500">({friends.length})</span>
            </h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              添加好友
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-500">加载中...</div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>还没有好友</p>
              <p className="text-sm mt-2">点击右上角「添加好友」按钮开始添加</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map(friend => (
                <div
                  key={friend.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-lg flex items-center gap-2">
                        {friend.displayName || friend.username}
                        {friend.isSuperAdmin && (
                          <span className="text-yellow-600 text-sm">👑</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        @{friend.username}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {friend.email}
                      </div>
                      {friend.isSuperAdmin && (
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded">
                            默认好友（不可移除）
                          </span>
                        </div>
                      )}
                    </div>
                    {!friend.isSuperAdmin && (
                      <button
                        onClick={() => removeFriend(friend.id, friend.displayName || friend.username)}
                        className="ml-2 p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="移除好友"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 添加好友弹窗 */}
      {showAddModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setSearchQuery('');
            setSearchResult(null);
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">添加好友</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                  setSearchResult(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                输入对方的<strong>用户名</strong>或<strong>邮箱</strong>来添加好友
              </p>
              
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="输入用户名或邮箱..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchUser()}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={searchUser}
                  disabled={searching || !searchQuery.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searching ? '搜索中...' : '搜索'}
                </button>
              </div>

              {/* 搜索结果 */}
              {searchResult && (
                <div className="mt-4 border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-lg flex items-center gap-2">
                        {searchResult.displayName || searchResult.username}
                        {searchResult.isSuperAdmin && (
                          <span className="text-yellow-600 text-sm">👑 管理员</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        @{searchResult.username}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {searchResult.email}
                      </div>
                      {searchResult.isFriend && (
                        <div className="mt-2">
                          <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">
                            ✓ 已是好友
                          </span>
                        </div>
                      )}
                    </div>
                    {!searchResult.isFriend && (
                      <button
                        onClick={() => addFriend(searchResult.id)}
                        className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        添加
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  💡 <strong>隐私保护：</strong>系统不会显示用户列表，只能通过精确的用户名或邮箱搜索添加好友
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Friends;
