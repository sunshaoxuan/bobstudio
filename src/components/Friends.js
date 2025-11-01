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
} from 'lucide-react';

const Friends = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 添加好友
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);

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

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    
    const init = async () => {
      setLoading(true);
      await loadFriends();
      setLoading(false);
    };
    
    init();
  }, [currentUser, navigate, loadFriends]);

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
        alert('❌ 未找到该用户\n\n请检查：\n• 用户名是否正确（区分大小写）\n• 邮箱是否正确\n• 对方账户是否已激活');
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
      
      await loadFriends();
      setSearchResult(null);
      setSearchQuery('');
      setShowAddModal(false);
      alert('✅ 好友添加成功\n\n对方已收到通知，您也可以在个人中心查看通知消息');
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

    if (!window.confirm(`确定要移除好友「${friendName}」吗？\n\n移除后将无法再看到对方分享给你的图片。`)) {
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
              <Link
                to="/profile"
                className="flex items-center gap-1 sm:gap-2 text-purple-600 hover:text-purple-800 transition-colors text-sm sm:text-base"
                title="个人中心"
              >
                <User className="w-4 h-4" />
                <span className="text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">
                  {currentUser.displayName || currentUser.username}
                  {currentUser.isSuperAdmin && (
                    <span className="ml-1 text-yellow-600">👑</span>
                  )}
                </span>
              </Link>
              <button
                onClick={logout}
                className="flex items-center gap-2 text-red-600 hover:text-red-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">退出</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6">
        {/* 好友列表 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
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
            <div className="text-center py-12 text-gray-500">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              加载中...
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg mb-2">还没有好友</p>
              <p className="text-sm">点击右上角「添加好友」按钮，通过用户名或邮箱搜索添加</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {friends.map(friend => (
                <div
                  key={friend.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-lg flex items-center gap-2 mb-1">
                        {friend.displayName || friend.username}
                        {friend.isSuperAdmin && (
                          <span className="text-yellow-600 text-base">👑</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        @{friend.username}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {friend.email}
                      </div>
                      {friend.isSuperAdmin && (
                        <div className="mt-3">
                          <span className="text-xs px-2 py-1 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
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

        {/* 使用说明 */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-800 mb-3">💡 如何添加好友</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p>• 点击右上角「添加好友」按钮</p>
            <p>• 输入对方的<strong>用户名</strong>或<strong>邮箱</strong>（需精确匹配）</p>
            <p>• 点击搜索找到对方后，点击「添加」按钮</p>
            <p>• 对方会收到通知，双方自动成为好友</p>
            <p className="pt-2 border-t border-blue-300">
              🔒 <strong>隐私保护：</strong>系统不会显示用户列表，只能通过精确搜索添加好友
            </p>
          </div>
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
            className="bg-white rounded-lg shadow-xl max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50">
              <h3 className="text-xl font-semibold text-gray-800">添加好友</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSearchQuery('');
                  setSearchResult(null);
                }}
                className="p-1 hover:bg-white hover:bg-opacity-50 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
                🔍 输入对方的<strong>用户名</strong>或<strong>邮箱</strong>来搜索并添加好友
              </p>
              
              <div className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="输入用户名或邮箱..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !searching && searchUser()}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <button
                  onClick={searchUser}
                  disabled={searching || !searchQuery.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {searching ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      搜索中
                    </span>
                  ) : '搜索'}
                </button>
              </div>

              {/* 搜索结果 */}
              {searchResult && (
                <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-lg flex items-center gap-2 mb-1">
                        {searchResult.displayName || searchResult.username}
                        {searchResult.isSuperAdmin && (
                          <span className="text-yellow-600 text-sm">👑 管理员</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600">
                        @{searchResult.username}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {searchResult.email}
                      </div>
                      {searchResult.isFriend && (
                        <div className="mt-3">
                          <span className="text-sm px-3 py-1 bg-green-100 text-green-700 rounded-full border border-green-300">
                            ✓ 已是好友
                          </span>
                        </div>
                      )}
                    </div>
                    {!searchResult.isFriend && (
                      <button
                        onClick={() => addFriend(searchResult.id)}
                        className="ml-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                      >
                        <UserPlus className="w-4 h-4" />
                        添加好友
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 leading-relaxed">
                  🔒 <strong>隐私保护说明：</strong><br/>
                  • 系统不会显示用户列表，保护所有用户隐私<br/>
                  • 只能通过精确的用户名或邮箱搜索<br/>
                  • 只有激活的用户才能被搜索到<br/>
                  • 添加成功后双方都会收到消息通知
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
