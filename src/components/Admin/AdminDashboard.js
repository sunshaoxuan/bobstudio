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
  Key,
  X,
  Loader2,
} from "lucide-react";

const AdminDashboard = () => {
  const { currentUser, logout } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: "",
    email: "",
    password: "",
    isActive: true,
    isSuperAdmin: false,
    showApiConfig: false,
  });
  const [apiKeyModal, setApiKeyModal] = useState({
    visible: false,
    userId: null,
    username: "",
    value: "",
    loading: false,
  });

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
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  }, [API_BASE]);

  const createUser = async () => {
    if (!createForm.username || !createForm.email || !createForm.password) {
      alert("请完整填写用户信息");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "创建失败");
      }

      setCreateForm({
        username: "",
        email: "",
        password: "",
        isActive: true,
        isSuperAdmin: false,
        showApiConfig: false,
      });
      await fetchUsers();
    } catch (error) {
      console.error(error);
      alert(error.message || "创建失败");
    } finally {
      setCreating(false);
    }
  };

  const openApiKeyModal = async (userId, username) => {
    try {
      setApiKeyModal({
        visible: true,
        userId,
        username,
        value: "",
        loading: true,
      });
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/api-key`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("加载API Key失败");
      }
      const data = await res.json().catch(() => ({ apiKey: "" }));
      setApiKeyModal({
        visible: true,
        userId,
        username,
        value: data.apiKey || "",
        loading: false,
      });
    } catch (error) {
      console.error(error);
      setApiKeyModal({
        visible: true,
        userId,
        username,
        value: "",
        loading: false,
      });
      alert("加载API Key失败");
    }
  };

  const closeApiKeyModal = () => {
    setApiKeyModal({
      visible: false,
      userId: null,
      username: "",
      value: "",
      loading: false,
    });
  };

  const saveApiKeyModalValue = async () => {
    if (!apiKeyModal.userId) return;
    try {
      setApiKeyModal((prev) => ({ ...prev, loading: true }));
      const res = await fetch(`${API_BASE}/api/admin/users/${apiKeyModal.userId}/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey: apiKeyModal.value }),
      });
      if (!res.ok) throw new Error("保存失败");
      await fetchUsers();
      closeApiKeyModal();
    } catch (error) {
      console.error(error);
      setApiKeyModal((prev) => ({ ...prev, loading: false }));
      alert("保存失败");
    }
  };

  const toggleActive = async (id, isActive) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error("更新失败");
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert("更新失败");
    }
  };

  const resetPassword = async (id) => {
    const newPwd = window.prompt("请输入新密码");
    if (!newPwd) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newPassword: newPwd }),
      });
      if (!res.ok) throw new Error("重置失败");
      alert("已重置");
    } catch (e) {
      console.error(e);
      alert("重置失败");
    }
  };

  const toggleShowApiConfig = async (id, showApiConfig) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ showApiConfig: !showApiConfig }),
      });
      if (!res.ok) throw new Error("更新失败");
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert("更新失败");
    }
  };

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
    } catch (e) {
      console.error(e);
      alert(e.message || "删除失败");
    }
  };

  // 检查管理员权限
  useEffect(() => {
    if (!currentUser || !currentUser.isSuperAdmin) {
      console.log("管理端权限检查：用户权限不足或已退出");
      return;
    }
    fetchUsers();
  }, [currentUser, fetchUsers]);

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

        {/* 统计概览 */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">总用户数</p>
                <p className="text-2xl font-bold text-gray-800">1</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 text-green-600">✅</div>
              <div>
                <p className="text-sm text-gray-600">已激活用户</p>
                <p className="text-2xl font-bold text-gray-800">1</p>
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

        {/* 用户管理 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-semibold mb-4">👥 用户管理</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">创建用户</h3>
              <div className="space-y-3">
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="用户名"
                  value={createForm.username}
                  onChange={(e) =>
                    setCreateForm((v) => ({ ...v, username: e.target.value }))
                  }
                />
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="邮箱"
                  value={createForm.email}
                  onChange={(e) =>
                    setCreateForm((v) => ({ ...v, email: e.target.value }))
                  }
                />
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="初始密码"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((v) => ({ ...v, password: e.target.value }))
                  }
                />
                <div className="flex flex-col gap-3 text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createForm.isActive}
                      onChange={(e) =>
                        setCreateForm((v) => ({
                          ...v,
                          isActive: e.target.checked,
                        }))
                      }
                    />
                    激活
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createForm.isSuperAdmin}
                      onChange={(e) =>
                        setCreateForm((v) => ({
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
                      checked={createForm.showApiConfig}
                      onChange={(e) =>
                        setCreateForm((v) => ({
                          ...v,
                          showApiConfig: e.target.checked,
                        }))
                      }
                    />
                    允许用户自行配置 API Key
                  </label>
                </div>
                <button
                  disabled={creating}
                  onClick={createUser}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-2 px-4 rounded hover:from-purple-700 hover:to-blue-700 transition-all"
                >
                  {creating ? "创建中..." : "创建"}
                </button>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2">
                用户列表{" "}
                {loadingUsers && (
                  <span className="text-sm text-gray-500">(加载中...)</span>
                )}
              </h3>
              <div className="overflow-x-auto border rounded">
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
                        <td className="px-3 py-3 text-gray-500" colSpan={5}>
                          暂无用户
                        </td>
                      </tr>
                    )}
                    {users.map((u) => (
                      <tr key={u.id} className="border-t">
                        <td className="px-3 py-2">{u.username}</td>
                        <td className="px-3 py-2">{u.email}</td>
                        <td className="px-3 py-2">
                          {u.isActive ? "已激活" : "未激活"}
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
                          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                            <button
                              onClick={() => toggleActive(u.id, u.isActive)}
                              className="text-blue-600 hover:underline"
                            >
                              {u.isActive ? "禁用" : "激活"}
                            </button>
                            <button
                              onClick={() =>
                                openApiKeyModal(u.id, u.username)
                              }
                              className="text-teal-600 hover:underline"
                            >
                              设置API Key
                            </button>
                            <button
                              onClick={() => resetPassword(u.id)}
                              className="text-purple-600 hover:underline"
                            >
                              重置密码
                            </button>
                            <button
                              onClick={() =>
                                toggleShowApiConfig(u.id, u.showApiConfig)
                              }
                              className="text-yellow-600 hover:underline"
                            >
                              {u.showApiConfig ? "关闭自配置" : "允许自配置"}
                            </button>
                            {!u.isSuperAdmin && (
                              <button
                                onClick={() => deleteUser(u.id)}
                                className="text-red-600 hover:underline"
                              >
                                删除
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      {apiKeyModal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">配置 API Key</h3>
                  <p className="text-sm text-gray-500">
                    用户：{apiKeyModal.username || ""}
                  </p>
                </div>
              </div>
              <button
                onClick={closeApiKeyModal}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500"
                disabled={apiKeyModal.loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">API Key</label>
              <textarea
                rows={3}
                value={apiKeyModal.value}
                onChange={(e) =>
                  setApiKeyModal((prev) => ({ ...prev, value: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="请输入或粘贴 API Key"
                disabled={apiKeyModal.loading}
              />
              <p className="text-xs text-gray-400 mt-2">
                Tips：留空后点击保存即可清除该用户的 API Key。
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeApiKeyModal}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100"
                disabled={apiKeyModal.loading}
              >
                取消
              </button>
              <button
                onClick={saveApiKeyModalValue}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60"
                disabled={apiKeyModal.loading}
              >
                {apiKeyModal.loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> 保存中…
                  </span>
                ) : (
                  "保存"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
