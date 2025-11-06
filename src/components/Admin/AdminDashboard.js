import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { API_BASE_URL } from "../../config/api";
import { apiGet, apiPost, apiPut, apiDelete } from "../../utils/apiClient";
import Navigation from "../Navigation";
import {
  Users,
  Eye,
  EyeOff,
  Loader2,
  Image as ImageIcon,
  Search,
  Filter,
  Calendar,
  Wifi,
  Clock,
} from "lucide-react";

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const EMPTY_FORM = {
    username: "",
    displayName: "",
    email: "",
    password: "",
    newPassword: "",
    isActive: true,
    isSuperAdmin: false,
    showApiConfig: false,
    apiKey: "",
    freeLimitEnabled: true,
    freeLimit: 30,
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadingApiKey, setLoadingApiKey] = useState(false);
  const [originalApiKey, setOriginalApiKey] = useState("");
  const [showAdminApiKey, setShowAdminApiKey] = useState(false);
  
  // 图片历史相关状态
  const [allHistory, setAllHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUser, setFilterUser] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [filterDeleted, setFilterDeleted] = useState(""); // 过滤删除状态：all/deleted/active
  const [selectedImage, setSelectedImage] = useState(null);
  const [viewingArchivedImage, setViewingArchivedImage] = useState(false); // 是否正在查看归档图片
  const [archivedImageUrl, setArchivedImageUrl] = useState(null); // 归档图片的URL
  const [selectedImages, setSelectedImages] = useState([]); // 多选的图片ID列表
  const [batchMode, setBatchMode] = useState(false); // 是否处于批量操作模式
  const [pageSize, setPageSize] = useState(21); // 每页显示数量（3的倍数，3列布局）
  const [currentPage, setCurrentPage] = useState(1); // 当前页码
  
  // 关闭图片详情弹窗并重置状态
  const closeImageModal = useCallback(() => {
    setSelectedImage(null);
    setViewingArchivedImage(false);
    setArchivedImageUrl(null);
  }, []);
  
  // 切换多选模式
  const toggleBatchMode = useCallback(() => {
    setBatchMode(prev => !prev);
    setSelectedImages([]); // 切换模式时清空选择
  }, []);
  
  // 切换单个图片的选中状态
  const toggleImageSelection = useCallback((imageId) => {
    setSelectedImages(prev => 
      prev.includes(imageId) 
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  }, []);
  
  // 全选/取消全选当前页
  const toggleSelectAll = useCallback((records) => {
    const currentPageIds = records.map(r => r.id);
    const allSelected = currentPageIds.every(id => selectedImages.includes(id));
    
    if (allSelected) {
      // 取消全选
      setSelectedImages(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      // 全选
      setSelectedImages(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  }, [selectedImages]);
  
  // 批量归档（实现会在fetchAllHistory定义后）
  const batchArchiveImages = useCallback(async () => {
    if (selectedImages.length === 0) {
      alert('请先选择要归档的图片');
      return;
    }
    
    if (!window.confirm(`📦 确定要批量归档 ${selectedImages.length} 张图片吗？\n\n✅ 文件将移至归档目录（用于取证）\n✅ 用户无法访问，但管理员可追溯\n✅ 历史记录完整保留`)) {
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const imageId of selectedImages) {
      try {
        const record = allHistory.find(h => h.id === imageId);
        if (!record) continue;
        
        const res = await fetch(
          `${API_BASE_URL}/api/admin/history/${record.user.id}/${imageId}?archiveFile=true`,
          {
            method: 'DELETE',
            credentials: 'include',
          }
        );
        
        if (res.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('归档失败:', error);
        failCount++;
      }
    }
    
    alert(`✅ 批量归档完成\n\n成功: ${successCount} 张\n失败: ${failCount} 张`);
    setSelectedImages([]);
    setBatchMode(false);
    
    // 刷新列表
    try {
      setLoadingHistory(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/all-history`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setAllHistory(Array.isArray(data.history) ? data.history : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  }, [selectedImages, allHistory]);
  
  // 在线用户相关状态
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loadingOnlineUsers, setLoadingOnlineUsers] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
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
  }, [API_BASE_URL]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setFormMode("create");
    setSelectedUserId(null);
    setOriginalApiKey("");
    setShowAdminApiKey(false);
  };

  const loadUserApiKey = useCallback(
    async (userId) => {
      try {
        setLoadingApiKey(true);
        const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/api-key`, {
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
    [API_BASE_URL],
  );

  const deleteUser = async (id) => {
    if (!window.confirm("确认删除该用户？")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${id}`, {
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
      displayName: user.displayName || "",
      email: user.email || "",
      password: "",
      newPassword: "",
      isActive: Boolean(user.isActive),
      isSuperAdmin: Boolean(user.isSuperAdmin),
      showApiConfig: Boolean(user.showApiConfig),
      apiKey,
      freeLimitEnabled: typeof user.freeLimitEnabled === 'boolean' ? user.freeLimitEnabled : true,
      freeLimit: Number.isFinite(user.freeLimit) && user.freeLimit > 0 ? Math.floor(user.freeLimit) : 30,
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

  // 切换用户的自配置权限
  const toggleShowApiConfig = async (userId, currentValue) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ showApiConfig: !currentValue })
      });

      if (!res.ok) {
        throw new Error('更新失败');
      }

      await fetchUsers();
      alert(`已${!currentValue ? '开启' : '关闭'}用户自配置权限`);
    } catch (error) {
      console.error('切换自配置失败:', error);
      alert('操作失败，请重试');
    }
  };

  // 重置用户密码
  const resetPassword = async (userId) => {
    const newPassword = prompt('请输入新密码（留空将生成随机密码）：');
    
    if (newPassword === null) return; // 用户取消
    
    const passwordToSet = newPassword || generateRandomPassword();
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword: passwordToSet })
      });

      if (!res.ok) {
        throw new Error('重置密码失败');
      }

      alert(`密码已重置为: ${passwordToSet}`);
    } catch (error) {
      console.error('重置密码失败:', error);
      alert('操作失败，请重试');
    }
  };

  // 生成随机密码
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const handleSubmit = async () => {
    if (!form.username || !form.email) {
      alert("请填写用户名和邮箱");
      return;
    }

    const payload = {
      username: form.username,
      displayName: form.displayName || form.username,
      email: form.email,
      isActive: form.isActive,
      isSuperAdmin: form.isSuperAdmin,
      showApiConfig: form.showApiConfig,
      freeLimitEnabled: form.freeLimitEnabled,
      freeLimit: Number.isFinite(Number(form.freeLimit)) && Number(form.freeLimit) > 0 ? Math.floor(Number(form.freeLimit)) : 30,
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
          ? `${API_BASE_URL}/api/admin/users`
          : `${API_BASE_URL}/api/admin/users/${selectedUserId}`;
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
      const res = await fetch(`${API_BASE_URL}/api/admin/all-history`, {
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
  }, [API_BASE_URL]);

  // 获取在线用户
  const fetchOnlineUsers = useCallback(async () => {
    try {
      setLoadingOnlineUsers(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/online-users`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("加载在线用户失败");
      const data = await res.json();
      setOnlineUsers(data.onlineUsers || []);
    } catch (e) {
      console.error(e);
      // 静默失败，不影响用户体验
    } finally {
      setLoadingOnlineUsers(false);
    }
  }, [API_BASE_URL]);

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

  // 在线用户tab：加载数据并设置自动刷新
  useEffect(() => {
    if (activeTab === "online") {
      fetchOnlineUsers(); // 立即加载一次
      
      // 每5秒自动刷新
      const interval = setInterval(() => {
        fetchOnlineUsers();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchOnlineUsers]);

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
      <Navigation />

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
          <button
            onClick={() => setActiveTab("online")}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === "online"
                ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Wifi className="w-5 h-5" />
            在线用户
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
            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 mb-4">基本信息</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      用户名 <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2"
                      placeholder="请输入用户名（用于登录）"
                      value={form.username}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, username: e.target.value }))
                      }
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      显示名称
                    </label>
                    <input
                      className="w-full border rounded px-3 py-2"
                      placeholder="留空则使用用户名"
                      value={form.displayName}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, displayName: e.target.value }))
                      }
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      邮箱 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      className="w-full border rounded px-3 py-2"
                      placeholder="请输入邮箱"
                      value={form.email}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, email: e.target.value }))
                      }
                    />
                  </div>
                  
                  <div>
                    {formMode === "create" ? (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          初始密码 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="password"
                          className="w-full border rounded px-3 py-2"
                          placeholder="请输入初始密码"
                          value={form.password}
                          onChange={(e) =>
                            setForm((v) => ({ ...v, password: e.target.value }))
                          }
                        />
                      </>
                    ) : (
                      <>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          新密码（可选）
                        </label>
                        <input
                          type="password"
                          className="w-full border rounded px-3 py-2"
                          placeholder="留空则不修改密码"
                          value={form.newPassword}
                          onChange={(e) =>
                            setForm((v) => ({ ...v, newPassword: e.target.value }))
                          }
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          留空则不修改密码
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* API Key 配置 */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-800 mb-4">API Key 配置</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key（可选）
                    </label>
                    <div className="relative">
                    <input
                      type={showAdminApiKey ? 'text' : 'password'}
                      className="w-full border rounded px-3 py-2 pr-10"
                      placeholder="留空表示不设置/不修改"
                      value={form.apiKey}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, apiKey: e.target.value }))
                      }
                      onCopy={(e) => {
                        e.preventDefault();
                        alert('🔒 为保护API密钥安全，禁止复制操作');
                      }}
                      onCut={(e) => {
                        e.preventDefault();
                        alert('🔒 为保护API密钥安全，禁止剪切操作');
                      }}
                      onKeyDown={(e) => {
                        // 禁止 Ctrl+C 和 Ctrl+X (Windows/Linux)
                        // 禁止 Cmd+C 和 Cmd+X (Mac)
                        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x')) {
                          e.preventDefault();
                          alert('🔒 为保护API密钥安全，禁止复制/剪切操作');
                        }
                      }}
                      disabled={loadingApiKey || submitting}
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminApiKey(!showAdminApiKey)}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title={showAdminApiKey ? "隐藏密钥" : "显示密钥"}
                      disabled={loadingApiKey || submitting}
                    >
                      {showAdminApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
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
                
                {/* 额度限制配置 */}
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.freeLimitEnabled}
                      onChange={(e) => setForm((v) => ({ ...v, freeLimitEnabled: e.target.checked }))}
                    />
                    <span className="font-medium">启用免费额度限制</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    仅对管理员分配的 API Key 生效
                  </p>
                </div>
                
                <div className={!form.freeLimitEnabled ? 'opacity-50' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    额度上限（张）{!form.freeLimitEnabled && <span className="text-gray-400 ml-2">（已禁用）</span>}
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full border rounded px-3 py-2"
                    value={form.freeLimit}
                    onChange={(e) => setForm((v) => ({ ...v, freeLimit: e.target.value }))}
                    disabled={!form.freeLimitEnabled}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {form.freeLimitEnabled ? '达到额度后自动清除 API Key' : '不勾选则无限制使用'}
                  </p>
                </div>
                
                <div>
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
                    <span className="font-medium">允许用户自行配置 API Key</span>
                  </label>
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    勾选后用户可在工作室自行配置和管理 API Key
                  </p>
                </div>
              </div>
              </div>

              {/* 权限设置 */}
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <h4 className="font-medium text-gray-800 mb-4">权限设置</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, isActive: e.target.checked }))
                      }
                    />
                    <span className="font-medium">激活账户</span>
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
                    <span className="font-medium text-yellow-700">超级管理员</span>
                  </label>
                  <p className="text-xs text-gray-500 ml-6">
                    超级管理员拥有所有权限且不受额度限制
                  </p>
                </div>
              </div>
            </div>
            
            {/* 操作按钮 */}
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
                    <th className="text-left px-3 py-2">显示名</th>
                    <th className="text-left px-3 py-2">邮箱</th>
                    <th className="text-left px-3 py-2">状态</th>
                    <th className="text-left px-3 py-2">角色</th>
                    <th className="text-left px-3 py-2">API Key</th>
                    <th className="text-left px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td className="px-3 py-3 text-gray-500" colSpan={7}>
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
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleSelectUser(u)}
                            className="text-left w-full text-gray-600 hover:text-gray-800"
                          >
                            {u.displayName || u.username}
                          </button>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => handleSelectUser(u)}
                            className="text-left w-full text-gray-600 hover:text-gray-800 text-xs"
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
                                toggleShowApiConfig(u.id, u.showApiConfig);
                              }}
                              className="text-yellow-600 hover:underline"
                            >
                              {u.showApiConfig ? "关闭自配置" : "允许自配置"}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                resetPassword(u.id);
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
              <div className="flex items-center gap-2">
                {batchMode && selectedImages.length > 0 && (
                  <>
                    <span className="text-sm text-gray-600">
                      已选择 {selectedImages.length} 张
                    </span>
                    <button
                      onClick={batchArchiveImages}
                      className="text-sm bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 flex items-center gap-2"
                    >
                      <span>📦</span>
                      批量归档
                    </button>
                  </>
                )}
                <button
                  onClick={toggleBatchMode}
                  className={`text-sm px-4 py-2 rounded flex items-center gap-2 ${
                    batchMode 
                      ? 'bg-gray-600 text-white hover:bg-gray-700' 
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {batchMode ? '取消多选' : '批量操作'}
                </button>
                <button
                  onClick={fetchAllHistory}
                  disabled={loadingHistory}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                  {loadingHistory ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  刷新
                </button>
              </div>
            </div>

            {/* 搜索和过滤 */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid md:grid-cols-5 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Filter className="w-4 h-4 inline mr-1" />
                    删除状态
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={filterDeleted}
                    onChange={(e) => setFilterDeleted(e.target.value)}
                  >
                    <option value="">全部</option>
                    <option value="active">未删除</option>
                    <option value="deleted">已删除</option>
                    <option value="archived">已归档</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    每页显示
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1); // 改变每页数量时重置到第一页
                    }}
                  >
                    <option value="21">21 张 (7行)</option>
                    <option value="30">30 张 (10行)</option>
                    <option value="60">60 张 (20行)</option>
                    <option value="99">99 张 (33行)</option>
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
                {/* 统计信息和分页控制 */}
                {(() => {
                  const filteredRecords = allHistory.filter(record => {
                    const matchesSearch = !searchTerm || (record.prompt && record.prompt.toLowerCase().includes(searchTerm.toLowerCase()));
                    const matchesUser = !filterUser || record.user?.id === filterUser;
                    const matchesMode = !filterMode || record.mode === filterMode;
                    
                    // 删除状态过滤
                    let matchesDeleted = true;
                    if (filterDeleted === 'active') {
                      matchesDeleted = !record.deleted;
                    } else if (filterDeleted === 'deleted') {
                      matchesDeleted = record.deleted && !record.archived;
                    } else if (filterDeleted === 'archived') {
                      matchesDeleted = record.archived;
                    }
                    
                    return matchesSearch && matchesUser && matchesMode && matchesDeleted;
                  });
                  
                  const totalPages = Math.ceil(filteredRecords.length / pageSize);
                  const startIndex = (currentPage - 1) * pageSize;
                  const endIndex = startIndex + pageSize;
                  const paginatedRecords = filteredRecords.slice(startIndex, endIndex);
                  
                  return (
                    <>
                      {/* 统计信息 */}
                      <div className="text-sm text-gray-600 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span>
                            共 {filteredRecords.length} 条记录，第 {currentPage} / {totalPages || 1} 页
                          </span>
                          {batchMode && paginatedRecords.length > 0 && (
                            <button
                              onClick={() => toggleSelectAll(paginatedRecords)}
                              className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                            >
                              {paginatedRecords.every(r => selectedImages.includes(r.id)) ? '取消全选' : '全选本页'}
                            </button>
                          )}
                        </div>
                        {/* 顶部分页控件 */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setCurrentPage(Math.max(1, currentPage - 1));
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPage === 1}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            上一页
                          </button>
                          <span className="text-gray-600">
                            {currentPage} / {totalPages || 1}
                          </span>
                          <button
                            onClick={() => {
                              setCurrentPage(Math.min(totalPages, currentPage + 1));
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            disabled={currentPage >= totalPages}
                            className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            下一页
                          </button>
                        </div>
                      </div>

                      {/* 图片网格 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paginatedRecords.map(record => (
                      <div
                        key={record.id}
                        className={`bg-gray-50 border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
                          selectedImages.includes(record.id) ? 'border-purple-500 border-2 ring-2 ring-purple-200' : 'border-gray-200'
                        }`}
                        onClick={(e) => {
                          if (batchMode) {
                            e.stopPropagation();
                            toggleImageSelection(record.id);
                          } else {
                            setSelectedImage(record);
                          }
                        }}
                      >
                        {/* 图片 */}
                        <div className="relative bg-gray-200 h-48">
                          {/* 批量模式的复选框 */}
                          {batchMode && (
                            <div className="absolute top-2 left-2 z-10">
                              <input
                                type="checkbox"
                                checked={selectedImages.includes(record.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleImageSelection(record.id);
                                }}
                                className="w-5 h-5 rounded border-2 border-white shadow-lg cursor-pointer"
                              />
                            </div>
                          )}
                          {record.archived ? (
                            // 归档图片显示占位符
                            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-orange-50">
                              <div className="text-5xl mb-2">📦</div>
                              <div className="text-sm text-gray-600">已归档</div>
                              <div className="text-xs text-gray-500 mt-1">点击查看详情</div>
                            </div>
                          ) : record.imageUrl ? (
                            <img
                              src={`${API_BASE_URL}${record.imageUrl}`}
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
                          {/* 已删除标签 */}
                          {record.deleted && !record.archived && (
                            <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-md font-bold shadow-lg">
                              🗑️ 已删除
                            </div>
                          )}
                          {/* 已归档标签 */}
                          {record.archived && (
                            <div className="absolute top-2 right-2 bg-orange-600 text-white text-xs px-2 py-1 rounded-md font-bold shadow-lg">
                              📦 已归档
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
                          
                          <div className="text-xs flex gap-2">
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
                            {record.deleted && (
                              <span className="inline-block px-2 py-1 rounded bg-red-100 text-red-700 font-semibold">
                                已删除
                              </span>
                            )}
                          </div>

                          <p className="text-sm text-gray-700 line-clamp-3">
                            {record.prompt || '无Prompt'}
                          </p>
                        </div>
                      </div>
                        ))}
                      </div>

                      {/* 底部分页控件 */}
                      {filteredRecords.length > 0 && (
                        <div className="text-sm text-gray-600 flex items-center justify-between pt-4 border-t">
                          <span>
                            共 {filteredRecords.length} 条记录，第 {currentPage} / {totalPages || 1} 页
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setCurrentPage(Math.max(1, currentPage - 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              disabled={currentPage === 1}
                              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              上一页
                            </button>
                            <span className="text-gray-600">
                              {currentPage} / {totalPages || 1}
                            </span>
                            <button
                              onClick={() => {
                                setCurrentPage(Math.min(totalPages, currentPage + 1));
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              disabled={currentPage >= totalPages}
                              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              下一页
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 无数据提示 */}
                      {filteredRecords.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                          <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p>暂无图片记录</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {/* 在线用户 Tab */}
        {activeTab === "online" && (
          <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Wifi className="w-5 h-5 text-green-600" />
                在线用户监控
                <span className="ml-2 text-sm text-gray-500">
                  (每5秒自动刷新)
                </span>
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-semibold text-purple-600">{onlineUsers.length}</span>
                  <span className="text-gray-600 ml-1">人在线</span>
                </div>
                <button
                  onClick={fetchOnlineUsers}
                  disabled={loadingOnlineUsers}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loadingOnlineUsers ? '刷新中...' : '立即刷新'}
                </button>
              </div>
            </div>

            {loadingOnlineUsers && onlineUsers.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              </div>
            ) : onlineUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Wifi className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>当前暂无在线用户</p>
              </div>
            ) : (
              <div className="space-y-3">
                {onlineUsers.map((user, index) => {
                  const idleMinutes = Math.floor(user.idleTime / 60000);
                  const idleSeconds = Math.floor((user.idleTime % 60000) / 1000);
                  const isActive = user.status === 'active';
                  
                  return (
                    <div
                      key={user.username}
                      className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                        isActive 
                          ? 'border-green-200 bg-green-50' 
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                            isActive ? 'bg-green-600' : 'bg-gray-400'
                          }`}>
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          {isActive && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
                          )}
                        </div>
                        
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-800">{user.username}</span>
                            {isActive && (
                              <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                                活跃中
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              闲置: {idleMinutes > 0 && `${idleMinutes}分`}{idleSeconds}秒
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right text-xs text-gray-400">
                        <div>最后活动</div>
                        <div className="font-mono">
                          {new Date(user.lastActivity).toLocaleTimeString('zh-CN')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-gray-600">
              <div className="flex items-start gap-2">
                <div className="text-blue-600 mt-0.5">ℹ️</div>
                <div>
                  <p><strong>说明：</strong></p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>绿色标记表示用户正在活跃操作（1分钟内有活动）</li>
                    <li>灰色标记表示用户处于闲置状态</li>
                    <li>15分钟无活动的用户将自动标记为离线</li>
                    <li>数据每5秒自动刷新，也可手动刷新</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 图片详情弹窗 */}
        {selectedImage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={closeImageModal}
          >
            <div
              className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold">图片详情</h3>
                    {selectedImage.deleted && (
                      <span className="bg-red-600 text-white text-sm px-3 py-1 rounded-md font-bold">
                        🗑️ 已删除
                      </span>
                    )}
                  </div>
                  <button
                    onClick={closeImageModal}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                {/* 图片 */}
                <div className="bg-gray-100 rounded-lg overflow-hidden relative">
                  {selectedImage.archived ? (
                    // 归档图片
                    viewingArchivedImage && archivedImageUrl ? (
                      // 显示从归档加载的图片
                      <div>
                        <img
                          src={archivedImageUrl}
                          alt={selectedImage.fileName}
                          className="w-full h-auto"
                        />
                        <div className="absolute top-2 right-2 bg-orange-600 text-white text-xs px-3 py-2 rounded-md shadow-lg">
                          📦 归档图片（管理员查看）
                        </div>
                      </div>
                    ) : (
                      // 显示占位符和加载按钮
                      <div className="w-full h-64 flex flex-col items-center justify-center text-gray-400 bg-orange-50">
                        <div className="text-6xl mb-4">📦</div>
                        <div className="text-lg font-semibold text-gray-700 mb-2">图片已归档</div>
                        <div className="text-sm text-gray-500 mb-4">
                          文件已移至归档目录，用户无法访问
                        </div>
                        <button
                          onClick={async () => {
                            if (!selectedImage.archivedPath) {
                              alert('归档路径不存在');
                              return;
                            }
                            try {
                              // 从归档路径提取文件名
                              const pathParts = selectedImage.archivedPath.split('/');
                              const filename = pathParts[pathParts.length - 1];
                              const userId = selectedImage.user.id;
                              
                              const url = `${API_BASE_URL}/api/admin/archived-image/${userId}/${filename}`;
                              setArchivedImageUrl(url);
                              setViewingArchivedImage(true);
                            } catch (error) {
                              alert('❌ 加载归档图片失败: ' + error.message);
                            }
                          }}
                          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 font-semibold"
                        >
                          <span>👁️</span>
                          查看归档图片
                        </button>
                      </div>
                    )
                  ) : selectedImage.imageUrl ? (
                    <img
                      src={`${API_BASE_URL}${selectedImage.imageUrl}`}
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

                  {selectedImage.deleted && selectedImage.deletedAt && (
                    <div>
                      <label className="text-sm font-semibold text-red-700">删除时间</label>
                      <p className="text-red-600">{new Date(selectedImage.deletedAt).toLocaleString('zh-CN')}</p>
                    </div>
                  )}

                  {selectedImage.archived && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <label className="text-sm font-semibold text-orange-700">📦 文件状态</label>
                      <p className="text-orange-600 text-sm">
                        图片已归档至隐藏目录，用户无法访问
                      </p>
                      {selectedImage.archivedPath && (
                        <p className="text-xs text-gray-500 mt-1 font-mono break-all">
                          归档路径: {selectedImage.archivedPath}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-semibold text-gray-700">Prompt</label>
                    <p className="text-gray-600 whitespace-pre-wrap">{selectedImage.prompt || '无'}</p>
                  </div>
                </div>

                {/* 管理员操作按钮 */}
                <div className="flex justify-between items-center gap-4 pt-4 border-t">
                  <div className="flex gap-2">
                    {selectedImage.deleted ? (
                      <button
                        onClick={async () => {
                          if (!window.confirm('确定要恢复这张图片吗？')) return;
                          try {
                            const res = await fetch(
                              `${API_BASE_URL}/api/admin/history/${selectedImage.user.id}/${selectedImage.id}/restore`,
                              {
                                method: 'POST',
                                credentials: 'include',
                              }
                            );
                            if (!res.ok) {
                              const data = await res.json();
                              throw new Error(data.error || '恢复失败');
                            }
                            alert('✅ 图片已恢复');
                            closeImageModal();
                            fetchAllHistory(); // 刷新列表
                          } catch (error) {
                            alert('❌ 恢复失败: ' + error.message);
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                      >
                        <span>🔄</span>
                        恢复图片
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          if (!window.confirm('确定要删除这张图片吗？\n\n这将标记删除，可以恢复。')) return;
                          try {
                            const res = await fetch(
                              `${API_BASE_URL}/api/admin/history/${selectedImage.user.id}/${selectedImage.id}`,
                              {
                                method: 'DELETE',
                                credentials: 'include',
                              }
                            );
                            if (!res.ok) {
                              const data = await res.json();
                              throw new Error(data.error || '删除失败');
                            }
                            alert('✅ 图片已删除');
                            closeImageModal();
                            fetchAllHistory(); // 刷新列表
                          } catch (error) {
                            alert('❌ 删除失败: ' + error.message);
                          }
                        }}
                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 flex items-center gap-2"
                      >
                        <span>🗑️</span>
                        删除图片
                      </button>
                    )}
                    
                    <button
                      onClick={async () => {
                        if (!window.confirm('📦 确定要归档这张图片吗？\n\n✅ 文件将移至归档目录（用于取证）\n✅ 用户无法访问，但管理员可追溯\n✅ 历史记录完整保留\n✅ 符合安全审核要求')) return;
                        try {
                          const res = await fetch(
                            `${API_BASE_URL}/api/admin/history/${selectedImage.user.id}/${selectedImage.id}?archiveFile=true`,
                            {
                              method: 'DELETE',
                              credentials: 'include',
                            }
                          );
                          if (!res.ok) {
                            const data = await res.json();
                            throw new Error(data.error || '归档失败');
                          }
                          const result = await res.json();
                          alert('✅ ' + result.message);
                          closeImageModal();
                          fetchAllHistory(); // 刷新列表
                        } catch (error) {
                          alert('❌ 归档失败: ' + error.message);
                        }
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 flex items-center gap-2"
                    >
                      <span>📦</span>
                      归档文件
                    </button>
                  </div>
                  
                  <button
                    onClick={closeImageModal}
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
