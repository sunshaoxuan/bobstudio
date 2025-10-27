import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  Users,
  Home,
  BarChart3,
  LogOut,
  Eye,
  EyeOff,
  Loader2,
  Image as ImageIcon,
  Search,
  Filter,
  Calendar,
} from "lucide-react";

const AdminDashboard = () => {
  const { currentUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const EMPTY_FORM = {
    username: "",
    email: "",
    password: "",
    newPassword: "",
    isActive: true,
    isSuperAdmin: false,
    showApiConfig: false,
    apiKey: "",
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingApiKey, setLoadingApiKey] = useState(false);
  const [originalApiKey, setOriginalApiKey] = useState("");
  
  // 图片历史相关状态
  const [allHistory, setAllHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);

  const API_BASE =
    process.env.NODE_ENV === "development" ? "http://localhost:8080" : "";

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("加载用户失败");
      const data = await res.json();
      const list = Array.isArray(data.users) ? data.users : [];
      setUsers(list);
      return list;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setLoadingUsers(false);
    }
  }, [API_BASE]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormMode("create");
    setSelectedUserId(null);
    setOriginalApiKey("");
  };

  const loadUserApiKey = useCallback(
    async (userId) => {
      try {
        setLoadingApiKey(true);
        const res = await fetch(`${API_BASE}/api/admin/users/${userId}/api-key`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("加载API Key失败");
        }
        const data = await res.json().catch(() => ({ apiKey: "" }));
        const apiKey = data.apiKey || "";
        setLoadingApiKey(false);
        return apiKey;
      } catch (error) {
        console.error(error);
        setLoadingApiKey(false);
        alert("加载API Key失败");
        return "";
      }
    },
    [API_BASE],
  );

  const deleteUser = async (id) => {
    if (!window.confirm("确认删除该用户？")) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "删除失败");
      }
      await fetchUsers();
      if (id === selectedUserId) {
        resetForm();
      }
    } catch (e) {
      console.error(e);
      alert(e.message || "删除失败");
    }
  };

  const populateFormForEdit = (user, apiKey = "") => {
    setFormMode("edit");
    setSelectedUserId(user.id);
    setForm({
      username: user.username || "",
      email: user.email || "",
      password: "",
      newPassword: "",
      isActive: Boolean(user.isActive),
      isSuperAdmin: Boolean(user.isSuperAdmin),
      showApiConfig: Boolean(user.showApiConfig),
      apiKey,
    });
    setOriginalApiKey(apiKey);
  };

  const handleSelectUser = async (user) => {
    setSelectedUserId(user.id);
    setSubmitting(true);
    try {
      const apiKey = user.hasApiKey ? await loadUserApiKey(user.id) : "";
      populateFormForEdit(user, apiKey);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.username || !form.email) {
      alert("请填写用户名和邮箱");
      return;
    }

    const payload = {
      username: form.username,
      email: form.email,
      isActive: form.isActive,
      isSuperAdmin: form.isSuperAdmin,
      showApiConfig: form.showApiConfig,
    };

    if (formMode === "create") {
      if (!form.password) {
        alert("请填写初始密码");
        return;
      }
      payload.password = form.password;
    } else {
      if (form.newPassword) {
        payload.password = form.newPassword;
      }
      if (form.apiKey !== originalApiKey) {
        payload.apiKey = form.apiKey;
      }
    }

    try {
      setSubmitting(true);
      const url =
        formMode === "create"
          ? `${API_BASE}/api/admin/users`
          : `${API_BASE}/api/admin/users/${selectedUserId}`;
      const method = formMode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "保存失败");
      }
      await fetchUsers();
      if (formMode === "create") {
        resetForm();
      } else {
        setForm((prev) => ({ ...prev, password: "", newPassword: "" }));
        setOriginalApiKey(form.apiKey || "");
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 获取所有用户的历史记录
  const fetchAllHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch(`${API_BASE}/api/admin/all-history`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("加载历史记录失败");
      const data = await res.json();
      setAllHistory(data.history || []);
    } catch (e) {
      console.error(e);
      alert("加载历史记录失败");
    } finally {
      setLoadingHistory(false);
    }
  }, [API_BASE]);

  // 检查管理员权限
  useEffect(() => {
    if (!currentUser || !currentUser.isSuperAdmin) {
      console.log("管理端权限检查：用户权限不足或已退出");
      return;
    }
    fetchUsers();
  }, [currentUser, fetchUsers]);

  // 当切换到图片记录Tab时加载数据
  useEffect(() => {
    if (activeTab === "history" && allHistory.length === 0) {
      fetchAllHistory();
    }
  }, [activeTab, allHistory.length, fetchAllHistory]);

  // 如果不是超级管理员，显示权限不足页面
  if (!currentUser || !currentUser.isSuperAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-red-500">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">访问被拒绝</h2>
          <p className="text-gray-600 mb-6">只有超级管理员才能访问此页面</p>
          <div className="space-y-3">
            <Link
              to="/"
              className="inline-block w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all"
            >
              返回首页
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100">
      {/* 导航栏 */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                🛡️ BOB Studio 管理端
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/stats"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                统计
              </Link>
              <Link
                to="/"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <Home className="w-4 h-4" />
                首页
              </Link>
              <span className="text-gray-600">
                欢迎，{currentUser.username}
                <span className="ml-1 text-yellow-600">👑</span>
              </span>
              <button
                onClick={() => {
                  console.log("管理端退出登录按钮被点击");
                  logout();
                }}
                className="flex items-center gap-2 text-red-600 hover:text-red-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        {/* 超级管理员信息 */}
        <div className="text-center mb-8">
          <p className="text-gray-600">用户管理与系统配置</p>
          <div className="mt-2 flex items-center justify-center gap-2 text-sm">
            <span className="text-yellow-600">👑</span>
            <span className="text-gray-600">
              超级管理员: admin (sunsx@briconbric.com)
            </span>
          </div>
        </div>

        {/* Tab导航 */}
        <div className="mb-6 bg-white rounded-lg shadow-lg p-2 flex gap-2">
          <button
            onClick={() => setActiveTab("users")}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === "users"
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Users className="w-5 h-5" />
            用户管理
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === "history"
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <ImageIcon className="w-5 h-5" />
            图片记录
          </button>
        </div>

        {/* 统计概览 */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">总用户数</p>
                <p className="text-2xl font-bold text-gray-800">{users.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 text-green-600">✅</div>
              <div>
                <p className="text-sm text-gray-600">已激活用户</p>
                <p className="text-2xl font-bold text-gray-800">
                  {users.filter(u => u.isActive).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 text-purple-600">👁️</div>
              <div>
                <p className="text-sm text-gray-600">后端管理</p>
                <p className="text-2xl font-bold text-gray-800">已启用</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 text-orange-600">🔑</div>
              <div>
                <p className="text-sm text-gray-600">认证方式</p>
                <p className="text-2xl font-bold text-gray-800">Session</p>
              </div>
            </div>
          </div>
        </div>

        {/* 用户管理Tab */}
        {activeTab === "users" && (
        <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">👥 用户管理</h2>
            {formMode === "edit" && (
              <button
                onClick={resetForm}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                返回创建模式
              </button>
            )}
          </div>

          {/* 表单区 */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-md font-semibold text-gray-800 mb-4">
              {formMode === "create" ? "创建新用户" : "编辑用户"}
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    用户名
                  </label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="请输入用户名"
                    value={form.username}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, username: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    邮箱
                  </label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="请输入邮箱"
                    value={form.email}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, email: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-3 text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, isActive: e.target.checked }))
                      }
                    />
                    激活
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isSuperAdmin}
                      onChange={(e) =>
                        setForm((v) => ({
                          ...v,
                          isSuperAdmin: e.target.checked,
                        }))
                      }
                    />
                    超级管理员
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.showApiConfig}
                      onChange={(e) =>
                        setForm((v) => ({
                          ...v,
                          showApiConfig: e.target.checked,
                        }))
                      }
                    />
                    允许用户自行配置 API Key
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                {formMode === "create" ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      初始密码
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2"
                      placeholder="请输入初始密码"
                      value={form.password}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, password: e.target.value }))
                      }
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      新密码（可选）
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2"
                      placeholder="留空则不修改密码"
                      value={form.newPassword}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, newPassword: e.target.value }))
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      若需要强制重置密码，可在此输入新密码。
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key （可选）
                  </label>
                  <textarea
                    rows={formMode === "create" ? 2 : 3}
                    className="w-full border rounded px-3 py-2"
                    placeholder="留空表示不设置/不修改"
                    value={form.apiKey}
                    onChange={(e) =>
                      setForm((v) => ({ ...v, apiKey: e.target.value }))
                    }
                    disabled={loadingApiKey || submitting}
                  />
                  {loadingApiKey && (
                    <p className="text-xs text-gray-400 mt-1">
                      正在加载 API Key...
                    </p>
                  )}
                  {formMode === "edit" && (
                    <p className="text-xs text-gray-500 mt-1">
                      修改后保存即可更新。留空保存表示清除用户的 API Key。
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              {formMode === "edit" && (
                <button
                  onClick={resetForm}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                  disabled={submitting}
                >
                  取消编辑
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 disabled:opacity-60"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> 保存中…
                  </span>
                ) : formMode === "create" ? (
                  "创建用户"
                ) : (
                  "保存修改"
                )}
              </button>
            </div>
          </div>

          {/* 用户列表 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-md font-semibold text-gray-800">
                  用户列表
                </h3>
                <span className="text-xs text-gray-500">
                  {users.length} 人
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>
                  当前模式：
                  <span className="font-medium text-gray-700 ml-1">
                    {formMode === "create" ? "创建" : "编辑"}
                  </span>
                </span>
                {loadingUsers && <span>(加载中...)</span>}
              </div>
            </div>
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">用户名</th>
                    <th className="text-left px-3 py-2">邮箱</th>
                    <th className="text-left px-3 py-2">状态</th>
                    <th className="text-left px-3 py-2">角色</th>
                    <th className="text-left px-3 py-2">API Key 状态</th>
                    <th className="text-left px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-gray-500" colSpan={6}>
                        暂无用户
                      </td>
                    </tr>
                  )}
                  {users.map((u) => {
                    const isSelected = selectedUserId === u.id;
                    return (
                      <tr
                        key={u.id}
                        className={`border-t transition-colors ${
                          isSelected
                            ? "bg-blue-50 border-l-4 border-blue-400"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2 font-medium text-gray-800">
                          <button
                            onClick={() => handleSelectUser(u)}
                            className="text-left w-full"
                          >
                            {u.username}
                          </button>
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800">
                          <button
                            onClick={() => handleSelectUser(u)}
                            className="text-left w-full text-gray-600 hover:text-gray-800"
                          >
                            {u.email}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // toggleActive(u.id, u.isActive); // This function is not defined in the original file
                            }}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              u.isActive
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {u.isActive ? "已激活" : "未激活"}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          {u.isSuperAdmin ? "超级管理员" : "普通用户"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <span
                              className={
                                u.hasApiKey ? "text-green-600" : "text-gray-500"
                              }
                            >
                              {u.hasApiKey ? "已设置" : "未设置"}
                            </span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              {u.showApiConfig ? (
                                <Eye className="w-3 h-3" />
                              ) : (
                                <EyeOff className="w-3 h-3" />
                              )}
                              {u.showApiConfig
                                ? "用户可自行配置"
                                : "仅管理员可配置"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // toggleShowApiConfig(u.id, u.showApiConfig); // This function is not defined in the original file
                              }}
                              className="text-yellow-600 hover:underline"
                            >
                              {u.showApiConfig ? "关闭自配置" : "允许自配置"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // resetPassword(u.id); // This function is not defined in the original file
                              }}
                              className="text-purple-600 hover:underline"
                            >
                              重置密码
                            </button>
                            {!u.isSuperAdmin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteUser(u.id);
                                }}
                                className="text-red-600 hover:underline"
                              >
                                删除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )}

        {/* 图片记录Tab */}
        {activeTab === "history" && (
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                所有用户图片记录
              </h2>
              <button
                onClick={fetchAllHistory}
                disabled={loadingHistory}
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                {loadingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                刷新
              </button>
            </div>

            {/* 搜索和过滤 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Search className="w-4 h-4 inline mr-1" />
                    搜索Prompt
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded px-3 py-2"
                    placeholder="输入关键词搜索prompt..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Filter className="w-4 h-4 inline mr-1" />
                    筛选用户
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={filterUser}
                    onChange={(e) => setFilterUser(e.target.value)}
                  >
                    <option value="">所有用户</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Filter className="w-4 h-4 inline mr-1" />
                    筛选模式
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value)}
                  >
                    <option value="">所有模式</option>
                    <option value="generate">文本生图</option>
                    <option value="edit">图像编辑</option>
                    <option value="compose">图像合成</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 加载中 */}
            {loadingHistory ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">加载中...</span>
              </div>
            ) : (
              <>
                {/* 统计信息 */}
                <div className="text-sm text-gray-600">
                  共 {allHistory.filter(record => {
                    const matchesSearch = !searchTerm || (record.prompt && record.prompt.toLowerCase().includes(searchTerm.toLowerCase()));
                    const matchesUser = !filterUser || record.user?.id === filterUser;
                    const matchesMode = !filterMode || record.mode === filterMode;
                    return matchesSearch && matchesUser && matchesMode;
                  }).length} 条记录
                </div>

                {/* 图片网格 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {allHistory
                    .filter(record => {
                      const matchesSearch = !searchTerm || (record.prompt && record.prompt.toLowerCase().includes(searchTerm.toLowerCase()));
                      const matchesUser = !filterUser || record.user?.id === filterUser;
                      const matchesMode = !filterMode || record.mode === filterMode;
                      return matchesSearch && matchesUser && matchesMode;
                    })
                    .map(record => (
                      <div
                        key={record.id}
                        className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => setSelectedImage(record)}
                      >
                        {/* 图片 */}
                        <div className="relative bg-gray-200 h-48">
                          {record.imageUrl ? (
                            <img
                              src={`${API_BASE}${record.imageUrl}`}
                              alt={record.fileName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3E图片加载失败%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <ImageIcon className="w-16 h-16" />
                            </div>
                          )}
                        </div>

                        {/* 信息 */}
                        <div className="p-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {record.user?.username || '未知用户'}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(record.createdAt).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                          
                          <div className="text-xs">
                            <span className={`inline-block px-2 py-1 rounded ${
                              record.mode === 'generate' ? 'bg-purple-100 text-purple-700' :
                              record.mode === 'edit' ? 'bg-blue-100 text-blue-700' :
                              record.mode === 'compose' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {record.mode === 'generate' ? '文本生图' :
                               record.mode === 'edit' ? '图像编辑' :
                               record.mode === 'compose' ? '图像合成' : '其他'}
                            </span>
                          </div>

                          <p className="text-sm text-gray-700 line-clamp-3">
                            {record.prompt || '无Prompt'}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>

                {/* 无数据提示 */}
                {allHistory.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p>暂无图片记录</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 图片详情弹窗 */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedImage(null)}
          >
            <div
              className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">图片详情</h3>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                {/* 图片 */}
                <div className="bg-gray-100 rounded-lg overflow-hidden">
                  {selectedImage.imageUrl ? (
                    <img
                      src={`${API_BASE}${selectedImage.imageUrl}`}
                      alt={selectedImage.fileName}
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center text-gray-400">
                      <ImageIcon className="w-32 h-32" />
                    </div>
                  )}
                </div>

                {/* 详细信息 */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700">用户</label>
                    <p className="text-gray-600">{selectedImage.user?.username || '未知'} ({selectedImage.user?.email || ''})</p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">文件名</label>
                    <p className="text-gray-600">{selectedImage.fileName}</p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">模式</label>
                    <p className="text-gray-600">
                      {selectedImage.mode === 'generate' ? '文本生图' :
                       selectedImage.mode === 'edit' ? '图像编辑' :
                       selectedImage.mode === 'compose' ? '图像合成' : '其他'}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">创建时间</label>
                    <p className="text-gray-600">{new Date(selectedImage.createdAt).toLocaleString('zh-CN')}</p>
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-gray-700">Prompt</label>
                    <p className="text-gray-600 whitespace-pre-wrap">{selectedImage.prompt || '无'}</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                  >
                    关闭
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Removed apiKeyModal as it's not used in this component */}
    </div>
  );
};

export default AdminDashboard;
