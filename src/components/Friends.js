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
} from 'lucide-react';

const Friends = () => {
  const { currentUser, logout, changePassword } = useAuth();
  const navigate = useNavigate();
  
  const [friends, setFriends] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

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

  // 加载所有用户（用于添加好友）
  const loadAllUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/list`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('加载用户失败');
      const data = await res.json();
      setAllUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      console.error('加载用户列表失败:', error);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    const init = async () => {
      setLoading(true);
      await Promise.all([loadFriends(), loadAllUsers()]);
      setLoading(false);
    };
    
    init();
  }, [currentUser, navigate, loadFriends, loadAllUsers]);

  // 添加好友
  const addFriend = async (friendId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/friends/${friendId}`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('添加好友失败');
      await loadFriends();
      alert('✅ 好友添加成功');
      setShowAddModal(false);
    } catch (error) {
      console.error('添加好友失败:', error);
      alert('添加好友失败，请重试');
    }
  };

  // 移除好友
  const removeFriend = async (friendId, friendName) => {
    // 检查是否是管理员
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

  // 过滤可添加的用户
  const availableUsers = allUsers.filter(u => {
    if (u.id === currentUser?.id) return false; // 排除自己
    if (friends.some(f => f.id === u.id)) return false; // 排除已是好友的
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return u.username?.toLowerCase().includes(term) || 
             u.email?.toLowerCase().includes(term);
    }
    return true;
  });

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
                {currentUser.username}
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
        {/* 个人档案卡片 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            个人档案
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">用户名</label>
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
                <label className="text-sm text-gray-500">邮箱</label>
                <div className="text-lg">{currentUser.email}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500">账户状态</label>
                <div className="text-lg">
                  <span className={`px-2 py-1 rounded text-sm ${
                    currentUser.isActive 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {currentUser.isActive ? '✓ 已激活' : '✗ 未激活'}
                  </span>
                </div>
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
                        {friend.username}
                        {friend.isSuperAdmin && (
                          <span className="text-yellow-600 text-sm">👑</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
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
                        onClick={() => removeFriend(friend.id, friend.username)}
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
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-lg font-semibold">添加好友</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索用户名或邮箱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {availableUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? '没有找到匹配的用户' : '暂无可添加的用户'}
                </div>
              ) : (
                <div className="space-y-3">
                  {availableUsers.map(user => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {user.username}
                          {user.isSuperAdmin && (
                            <span className="text-yellow-600 text-sm">👑 管理员</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      <button
                        onClick={() => addFriend(user.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4" />
                        添加
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Friends;

