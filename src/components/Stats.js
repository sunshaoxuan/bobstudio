import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart3,
  Calendar,
  TrendingUp,
  Home,
  LogOut,
  ArrowLeft,
  Shield,
  Users,
  Loader2,
  Search,
  X
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const MODE_COLORS = {
  generate: '#8B5CF6',
  edit: '#3B82F6',
  compose: '#10B981',
  other: '#F97316'
};

const EMPTY_TOTALS = { today: 0, thisMonth: 0, total: 0 };

const Stats = () => {
  const { currentUser, logout, fetchStats, statsState } = useAuth();
  const navigate = useNavigate();

  const [scope, setScope] = useState('self');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState(null);
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const [selfStatsCache, setSelfStatsCache] = useState(null);
  const [summaryStatsCache, setSummaryStatsCache] = useState(null);
  const [userStatsCache, setUserStatsCache] = useState({});

  const isAdmin = Boolean(currentUser?.isSuperAdmin);
  const effectiveScope = isAdmin ? scope : 'self';
  const payload = statsState?.payload;

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const initialScope = currentUser.isSuperAdmin ? 'summary' : 'self';
    setScope(initialScope);

    if (!currentUser.isSuperAdmin) {
      fetchStats({ scope: 'self' });
    }
  }, [currentUser, fetchStats, navigate]);

  useEffect(() => {
    if (!payload) return;

    if (payload.scope === 'self' && payload.stats) {
      setSelfStatsCache(payload.stats);
    } else if (payload.scope === 'summary' && payload.summary) {
      setSummaryStatsCache(payload.summary);
    } else if (payload.scope === 'user' && payload.stats) {
      setUserStatsCache(prev => ({ ...prev, [payload.stats.user.id]: payload.stats }));
      setSelectedUserInfo({
        id: payload.stats.user.id,
        username: payload.stats.user.username,
        email: payload.stats.user.email
      });
    }
  }, [payload]);

  useEffect(() => {
    if (!currentUser || !currentUser.isSuperAdmin) {
      return;
    }

    if (scope === 'summary') {
      if (!summaryStatsCache) {
        fetchStats({ scope: 'summary' });
      }
    } else if (scope === 'self') {
      if (!selfStatsCache) {
        fetchStats({ scope: 'self' });
      }
    } else if (scope === 'user' && selectedUser) {
      fetchStats({ scope: 'user', userId: selectedUser });
    }
  }, [scope, selectedUser, currentUser, summaryStatsCache, selfStatsCache, fetchStats]);

  useEffect(() => {
    if (!selectedUser || !summaryStatsCache) return;
    const match = summaryStatsCache.perUser?.find(user => user.id === selectedUser);
    if (match) {
      setSelectedUserInfo(prev => ({
        id: match.id,
        username: match.username,
        email: match.email,
        isSuperAdmin: match.isSuperAdmin
      }));
    }
  }, [selectedUser, summaryStatsCache]);

  const summaryData = summaryStatsCache;

  const userStatsForView = useMemo(() => {
    if (effectiveScope === 'summary') return null;
    if (effectiveScope === 'self') {
      return selfStatsCache;
    }
    if (effectiveScope === 'user') {
      if (!selectedUser) return null;
      return userStatsCache[selectedUser] || null;
    }
    return null;
  }, [effectiveScope, selfStatsCache, userStatsCache, selectedUser]);

  const totals = useMemo(() => {
    if (effectiveScope === 'summary') {
      return summaryData?.totals || EMPTY_TOTALS;
    }
    return userStatsForView?.totals || EMPTY_TOTALS;
  }, [effectiveScope, summaryData, userStatsForView]);

  const dailyChartData = useMemo(() => {
    if (effectiveScope === 'summary') {
      const list = summaryData?.perUser || [];
      return list.map(user => ({
        name: user.username,
        total: user.totals.total,
        today: user.totals.today,
        thisMonth: user.totals.thisMonth
      }));
    }
    const daily = userStatsForView?.daily || [];
    return daily.map(item => ({
      name: item.label || item.date,
      count: item.count
    }));
  }, [effectiveScope, summaryData, userStatsForView]);

  const monthlyChartData = useMemo(() => {
    if (effectiveScope === 'summary') {
      return [];
    }
    const monthly = userStatsForView?.monthly || [];
    return monthly.map(item => ({
      name: item.label || item.month,
      count: item.count
    }));
  }, [effectiveScope, userStatsForView]);

  const pieChartData = useMemo(() => {
    if (effectiveScope === 'summary') {
      const list = summaryData?.perUser || [];
      return list.map(user => ({
        name: user.username,
        value: user.totals.total,
        color: MODE_COLORS.generate
      }));
    }
    const distribution = userStatsForView?.distribution || [];
    return distribution.map(item => ({
      name: item.label,
      value: item.count,
      color: item.color || MODE_COLORS[item.key] || MODE_COLORS.other
    }));
  }, [effectiveScope, summaryData, userStatsForView]);

  const filteredUsers = useMemo(() => {
    const list = summaryData?.perUser || [];
    const keyword = userSearch.trim().toLowerCase();
    if (!keyword) return list;
    return list.filter(user =>
      user.username?.toLowerCase().includes(keyword) ||
      user.email?.toLowerCase().includes(keyword)
    );
  }, [summaryData, userSearch]);

  const scopeHasData = effectiveScope === 'summary'
    ? Boolean(summaryData)
    : Boolean(userStatsForView);

  const viewLoading = statsState.loading && statsState.requestedScope === effectiveScope;
  const shouldShowLoading = !scopeHasData && viewLoading;

  const handleScopeChange = (nextScope) => {
    if (!isAdmin) return;
    setScope(nextScope);
    if (nextScope !== 'user') {
      setSelectedUser(null);
      setSelectedUserInfo(null);
    }
  };

  const handleOpenUserPicker = () => {
    if (!summaryData) {
      fetchStats({ scope: 'summary' });
    }
    setUserPickerOpen(true);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user.id);
    setSelectedUserInfo({
      id: user.id,
      username: user.username,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin
    });
    setScope('user');
    setUserPickerOpen(false);
    setUserSearch('');
  };

  const selectedUserLabel = scope === 'user' && selectedUserInfo
    ? `用户：${selectedUserInfo.username}`
    : '选择用户';

  const displayUserInfo = effectiveScope === 'user'
    ? userStatsForView?.user || selectedUserInfo || currentUser
    : currentUser;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100">
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                🎨 BOB Studio
              </h1>
              <span className="text-gray-600">统计中心</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/studio"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                返回工作室
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2 text-yellow-600 hover:text-yellow-800 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  管理端
                </Link>
              )}
              <Link
                to="/"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <Home className="w-4 h-4" />
                首页
              </Link>
              <span className="text-gray-600">
                欢迎，{currentUser?.username}
                {isAdmin && <span className="ml-1 text-yellow-600">👑</span>}
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

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {isAdmin && (
          <div className="bg-white rounded-lg shadow-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">视图切换</h2>
              <p className="text-sm text-gray-500 mt-1">选择查看汇总、个人或指定用户的统计数据</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => handleScopeChange('summary')}
                className={`px-4 py-2 rounded-lg border ${scope === 'summary' ? 'bg-purple-600 text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}
              >
                平台概览
              </button>
              <button
                onClick={() => handleScopeChange('self')}
                className={`px-4 py-2 rounded-lg border ${scope === 'self' ? 'bg-purple-600 text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}
              >
                我的统计
              </button>
              <button
                onClick={handleOpenUserPicker}
                className={`px-4 py-2 rounded-lg border ${scope === 'user' ? 'bg-purple-600 text-white border-transparent' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}
              >
                {selectedUserLabel}
              </button>
            </div>
          </div>
        )}

        {(shouldShowLoading) && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
            <span className="ml-3 text-gray-600">统计数据加载中...</span>
          </div>
        )}

        {!shouldShowLoading && (
          <>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">今日生成</p>
                    <p className="text-3xl font-bold text-purple-600">{totals.today}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {totals.today ? `今日完成 ${totals.today} 次创作` : '还没有开始今天的创作'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">本月生成</p>
                    <p className="text-3xl font-bold text-blue-600">{totals.thisMonth}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {totals.thisMonth ? `本月累计 ${totals.thisMonth} 次` : '本月还没有创作记录'}
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">历史总计</p>
                    <p className="text-3xl font-bold text-green-600">{totals.total}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {totals.total ? `累计创作 ${totals.total} 次` : '新手上路'}
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {effectiveScope === 'summary' ? '用户创作总览' : '最近7天生成趋势'}
                  </h2>
                  {effectiveScope === 'summary' && summaryData && (
                    <span className="flex items-center gap-2 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      {summaryData.users.total} 位用户
                    </span>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey={effectiveScope === 'summary' ? 'name' : 'name'} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      formatter={(value) => [
                        value,
                        effectiveScope === 'summary' ? '创作总数' : '生成数量'
                      ]}
                      labelFormatter={(label) =>
                        effectiveScope === 'summary' ? `用户: ${label}` : `日期: ${label}`
                      }
                    />
                    <Bar
                      dataKey={effectiveScope === 'summary' ? 'total' : 'count'}
                      fill="#8B5CF6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {effectiveScope !== 'summary' && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-lg font-semibold mb-4">生成数量分布</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) =>
                          value > 0 ? `${name}: ${value} (${(percent * 100).toFixed(0)}%)` : null
                        }
                        outerRadius={80}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={index} fill={entry.color || '#8B5CF6'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [value, '生成数量']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {effectiveScope !== 'summary' && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-lg font-semibold mb-4">月度生成趋势</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={(value) => [value, '生成数量']} />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">
                {effectiveScope === 'summary' ? '平台用户概览' : '账户信息'}
              </h2>

              {effectiveScope === 'summary' ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                    <span>总用户：{summaryData?.users.total || 0}</span>
                    <span>本月有创作的用户：{summaryData?.users.activeWithGenerations || 0}</span>
                    <span>已配置 API Key：{summaryData?.users.withApiKey || 0}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="text-left py-2 pr-4">用户</th>
                          <th className="text-right py-2 pr-4">今日</th>
                          <th className="text-right py-2 pr-4">本月</th>
                          <th className="text-right py-2 pr-4">总计</th>
                          <th className="text-right py-2">最近创作时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(summaryData?.perUser || []).map((user) => (
                          <tr key={user.id} className="border-b last:border-b-0">
                            <td className="py-2 pr-4 text-gray-700">
                              <div className="flex items-center gap-2">
                                {user.isSuperAdmin && <Shield className="w-3 h-3 text-yellow-500" />}
                                <span>{user.username}</span>
                              </div>
                              <div className="text-xs text-gray-400">{user.email}</div>
                            </td>
                            <td className="py-2 pr-4 text-right text-purple-600 font-medium">{user.totals.today}</td>
                            <td className="py-2 pr-4 text-right text-blue-600 font-medium">{user.totals.thisMonth}</td>
                            <td className="py-2 pr-4 text-right text-gray-700 font-semibold">{user.totals.total}</td>
                            <td className="py-2 text-right text-gray-500">
                              {user.lastGeneratedAt ? new Date(user.lastGeneratedAt).toLocaleString('zh-CN') : '无记录'}
                            </td>
                          </tr>
                        ))}
                        {(summaryData?.perUser?.length || 0) === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                              暂无用户统计数据
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium text-gray-700 mb-3">基本信息</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">用户名:</span>
                        <span className="font-medium">{displayUserInfo?.username || '未知用户'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">邮箱:</span>
                        <span className="font-medium">{displayUserInfo?.email || '未设置'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">注册时间:</span>
                        <span className="font-medium">
                          {displayUserInfo?.createdAt
                            ? new Date(displayUserInfo.createdAt).toLocaleDateString('zh-CN')
                            : '未知'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">账户状态:</span>
                        <span className={`font-medium ${displayUserInfo?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {displayUserInfo?.isActive ? '已激活' : '未激活'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-700 mb-3">创作概览</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">今日创作:</span>
                        <span className="font-medium text-purple-600">{totals.today}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">本月创作:</span>
                        <span className="font-medium text-blue-600">{totals.thisMonth}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">历史总计:</span>
                        <span className="font-medium text-green-600">{totals.total}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">最近创作:</span>
                        <span className="font-medium text-gray-500">
                          {userStatsForView?.lastGeneratedAt
                            ? new Date(userStatsForView.lastGeneratedAt).toLocaleString('zh-CN')
                            : '暂无记录'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {userPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">选择用户</h3>
                <p className="text-sm text-gray-500 mt-1">
                  共 {summaryData?.perUser?.length || 0} 位用户
                </p>
              </div>
              <button
                onClick={() => setUserPickerOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="搜索用户名或邮箱"
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="max-h-80 overflow-y-auto divide-y">
              {summaryData && filteredUsers.length === 0 && (
                <div className="py-10 text-center text-sm text-gray-500">
                  未找到匹配的用户
                </div>
              )}

              {!summaryData && (
                <div className="py-10 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  正在加载用户列表...
                </div>
              )}

              {filteredUsers.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleSelectUser(user)}
                  className={`w-full flex items-center justify-between gap-4 py-3 px-3 text-left hover:bg-purple-50 transition-colors ${selectedUser === user.id ? 'bg-purple-50' : ''}`}
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium text-gray-800">
                      {user.username}
                      {user.isSuperAdmin && <Shield className="w-3 h-3 text-yellow-500" />}
                    </div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </div>
                  <div className="text-right text-sm text-gray-600 min-w-[150px]">
                    <div className="font-semibold text-gray-700">总计 {user.totals.total}</div>
                    <div className="text-xs text-gray-400">本月 {user.totals.thisMonth} · 今日 {user.totals.today}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stats;