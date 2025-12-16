import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { API_BASE_URL, API_TIMEOUT } from "../config/api";
import { apiPost } from "../utils/apiClient";
import Navigation from "./Navigation";
import {
  Upload,
  Image,
  Edit3,
  Layers,
  Menu,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Grid3x3,
  Download,
  Settings,
  Sparkles,
  Plus,
  X,
  Eye,
  EyeOff,
  Share2,
  Users,
  BarChart3,
  User,
  LogOut,
} from "lucide-react";

const useMediaQuery = (query) => {
  const getMatches = () => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mql = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [query]);

  return matches;
};

const Studio = () => {
  const { currentUser, logout, refreshUser, changePassword } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  // API Key 安全处理：
  // - 用户自配的Key（showApiConfig=true）：从后端加密传回，用密码框显示，禁止复制
  // - 管理员配置的Key：不传回前端，完全在后端使用
  const [apiKey, setApiKey] = useState(currentUser?.apiKey || "");
  
  // 统一的 API Key 可用性检查函数
  // 返回 { isValid: boolean, errorMessage: string | null }
  const checkApiKeyAvailable = useCallback(() => {
    // 如果是管理员配置模式（showApiConfig=false），检查后端的 hasApiKey 字段
    if (!currentUser?.showApiConfig) {
      if (!currentUser?.hasApiKey) {
        return {
          isValid: false,
          errorTitle: "权限受限",
          errorMessage: "请联系管理员为该账号配置 API Key"
        };
      }
      return { isValid: true, errorTitle: null, errorMessage: null };
    }
    
    // 如果是用户自己配置模式（showApiConfig=true），检查前端的 apiKey
    if (currentUser?.showApiConfig) {
      if (!apiKey) {
        return {
          isValid: false,
          errorTitle: "需要配置 API Key",
          errorMessage: "请在右上角个人信息中配置您的 Google Gemini API Key。\n\n获取方法：访问 https://aistudio.google.com/apikey 创建免费 API Key"
        };
      }
      return { isValid: true, errorTitle: null, errorMessage: null };
    }
    
    return { isValid: false, errorTitle: "未知错误", errorMessage: "无法确定 API Key 状态" };
  }, [currentUser, apiKey]);
  
  const [prompt, setPrompt] = useState("");
  const [uploadedImages, setUploadedImages] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("generate");
  const [imageHistory, setImageHistory] = useState([]);
  // 历史记录分页（仅显示当前用户未删除记录）
  const [historyPageSize, setHistoryPageSize] = useState(12);
  const [historyCurrentPage, setHistoryCurrentPage] = useState(1);
  const nonDeletedHistory = useMemo(() => imageHistory.filter(r => !r.deleted), [imageHistory]);
  const totalHistoryPages = useMemo(() => Math.max(1, Math.ceil(nonDeletedHistory.length / historyPageSize)), [nonDeletedHistory.length, historyPageSize]);
  useEffect(() => {
    setHistoryCurrentPage((p) => Math.min(p, totalHistoryPages));
  }, [totalHistoryPages]);
  
  // 好友与分享
  const [friends, setFriends] = useState([]);
  const [shareModal, setShareModal] = useState({ open: false, recordId: null, targets: [] });
  const [incomingShares, setIncomingShares] = useState([]);
  
  // 统计数据状态
  const [stats, setStats] = useState({
    today: 0,
    thisMonth: 0,
    total: 0,
  });
  
  // 超时和重试相关状态
  const [loadingElapsedTime, setLoadingElapsedTime] = useState(0);
  const [lastRequestBody, setLastRequestBody] = useState(null);
  const loadingTimerRef = useRef(null);
  const abortControllerRef = useRef(null); // 保存 AbortController 引用
  
  // 提示词助写相关状态
  const [suggestedPrompt, setSuggestedPrompt] = useState(''); // AI建议的提示词
  const [loadingSuggestion, setLoadingSuggestion] = useState(false); // 正在生成建议
  
  // 超时对话框状态
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false);
  
  // 本地缓存和服务器状态
  const [pendingSync, setPendingSync] = useState([]); // 待同步的历史记录
  const [serverAvailable, setServerAvailable] = useState(true); // 服务器是否可用

  // 移动端：左右抽屉（左：导航/账号；右：生图/共享/快捷操作）
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [mobileThumbsOpen, setMobileThumbsOpen] = useState(false);
  const [mobileThumbsExpanded, setMobileThumbsExpanded] = useState(false);
  const [mobileRefExpanded, setMobileRefExpanded] = useState(false);
  const [mobileLibraryTab, setMobileLibraryTab] = useState("history"); // history | shares
  const [mobileActiveIndex, setMobileActiveIndex] = useState(0);
  const [mobilePreferGenerated, setMobilePreferGenerated] = useState(false);
  const mobileThumbsScrollRef = useRef(null);
  const [mobileThumbsScrollTop, setMobileThumbsScrollTop] = useState(0);
  const [mobileThumbsViewportHeight, setMobileThumbsViewportHeight] = useState(0);
  const drawerSwipeRef = useRef({ x: 0, y: 0, t: 0 });
  const viewerSwipeRef = useRef({ x: 0, y: 0, t: 0, moved: false, lastX: 0 });
  const mobilePromptTextareaRef = useRef(null);

  // 使用限额显示逻辑
  const remainingQuota = useMemo(() => {
    const total = Number(currentUser?.generationStats?.total || 0);
    
    // 用户自己配置的 API Key - 无限制
    if (currentUser?.showApiConfig && currentUser?.hasApiKey) {
      return { unlimited: true, total, selfConfigured: true };
    }
    
    // 管理员分配的 API Key
    if (!currentUser?.showApiConfig && currentUser?.hasApiKey) {
      // 超级管理员永远无限制
      if (currentUser?.isSuperAdmin) {
        return { unlimited: true, total, isSuperAdmin: true };
      }
      
      // 如果未启用限制，返回无限制标记
      if (!currentUser?.freeLimitEnabled) {
        return { unlimited: true, total };
      }
      
      // 启用限制时显示剩余额度
      const limit = Number.isFinite(currentUser?.freeLimit) && currentUser.freeLimit > 0 ? Math.floor(currentUser.freeLimit) : 30;
      return { remaining: Math.max(0, limit - total), limit, total };
    }
    
    return null;
  }, [currentUser]);

  // Loading 计时器
  useEffect(() => {
    if (loading) {
      setLoadingElapsedTime(0);
      loadingTimerRef.current = setInterval(() => {
        setLoadingElapsedTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setLoadingElapsedTime(0);
    }
    
    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
      }
    };
  }, [loading]);

  // 计算统计数据
  useEffect(() => {
    if (!imageHistory || imageHistory.length === 0) {
      setStats({ today: 0, thisMonth: 0, total: 0 });
      return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayCount = 0;
    let thisMonthCount = 0;

    imageHistory.forEach((record) => {
      const recordDate = new Date(record.createdAt);
      
      if (recordDate >= todayStart) {
        todayCount++;
      }
      
      if (recordDate >= monthStart) {
        thisMonthCount++;
      }
    });

    setStats({
      today: todayCount,
      thisMonth: thisMonthCount,
      total: imageHistory.length,
    });

    console.log(`📊 统计更新: 今日 ${todayCount}, 本月 ${thisMonthCount}, 总计 ${imageHistory.length}`);
  }, [imageHistory]);

  // 从 localStorage 加载待同步数据
  useEffect(() => {
    if (!currentUser) return;
    
    try {
      const key = `pending_sync_${currentUser.id}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const pending = JSON.parse(stored);
        setPendingSync(pending);
        console.log(`📦 从本地加载了 ${pending.length} 条待同步记录`);
      }
    } catch (error) {
      console.error("加载本地缓存失败:", error);
    }
  }, [currentUser]);

  // 从服务器加载用户的历史记录
  const loadImageHistory = useCallback(async () => {
    console.log("🔄 从服务器加载历史记录，currentUser:", currentUser?.id);
    if (!currentUser) {
      console.warn("❌ currentUser为空，无法加载历史记录");
      return;
    }

    try {
      // 从服务器API加载历史记录
      const response = await fetch(`${API_BASE_URL}/api/history/${currentUser.id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // 包含cookies
      });

      if (response.ok) {
        const historyData = await response.json();
        console.log("📊 从服务器加载的历史数据:", historyData.length, "张图片");
        setImageHistory(historyData);
        console.log(
          `✅ 已加载用户 ${currentUser.id} 的历史记录: ${historyData.length} 张图片`,
        );
      } else if (response.status === 404) {
        console.log(
          `ℹ️ 用户 ${currentUser.id} 的历史记录文件不存在，设置为空数组`,
        );
        setImageHistory([]);
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error("❌ 从服务器加载历史记录失败:", error);
      setImageHistory([]);

      // 如果是网络错误，显示提示
      if (error.name === "TypeError" || error.message.includes("fetch")) {
        console.warn("⚠️ 网络连接问题，无法加载服务器历史记录");
      }
    }
  }, [currentUser]);

  // 保存历史记录到服务器
  const saveHistoryToServer = useCallback(async (historyData, userId) => {
    try {
      console.log("=".repeat(50));
      console.log("💾 开始保存历史记录到服务器");
      console.log("用户ID:", userId);
      console.log("图片数量:", historyData.length);
      
      // 清理历史记录中的 BASE64 数据（保留服务器 URL）
      const cleanedHistory = historyData.map(item => {
        if (item.imageUrl && item.imageUrl.startsWith('data:image/')) {
          console.warn(`⚠️ 发现旧的 BASE64 数据: ${item.fileName}，将被移除`);
          return {
            ...item,
            imageUrl: '' // 清空 BASE64，避免发送大数据
          };
        }
        return item;
      });
      
      // 计算数据大小
      const dataStr = JSON.stringify(cleanedHistory);
      const dataSize = new Blob([dataStr]).size;
      console.log("数据大小:", (dataSize / 1024).toFixed(2), "KB");
      console.log("清理后的记录数:", cleanedHistory.length);

      const url = `${API_BASE_URL}/api/history/${userId}`;
      console.log("请求URL:", url);
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // 包含cookies
        body: dataStr, // 发送清理后的数据
      });

      console.log("响应状态:", response.status, response.statusText);

      if (response.ok) {
        const result = await response.json();
        console.log("✅ 历史记录已保存到服务器:", result);
        
        // 🔑 检查是否达到免费额度限制
        if (result.apiKeyCleared) {
          alert(
            "🎉 恭喜！您已完成 30 张图片的免费体验！\n\n" +
            "✨ 体验额度已用完，现在您可以：\n\n" +
            "方案 1️⃣：配置自己的 API Key（推荐）\n" +
            "• 在页面上方「API配置」区域配置\n" +
            "• 访问 https://aistudio.google.com/apikey 获取免费 Key\n" +
            "• 配置后即可无限制使用\n\n" +
            "方案 2️⃣：联系管理员\n" +
            "• 申请更多体验额度\n\n" +
            "页面将自动刷新，显示 API 配置选项..."
          );
          // 刷新用户信息
          if (currentUser && typeof refreshUser === 'function') {
            try { 
              await refreshUser(); 
              window.location.reload(); // 刷新页面以显示 API 配置区域
            } catch (_) {}
          }
        } else if (result.reachedLimit) {
          console.log("⚠️ 用户已达到免费额度限制");
        }
      } else {
        const errorText = await response.text();
        console.error("响应内容:", errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      console.log("=".repeat(50));
    } catch (error) {
      console.error("❌ 保存历史记录到服务器失败:", error);
      console.error("错误类型:", error.name);
      console.error("错误消息:", error.message);
      console.log("=".repeat(50));

      // 如果是网络错误，显示提示但不阻断用户操作
      if (error.name === "TypeError" || error.message.includes("fetch")) {
        console.warn("⚠️ 网络连接问题，无法保存到服务器，但本地记录仍然有效");
      }
    }
  }, [currentUser, refreshUser]);

  // 当currentUser变化时，更新API密钥并加载历史记录
  const [previousUserId, setPreviousUserId] = useState(null);

  useEffect(() => {
    console.log(
      "🔄 currentUser useEffect触发，currentUser:",
      currentUser?.id,
      "previousUserId:",
      previousUserId,
    );

    if (currentUser) {
      // 用户自配的API Key会从后端传回（加密传输）
      if (currentUser.apiKey) {
        setApiKey(currentUser.apiKey);
      }

      // 用户首次登录或切换用户时加载对应的历史记录
      if (previousUserId !== currentUser.id) {
        console.log(
          "📥 需要加载历史记录，从",
          previousUserId,
          "到",
          currentUser.id,
        );
        loadImageHistory();
      } else {
        console.log("ℹ️ 用户ID未变化，跳过加载历史记录");
      }
      setPreviousUserId(currentUser.id);
    } else {
      // 用户登出时清空历史记录
      console.log("🚪 用户登出，清空历史记录");
      setImageHistory([]);
      setPreviousUserId(null);
    }
  }, [currentUser, loadImageHistory, previousUserId]);

  // 监控imageHistory状态变化
  useEffect(() => {
    console.log("📊 imageHistory状态更新: 共", imageHistory.length, "张图片");
    if (imageHistory.length > 0) {
      console.log(
        "📋 历史记录详情:",
        imageHistory.map((item) => ({
          id: item.id,
          createdAt: item.createdAt,
        })),
      );
    }

    // 历史记录状态监控完成
  }, [imageHistory, currentUser]);
  
  // 好友与分享：加载好友和共享记录
  const loadFriends = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/friends`, { credentials: 'include' });
      if (!res.ok) throw new Error('加载好友失败');
      const data = await res.json();
      console.log('加载的好友数据:', data.friends);
      setFriends(Array.isArray(data.friends) ? data.friends : []);
    } catch (e) {
      console.error('加载好友失败:', e);
    }
  }, []);

  const loadIncomingShares = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/shares/incoming`, { credentials: 'include' });
      if (!res.ok) throw new Error('加载共享失败');
      const data = await res.json();
      setIncomingShares(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      console.error('加载共享失败:', e);
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadFriends();
      loadIncomingShares();
    }
  }, [currentUser, loadFriends, loadIncomingShares]);
  const fileInputRef = useRef(null);
  const uploadAreaRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorModal, setErrorModal] = useState({
    show: false,
    title: "",
    message: "",
    details: "",
    showRetry: false,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  
  // 全屏图片查看器状态
  const [fullscreenImage, setFullscreenImage] = useState(null);
  
  // ESC键关闭全屏查看器
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape' && fullscreenImage && !isMobile) {
        setFullscreenImage(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [fullscreenImage, isMobile]);

  // 如果用户未登录，重定向到登录页面
  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
    }
  }, [currentUser, navigate]);

  // 显示错误模态框
  const showError = useCallback((title, message, details = "") => {
    setErrorModal({
      show: true,
      title,
      message,
      details,
      showRetry: false,
    });
  }, []);

  // 提示词优化函数
  const optimizePrompt = useCallback(async () => {
    if (!prompt.trim()) {
      showError('提示词为空', '请先输入提示词');
      return;
    }
    
    const check = checkApiKeyAvailable();
    if (!check.isValid) {
      showError('无法优化提示词', check.errorMessage);
      return;
    }
    
    try {
      setLoadingSuggestion(true);
      setSuggestedPrompt('');
      
      const response = await fetch(`${API_BASE_URL}/api/gemini/optimize-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          userPrompt: prompt,
          apiKey: currentUser?.showApiConfig ? apiKey : undefined,
          mode: mode, // 传递当前模式（generate/edit/compose）
          hasImages: uploadedImages.length > 0, // 是否有上传图片
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '优化失败');
      }
      
      const result = await response.json();
      setSuggestedPrompt(result.optimizedPrompt);
    } catch (error) {
      console.error('提示词优化失败:', error);
      showError('优化失败', error.message || '提示词优化失败，请稍后重试');
    } finally {
      setLoadingSuggestion(false);
    }
  }, [prompt, apiKey, currentUser, mode, uploadedImages, checkApiKeyAvailable, showError]);
  
  // 使用建议的提示词
  const useSuggestedPrompt = useCallback(() => {
    if (suggestedPrompt) {
      setPrompt(suggestedPrompt);
      setSuggestedPrompt(''); // 清空建议
    }
  }, [suggestedPrompt]);

  // 显示带重试按钮的错误
  const showErrorWithRetry = useCallback((title, message, details = "") => {
    setErrorModal({
      show: true,
      title,
      message,
      details,
      showRetry: true,
    });
  }, []);

  // 重试上一次请求
  const retryLastRequest = useCallback(async () => {
    closeErrorModal();
    
    if (!lastRequestBody) {
      showError("重试失败", "没有可重试的请求");
      return;
    }

    if (lastRequestBody.type === "generate") {
      await generateImage();
    } else {
      await processImages();
    }
  }, [lastRequestBody]);

  // 关闭错误模态框
  const closeErrorModal = useCallback(() => {
    setErrorModal({ show: false, title: "", message: "", details: "", showRetry: false });
  }, []);

  // 分享弹窗控制
  const openShareModal = useCallback((record) => {
    const targets = Array.isArray(record.shareTargets) ? record.shareTargets : [];
    setShareModal({ open: true, recordId: record.id, targets: [...targets] });
  }, []);

  const closeShareModal = useCallback(() => setShareModal({ open: false, recordId: null, targets: [] }), []);

  const toggleShareTarget = useCallback((userId) => {
    setShareModal((prev) => {
      const exists = prev.targets.includes(userId);
      return { ...prev, targets: exists ? prev.targets.filter(id => id !== userId) : [...prev.targets, userId] };
    });
  }, []);

  const saveShareTargets = useCallback(async () => {
    try {
      if (!currentUser || !shareModal.recordId) return;
      const res = await fetch(`${API_BASE_URL}/api/share/${currentUser.id}/${shareModal.recordId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ targets: shareModal.targets })
      });
      if (!res.ok) throw new Error('保存分享失败');
      setImageHistory(prev => prev.map(it => it.id === shareModal.recordId ? { ...it, shareTargets: [...shareModal.targets] } : it));
      closeShareModal();
    } catch (e) {
      console.error(e);
      alert('保存分享失败，请重试');
    }
  }, [shareModal, currentUser, closeShareModal]);

  // 智能分析API委婉拒绝模式
  const analyzeRefusalPatterns = (text) => {
    const reasons = [];
    let isRefusal = false;

    // 检查"没找到"相关模式
    if (
      text.includes("没有找到") ||
      text.includes("找不到") ||
      text.includes("not found") ||
      text.includes("没找到") ||
      text.includes("未找到")
    ) {
      reasons.push('• 使用"没找到"模式委婉拒绝');
      isRefusal = true;
    }

    // 检查"没有合适的"模式
    if (
      text.includes("没有合适的") ||
      text.includes("没有适合的") ||
      text.includes("no suitable")
    ) {
      reasons.push('• 使用"没有合适的"模式委婉拒绝');
      isRefusal = true;
    }

    // 检查"无法提供"模式
    if (
      text.includes("无法提供") ||
      text.includes("不能提供") ||
      text.includes("cannot provide")
    ) {
      reasons.push('• 使用"无法提供"模式委婉拒绝');
      isRefusal = true;
    }

    // 检查包含敏感词但假装正常的模式
    const sensitiveWords = [
      "美女",
      "性感",
      "暴露",
      "裸体",
      "淘边",
      "躺着",
      "色情",
    ];
    for (const word of sensitiveWords) {
      if (text.includes(word)) {
        reasons.push(`• 回复中包含敏感词"${word}"但假装正常处理`);
        isRefusal = true;
      }
    }

    // 检查奇怪的描述模式
    if (
      /[0-9]+地[0-9]+/.test(text) ||
      text.includes("向下躺着") ||
      (text.includes("上方") && text.includes("向下"))
    ) {
      reasons.push("• 使用奇怪的描述语言来掩盖拒绝");
      isRefusal = true;
    }

    // 检查文本长度异常短
    if (
      text.length < 50 &&
      (text.includes("照片") || text.includes("图片") || text.includes("image"))
    ) {
      reasons.push("• 响应异常简短，疑似委婉拒绝");
      isRefusal = true;
    }

    return { isRefusal, reasons };
  };

  // 解析API错误响应
  const parseAPIError = (data) => {
    let title = "生成失败";
    let message = "遇到了未知错误，请重试";
    let details = "";

    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];

      // 检查是否被安全过滤器阻止
      if (candidate.finishReason === "SAFETY") {
        title = "内容安全检查";
        message = "您的请求内容可能包含不当信息，已被安全过滤器阻止";

        if (candidate.safetyRatings) {
          const blockedRatings = candidate.safetyRatings.filter(
            (rating) =>
              rating.probability === "HIGH" || rating.probability === "MEDIUM",
          );
          if (blockedRatings.length > 0) {
            const categories = blockedRatings
              .map((r) => {
                switch (r.category) {
                  case "HARM_CATEGORY_HARASSMENT":
                    return "骚扰内容";
                  case "HARM_CATEGORY_HATE_SPEECH":
                    return "仇恨言论";
                  case "HARM_CATEGORY_SEXUALLY_EXPLICIT":
                    return "成人内容";
                  case "HARM_CATEGORY_DANGEROUS_CONTENT":
                    return "危险内容";
                  default:
                    return r.category;
                }
              })
              .join("、");
            details = `触发的安全检查类型：${categories}\n\n完整安全评级：\n${JSON.stringify(candidate.safetyRatings, null, 2)}\n\n完整候选信息：\n${JSON.stringify(candidate, null, 2)}`;
          } else {
            details = `完整候选信息：\n${JSON.stringify(candidate, null, 2)}`;
          }
        } else {
          details = `完整候选信息：\n${JSON.stringify(candidate, null, 2)}`;
        }

        message +=
          "\n\n💡 建议：\n• 尝试使用更温和的描述词语\n• 避免可能引起争议的内容\n• 重新组织您的提示词";
        return { title, message, details };
      }

      // 检查 finishReason = "STOP" 但没有图像的情况
      if (candidate.finishReason === "STOP") {
        // 检查是否有图像输出
        const hasImage = candidate.content?.parts?.some(part => part.inlineData?.data);
        
        if (!hasImage) {
          title = "提示词需要优化";
          message = "AI 理解了您的请求，但无法生成相应的图像\n\n💡 可能的原因：\n• 提示词过于简短或模糊\n• 描述不够具体和详细\n• 缺少视觉相关的描述\n\n✨ 建议：\n• 增加更多细节描述（场景、颜色、风格等）\n• 使用更具体的形容词\n• 参考示例：\"一只橘色的猫咪坐在窗台上，阳光透过窗户洒在它身上，温馨的室内场景\"";
          details = `API 正常结束但未返回图像\n\n完整响应：\n${JSON.stringify(candidate, null, 2)}`;
          return { title, message, details };
        }
      }
      
      // 检查其他finish原因
      if (candidate.finishReason && candidate.finishReason !== "STOP") {
        switch (candidate.finishReason) {
          case "IMAGE_SAFETY":
            title = "图像安全检查";
            message =
              "生成的图像内容被安全检查系统拦截，无法完成生成\n\n💡 说明：\n• 这是专门针对图像内容的安全检查\n• 即使文本描述看似正常，生成的图像可能触发安全规则\n• 建议尝试更温和、更抽象的描述词语";
            break;
          case "MAX_TOKENS":
            title = "响应长度限制";
            message = "生成内容超出了最大长度限制，请尝试简化提示词";
            break;
          case "RECITATION":
            title = "内容重复检测";
            message = "生成的内容可能重复了训练数据，请调整提示词";
            break;
          case "OTHER":
            title = "生成中断";
            message = "图像生成过程被中断，请重试或调整提示词";
            break;
          default:
            title = "生成异常";
            message = `生成过程异常结束 (${candidate.finishReason})，请重试`;
        }
        details = `结束原因：${candidate.finishReason}\n\n完整候选信息：\n${JSON.stringify(candidate, null, 2)}`;
        return { title, message, details };
      }

      // 检查是否有文本响应但没有图像
      if (candidate.content && candidate.content.parts) {
        const textParts = candidate.content.parts.filter((part) => part.text);
        if (textParts.length > 0) {
          title = "无法生成图像";
          const responseText = textParts.map((part) => part.text).join(" ");

          const isLikelyRefusal = analyzeRefusalPatterns(responseText);

          if (
            responseText.toLowerCase().includes("cannot") ||
            responseText.toLowerCase().includes("unable")
          ) {
            message = "API明确表示无法处理您的请求";
          } else if (
            responseText.toLowerCase().includes("safety") ||
            responseText.toLowerCase().includes("policy")
          ) {
            message = "请求可能违反了内容政策，无法生成图像";
          } else if (isLikelyRefusal.isRefusal) {
            title = "内容被拒绝";
            message = `API以委婉的方式拒绝了您的请求\n\n🔍 检测到的拒绝模式：\n${isLikelyRefusal.reasons.join("\n")}\n\n💡 这种情况说明：\n• API检测到了潜在的不当内容\n• 但选择用看似正常的回复来委婉拒绝\n• 建议修改描述词避免敏感内容`;
          } else {
            title = "疑似内容拒绝";
            message =
              "API返回了文本响应但没有生成图像，这通常表示内容可能不被允许\n\n💡 建议：\n• 尝试修改描述词语\n• 避免可能敏感的内容\n• 使用更抽象或艺术化的表达";
          }

          details = `API文本响应：${responseText}\n\n完整候选信息：\n${JSON.stringify(candidate, null, 2)}`;
          return { title, message, details };
        }
      }
    }

    if (!data.candidates) {
      title = "API响应异常";
      message = "API没有返回预期的候选结果，请检查API密钥和网络连接";
    }

    return { title, message, details: JSON.stringify(data, null, 2) };
  };

  // 判定提示词是否偏短（容易出现只返回文本的情况）
  const isShortPrompt = (text) => {
    if (!text) return true;
    const s = String(text).trim();
    const wordCount = s.split(/\s+/).filter(Boolean).length;
    return s.length < 25 || wordCount < 6;
  };

  // 是否适合自动重试（文本响应但无图像、且提示词偏短）
  const shouldAutoRetryOnNoImage = (error, textPrompt) => {
    if (!error || !error.cause) return false;
    if (error.cause.isTimeout) return false;
    const title = String(error.cause.title || "");
    // 明确不重试的类型
    const noRetryHints = ["内容安全", "图像安全", "响应长度限制", "请求已取消", "API请求失败"];
    if (noRetryHints.some((k) => title.includes(k))) return false;
    // 允许重试的类型
    const retryHints = ["无法生成图像", "疑似内容拒绝", "内容被拒绝"];
    const looksLikeNoImage = retryHints.some((k) => title.includes(k));
    return looksLikeNoImage && isShortPrompt(textPrompt);
  };

  // 将图片转换为base64
  const imageToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 创建图片预览URL
  const createImageUrl = useCallback((file) => {
    return URL.createObjectURL(file);
  }, []);

  // 将 dataURL 转换为 File
  const dataUrlToFile = useCallback((dataUrl, fallbackName = `generated_${Date.now()}.png`) => {
    try {
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/data:(.*?);base64/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(arr[1] || '');
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const ext = mime.includes('jpeg') ? 'jpg' : (mime.split('/')[1] || 'png');
      const filename = fallbackName.endsWith(`.${ext}`) ? fallbackName : `${fallbackName}.${ext}`;
      return new File([u8arr], filename, { type: mime });
    } catch (e) {
      console.error('dataUrl 转 File 失败:', e);
      return null;
    }
  }, []);

  // 生成基于日期时间的文件名
  const generateFileName = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const countBase = currentUser?.generationStats?.today;
    const nextCount =
      typeof countBase === "number" && !Number.isNaN(countBase)
        ? countBase + 1
        : 1;

    return `${year}${month}${day}_${hours}${minutes}${seconds}_${nextCount}`;
  }, [currentUser]);

  // 上传图片到服务器
  const uploadImageToServer = useCallback(async (imageData, fileName, userId) => {
    try {
      console.log("📤 开始上传图片到服务器...");
      
      // 诊断：计算实际大小
      const imageSizeBytes = imageData.length;
      const imageSizeMB = (imageSizeBytes / 1024 / 1024).toFixed(2);
      console.log(`📊 图片BASE64大小: ${imageSizeMB} MB (${imageSizeBytes} 字节)`);
      
      // 计算JSON请求体的实际大小
      const requestBody = {
        imageData,
        fileName,
        userId
      };
      const requestBodyStr = JSON.stringify(requestBody);
      const requestSizeBytes = new Blob([requestBodyStr]).size;
      const requestSizeMB = (requestSizeBytes / 1024 / 1024).toFixed(2);
      console.log(`📦 完整请求体大小: ${requestSizeMB} MB (${requestSizeBytes} 字节)`);
      
      if (requestSizeBytes > 100 * 1024 * 1024) {
        console.error(`❌ 请求体过大！${requestSizeMB} MB > 100 MB`);
        throw new Error(`图片过大 (${requestSizeMB} MB)，请生成较小的图片或降低分辨率`);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/images/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          imageData,
          fileName,
          userId
        }),
      });

      console.log(`🌐 发送请求到: ${API_BASE_URL}/api/images/upload`);
      
      if (response.ok) {
        const result = await response.json();
        console.log("✅ 图片上传成功:", result.imageUrl);
        return result.imageUrl;
      } else {
        console.error(`❌ 服务器返回错误: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error("错误详情:", errorText);
        throw new Error(`上传失败 (${response.status}): ${errorText}`);
      }
    } catch (error) {
      console.error("❌ 图片上传失败:", error);
      console.error("错误类型:", error.name);
      console.error("错误消息:", error.message);
      throw error;
    }
  }, []);

  // 保存图片到会话历史记录（内存存储）
  const saveImageToHistory = useCallback(
    async (imageUrl, prompt, mode, duration = null) => {
      try {
        // 生成文件名
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");
        const hours = String(now.getHours()).padStart(2, "0");
        const minutes = String(now.getMinutes()).padStart(2, "0");
        const seconds = String(now.getSeconds()).padStart(2, "0");
        const randomId = Math.floor(Math.random() * 1000);
        const fileName = `${year}${month}${day}_${hours}${minutes}${seconds}_${randomId}`;
        const fullFileName = `bob-studio_${fileName}.png`;

        // 如果是 BASE64 数据且用户已登录，必须上传到服务器
        let finalImageUrl = imageUrl;
        if (imageUrl.startsWith('data:image/') && currentUser) {
          console.log("🔄 检测到 BASE64 图片，上传到服务器...");
          try {
            finalImageUrl = await uploadImageToServer(imageUrl, fullFileName, currentUser.id);
            console.log("✅ 图片已转换为服务器URL:", finalImageUrl);
          } catch (error) {
            console.error("❌ 图片上传失败！", error);
            // 上传失败就直接报错，不要继续
            showError(
              "图片保存失败", 
              `无法上传图片到服务器: ${error.message}。请检查：\n1. 图片是否过大\n2. 服务器配置是否正确\n3. 网络连接是否正常`,
              ""
            );
            return; // 停止保存
          }
        }

        // 创建图片记录
        const imageRecord = {
          id: Date.now().toString(),
          imageUrl: finalImageUrl, // 使用服务器URL或BASE64
          fileName: fullFileName,
          prompt,
          mode,
          createdAt: new Date().toISOString(),
          userId: currentUser?.id || "anonymous",
          duration, // 生成耗时（秒）
        };

        // 添加到当前会话历史记录（内存存储）
        setImageHistory((prev) => {
          const updatedHistory = [imageRecord, ...prev];

          // 同时保存到服务器（如果用户已登录）
          if (currentUser) {
            saveHistoryToServer(updatedHistory, currentUser.id).catch((error) => {
              console.warn("⚠️ 服务器暂时不可用，图片已保存到本地缓存");
              setServerAvailable(false);
              
              // 保存到本地缓存
              const key = `pending_sync_${currentUser.id}`;
              const newPending = [imageRecord, ...pendingSync];
              setPendingSync(newPending);
              localStorage.setItem(key, JSON.stringify(newPending));
              
              // 显示友好提示
              showError(
                "⚠️ 服务器暂时不可用",
                "图片已成功生成并保存到本地缓存！\n\n请不要刷新页面或关闭浏览器。\n等服务器恢复后，点击\"同步到服务器\"按钮即可将历史记录保存到云端。",
                `待同步记录数: ${newPending.length}`
              );
            });
          }

          return updatedHistory;
        });
      } catch (error) {
        console.error("保存图片到历史记录失败:", error);
        showError("保存失败", "保存图片到历史记录时出现错误");
      }
    },
    [currentUser, showError, saveHistoryToServer, uploadImageToServer, pendingSync],
  );

  // 手动下载图片
  const downloadImage = (imageUrl, fileName) => {
    if (!imageUrl) return;

    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = fileName || `bob-studio_${generateFileName()}.png`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 导出历史记录到文件
  const exportHistoryToFile = useCallback(() => {
    if (!currentUser || imageHistory.length === 0) {
      alert("没有历史记录可以导出");
      return;
    }

    try {
      const fileName = `bob-studio-history-${currentUser.id}.json`;
      const dataToSave = JSON.stringify(imageHistory, null, 2);

      // 创建并下载JSON文件
      const blob = new Blob([dataToSave], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ 历史记录已导出到文件: ${fileName}`);
      alert(`历史记录已导出到文件: ${fileName}`);
    } catch (error) {
      console.error("❌ 导出历史记录失败:", error);
      alert("导出失败，请重试");
    }
  }, [currentUser, imageHistory]);

  // 同步待处理记录到服务器
  const syncPendingToServer = useCallback(async () => {
    if (!currentUser || pendingSync.length === 0) {
      return;
    }

    console.log(`🔄 开始同步 ${pendingSync.length} 条待处理记录到服务器...`);

    try {
      // 合并待同步记录和当前历史记录
      const mergedHistory = [...pendingSync, ...imageHistory];
      
      // 去重（按 id）
      const uniqueHistory = Array.from(
        new Map(mergedHistory.map(item => [item.id, item])).values()
      );

      // 尝试保存到服务器
      await saveHistoryToServer(uniqueHistory, currentUser.id);

      // 成功后清除本地缓存
      const key = `pending_sync_${currentUser.id}`;
      localStorage.removeItem(key);
      setPendingSync([]);
      setServerAvailable(true);

      console.log(`✅ 成功同步 ${pendingSync.length} 条记录到服务器`);
      showError(
        "✅ 同步成功", 
        `已成功将 ${pendingSync.length} 条历史记录同步到服务器！\n现在可以安全地刷新页面了。`,
        ""
      );
    } catch (error) {
      console.error("❌ 同步失败:", error);
      setServerAvailable(false);
      showError(
        "同步失败",
        "服务器仍然不可用，请稍后再试。\n您的数据仍安全保存在本地缓存中。",
        error.message
      );
    }
  }, [currentUser, pendingSync, imageHistory, saveHistoryToServer, showError]);

  // 从文件导入历史记录
  const importHistoryFromFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const historyData = JSON.parse(text);

        if (Array.isArray(historyData)) {
          setImageHistory(historyData);
          console.log(`✅ 已导入 ${historyData.length} 张图片的历史记录`);
          alert(`成功导入 ${historyData.length} 张图片的历史记录`);
        } else {
          alert("文件格式不正确");
        }
      } catch (error) {
        console.error("❌ 导入历史记录失败:", error);
        alert("导入失败，请检查文件格式");
      }
    };
    input.click();
  }, []);

  // 删除单条会话历史记录（逻辑删除）
  const deleteHistoryImage = useCallback(
    (imageId) => {
      setImageHistory((prev) => {
        // 逻辑删除：标记为已删除，而不是真正删除记录
        const updatedHistory = prev.map((record) => 
          record.id === imageId 
            ? { ...record, deleted: true, deletedAt: new Date().toISOString() }
            : record
        );

        // 同时更新服务器
        if (currentUser) {
          saveHistoryToServer(updatedHistory, currentUser.id);
        }

        return updatedHistory;
      });
      console.log("已逻辑删除历史记录:", imageId);
    },
    [currentUser, saveHistoryToServer],
  );

  // 清空所有会话历史记录
  const clearAllHistory = useCallback(() => {
    if (!imageHistory || imageHistory.length === 0) return;
    if (window.confirm("确定要清空当前会话的所有历史记录吗？这将进行逻辑删除（仅管理员可见已删除记录）。")) {
      const now = new Date().toISOString();
      const updated = imageHistory.map(record => (
        record.deleted ? record : { ...record, deleted: true, deletedAt: now }
      ));

      // 本地更新（普通用户视图中将被过滤掉）
      setImageHistory(updated);

      // 同步到服务器，保持统计口径一致（包含已删除）
      if (currentUser) {
        saveHistoryToServer(updated, currentUser.id);
      }

      console.log("已逻辑清空所有历史记录（管理员仍可见）");
    }
  }, [currentUser, saveHistoryToServer, imageHistory]);

  // 更新用户统计（刷新用户信息以获取最新统计数据）
  const updateStats = useCallback(async () => {
    if (refreshUser) {
      const result = await refreshUser();
      if (result.success) {
        console.log("✅ 图像生成完成，统计已更新:", result.user.generationStats);
      } else {
        console.log("⚠️ 统计更新失败:", result.error);
      }
    }
  }, [refreshUser]);

  // 处理文件的通用函数
  const processFiles = useCallback(
    (files) => {
      if (files.length === 0) return;

      const imageFiles = files.filter((file) => file.type.startsWith("image/"));
      if (imageFiles.length === 0) {
        showError(
          "文件类型错误",
          "请选择图片文件（支持 JPG、PNG、GIF、WebP 等格式）",
        );
        return;
      }

      const newUrls = imageFiles.map(createImageUrl);

      if (mode === "edit") {
        setUploadedImages(imageFiles);
        setImageUrls(newUrls);
      } else {
        setUploadedImages((prev) => [...prev, ...imageFiles]);
        setImageUrls((prev) => [...prev, ...newUrls]);
      }

      console.log(
        `已上传${imageFiles.length}张图片，当前总数：${uploadedImages.length + imageFiles.length}`,
      );
    },
    [mode, uploadedImages.length, showError, createImageUrl],
  );

  // 处理文件上传
  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files || []);
    processFiles(files);
  };

  // 复制文本到剪贴板（用于快捷复制提示词）
  const copyText = useCallback(async (text) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      alert('✅ 提示词已复制到剪贴板');
    } catch (e) {
      console.error('复制失败:', e);
      alert('❌ 复制失败，请手动选择复制');
    }
  }, []);

  // 从历史记录添加图片到参考区（支持编辑/合成模式）
  const resolveHistoryImageUrl = useCallback((u) => {
    if (!u) return u;
    if (u.startsWith('/images/')) return `${API_BASE_URL}${u}`;
    return u;
  }, []);

  const resolveHistoryServerPath = useCallback((u) => {
    if (!u) return u;
    if (u.startsWith("/images/")) return u;
    try {
      const parsed = new URL(u);
      if (parsed.pathname?.startsWith("/images/")) return parsed.pathname;
    } catch {}
    return u;
  }, []);

  const addHistoryRecordToUpload = useCallback((record) => {
    try {
      if (!(mode === 'edit' || mode === 'compose')) {
        alert('请先切换到“图像编辑”或“图像合成”模式');
        return;
      }

      const serverPath = resolveHistoryServerPath(record.imageUrl); // 形如 /images/...
      const previewUrl = resolveHistoryImageUrl(record.imageUrl);
      const name = record.fileName || `history_${Date.now()}.png`;

      const ext = String(name).split('.').pop()?.toLowerCase();
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
                  : ext === 'png' ? 'image/png'
                  : ext === 'webp' ? 'image/webp'
                  : ext === 'gif' ? 'image/gif'
                  : 'image/png';

      const remoteRef = { __remote: true, serverImagePath: serverPath, name, mimeType: mime };

      if (mode === 'edit') {
        setUploadedImages([remoteRef]);
        setImageUrls([previewUrl]);
      } else {
        setUploadedImages((prev) => [...prev, remoteRef]);
        setImageUrls((prev) => [...prev, previewUrl]);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      console.error('历史图片添加到参考区失败:', e);
      alert('添加失败，请稍后重试');
    }
  }, [mode, resolveHistoryImageUrl, resolveHistoryServerPath]);

  // 将当前生成结果加入参考区
  const addGeneratedToUpload = useCallback(() => {
    try {
      if (!generatedImage) return;

      // 优先使用服务器引用（若有）
      if (typeof generatedImage === 'string' && generatedImage.startsWith('/images/')) {
        const name = `generated_${Date.now()}.png`;
        const remoteRef = { __remote: true, serverImagePath: generatedImage, name, mimeType: 'image/png' };
        const previewUrl = resolveHistoryImageUrl(generatedImage);
        if (!(mode === 'edit' || mode === 'compose')) setMode('edit');
        setUploadedImages([remoteRef]);
        setImageUrls([previewUrl]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // dataURL 场景：直接在前端内存中构造 File（不走网络）
      if (typeof generatedImage === 'string' && generatedImage.startsWith('data:')) {
        const file = dataUrlToFile(generatedImage, `generated_${Date.now()}`);
        if (!file) throw new Error('无法解析生成图片');
        const url = createImageUrl(file);
        if (!(mode === 'edit' || mode === 'compose')) setMode('edit');
        setUploadedImages([file]);
        setImageUrls([url]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      alert('暂不支持的生成结果格式');
    } catch (e) {
      console.error('加入参考区失败:', e);
      alert('加入参考区失败，请重试');
    }
  }, [generatedImage, mode, dataUrlToFile, createImageUrl, resolveHistoryImageUrl]);

  // 拖拽事件处理
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  // 移除指定图片
  const removeImage = (index) => {
    const targetUrl = imageUrls[index];
    if (typeof targetUrl === "string" && targetUrl.startsWith("blob:")) {
      URL.revokeObjectURL(targetUrl);
    }
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
    console.log(`移除了第${index + 1}号图片`);
  };

  // 清空所有图片
  const clearAllImages = () => {
    imageUrls.forEach((url) => {
      if (typeof url === "string" && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    });
    setUploadedImages([]);
    setImageUrls([]);
    console.log("已清空所有图片");
  };

  const addHistoryImageToUploads = useCallback(
    async (record) => {
      try {
        if (!record?.imageUrl) {
          showError("数据缺失", "未找到历史图片的数据源");
          return;
        }

        if (mode === "generate") {
          showError("模式限制", "请先切换到图像编辑或图像合成模式");
          return;
        }

        const response = await fetch(record.imageUrl);
        if (!response.ok) {
          throw new Error(`获取历史图片失败: ${response.status}`);
        }
        const blob = await response.blob();
        let mimeType = blob.type;
        if (!mimeType) {
          const match = record.imageUrl.match(/^data:(.*?);/);
          mimeType = match ? match[1] : "image/png";
        }

        const normalizedName = (() => {
          if (typeof record.fileName === "string" && record.fileName.trim()) {
            return record.fileName.trim();
          }
          const extension = mimeType.includes("jpeg")
            ? "jpg"
            : mimeType.includes("png")
              ? "png"
              : "png";
          return `history-reference-${Date.now()}.${extension}`;
        })();

        const file = new File([blob], normalizedName, { type: mimeType });
        file.__source = "history";
        file.__historyId = record.id;

        if (uploadedImages.some((img) => img?.__historyId === record.id)) {
          showError("已存在", "这张历史图片已经在参考列表中");
          return;
        }

        const previewUrl = URL.createObjectURL(file);

        setUploadedImages((prev) => (mode === "edit" ? [file] : [...prev, file]));

        setImageUrls((prev) => {
          if (mode === "edit") {
            prev.forEach((url) => {
              if (typeof url === "string" && url.startsWith("blob:")) {
                URL.revokeObjectURL(url);
              }
            });
            return [previewUrl];
          }
          return [...prev, previewUrl];
        });

        console.log("已将历史图片添加为参考图像:", record.id);
      } catch (error) {
        console.error("将历史图片添加为参考失败:", error);
        showError("添加失败", "无法将历史图片添加为参考，请稍后再试");
      }
    },
    [mode, uploadedImages, showError],
  );

  // 调用API
  // 继续等待（延长超时时间）
  const continueWaiting = useCallback(() => {
    setShowTimeoutDialog(false);
    console.log("🔄 用户选择继续等待...");
    // 不做任何处理，请求会继续执行
    // 5分钟后会再次触发超时提示
  }, []);

  // 放弃请求
  const cancelRequest = useCallback(() => {
    setShowTimeoutDialog(false);
    if (abortControllerRef.current) {
      console.log("❌ 用户选择放弃请求，中断连接...");
      abortControllerRef.current.abort();
    }
  }, []);

  // 带超时的 fetch 函数（改进版：超时时询问用户而不是直接中断）
  const fetchWithTimeout = async (url, options, timeoutMs = API_TIMEOUT) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const checkTimeout = () => {
      if (!controller.signal.aborted) {
        console.log(`⏰ 请求已运行 ${timeoutMs / 1000} 秒，询问用户是否继续等待...`);
        setShowTimeoutDialog(true);
        
        // 再等待 5 分钟后重新检查
        setTimeout(checkTimeout, API_TIMEOUT);
      }
    };

    const timeoutId = setTimeout(checkTimeout, timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setShowTimeoutDialog(false);
      abortControllerRef.current = null;
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      setShowTimeoutDialog(false);
      abortControllerRef.current = null;
      
      if (error.name === "AbortError") {
        throw new Error("请求已取消", {
          cause: {
            title: "请求已取消",
            message: "您已取消此次图像生成请求",
            details: "如需重新生成，请点击重试按钮",
            isTimeout: false,
          }
        });
      }
      throw error;
    }
  };

  const callAPI = async (requestBody) => {
    try {
      console.log("发送API请求:", JSON.stringify(requestBody, null, 2));
      console.log("⏰ 开始计时...");

      // 通过后端服务器代理调用 Google API（解决中国用户网络屏蔽问题）
      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/gemini/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // 包含 session cookie
          body: JSON.stringify({
            requestBody,
            apiKey,
          }),
        },
        API_TIMEOUT
      );

      console.log("API响应状态:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API错误响应:", errorText);

        if (response.status === 400) {
          throw new Error("请求格式错误或API密钥无效");
        } else if (response.status === 403) {
          // 检查是否是API Key泄露
          let errorDetail = "";
          try {
            const errorData = JSON.parse(errorText);
            if (errorData?.error?.message?.includes('leaked')) {
              throw new Error("🚨 API密钥已泄露\n\nGoogle检测到您的API Key已被公开泄露，已自动封禁该Key。\n\n🔒 紧急措施：\n1. 立即前往Google Cloud Console删除旧Key\n2. 创建新的API Key并设置IP限制\n3. 在设置中更新新的API Key\n4. 检查GitHub等公开场所是否泄露了Key\n\n⚠️ 注意：这不是配额问题，必须更换新Key才能继续使用！");
            }
            errorDetail = errorData?.error?.message || "";
          } catch {}
          
          // 其他403错误
          if (currentUser?.isSuperAdmin) {
            throw new Error(`Google API权限错误\n\n${errorDetail || '请检查API Key配置'}\n\n💡 可能原因：\n• API Key无效或已过期\n• API Key没有访问该模型的权限\n• 配额已用完\n• API Key被限制访问`);
          } else {
            throw new Error("API密钥权限不足或配额已用完");
          }
        } else if (response.status === 429) {
          throw new Error("请求过于频繁，请稍后再试");
        } else {
          throw new Error(`API请求失败 (${response.status}): ${errorText}`);
        }
      }

      const data = await response.json();
      console.log("完整API响应:", JSON.stringify(data, null, 2));

      if (data.candidates && data.candidates.length > 0) {
        const candidate = data.candidates[0];
        console.log("候选结果:", candidate);

        if (candidate.content && candidate.content.parts) {
          for (let i = 0; i < candidate.content.parts.length; i++) {
            const part = candidate.content.parts[i];
            console.log(`部分 ${i}:`, part);

            if (part.inlineData && part.inlineData.data) {
              console.log("找到图像数据，长度:", part.inlineData.data.length);
              return `data:image/png;base64,${part.inlineData.data}`;
            }

            if (part.text) {
              console.log("文本内容:", part.text);
            }
          }
        }
      }

      const errorInfo = parseAPIError(data);
      throw new Error(`${errorInfo.title}: ${errorInfo.message}`, {
        cause: errorInfo,
      });
    } catch (error) {
      console.error("API调用错误:", error);
      throw error;
    }
  };

  // 文本生成图像
  const generateImage = async () => {
    // 使用统一的 API Key 检查函数
    const apiKeyCheck = checkApiKeyAvailable();
    if (!apiKeyCheck.isValid) {
      showError(apiKeyCheck.errorTitle, apiKeyCheck.errorMessage);
      return;
    }

    if (!prompt) {
      showError("参数缺失", "请输入提示词");
      return;
    }

    setLoading(true);
    const startTime = Date.now(); // 记录开始时间
    try {
      const requestBody = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      };

      // 保存请求体以便重试
      setLastRequestBody({ type: "generate", body: requestBody, prompt });

      // 自动重试（最多3次）
      const maxAttempts = 3;
      let imageUrl = null;
      let lastErr = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          imageUrl = await callAPI(requestBody);
          break;
        } catch (err) {
          lastErr = err;
          const shouldRetry = shouldAutoRetryOnNoImage(err, prompt) && attempt < maxAttempts;
          console.warn(`⚠️ 第 ${attempt} 次尝试失败。${shouldRetry ? "准备自动重试..." : "不再重试"}`);
          if (!shouldRetry) throw err;
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (!imageUrl && lastErr) throw lastErr;
      setGeneratedImage(imageUrl);

      // 计算耗时
      const duration = Math.round((Date.now() - startTime) / 1000); // 转换为秒
      console.log(`✅ 图像生成成功！耗时: ${duration} 秒`);

      // 保存到历史记录，包含耗时
      await saveImageToHistory(imageUrl, prompt, "generate", duration);

      // 更新统计
      updateStats();
      
      // 成功后清除重试数据
      setLastRequestBody(null);
    } catch (error) {
      if (error.cause?.isTimeout) {
        // 超时错误，显示重试按钮
        showErrorWithRetry(error.cause.title, error.cause.message, error.cause.details);
      } else if (error.cause) {
        showError(error.cause.title, error.cause.message, error.cause.details);
      } else {
        showError("图像生成失败", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 图像编辑/合成
  const processImages = async () => {
    // 使用统一的 API Key 检查函数
    const apiKeyCheck = checkApiKeyAvailable();
    if (!apiKeyCheck.isValid) {
      showError(apiKeyCheck.errorTitle, apiKeyCheck.errorMessage);
      return;
    }

    if (!prompt || uploadedImages.length === 0) {
      showError("参数缺失", "请输入提示词并上传图像");
      return;
    }

    setLoading(true);
    const startTime = Date.now(); // 记录开始时间
    try {
      const parts = [{ text: prompt }];

      for (let i = 0; i < uploadedImages.length; i++) {
        const item = uploadedImages[i];
        if (item && item.__remote) {
          // 传递服务器图片引用，后端将读取文件并转为 inlineData
          parts.push({ serverImagePath: item.serverImagePath });
        } else {
          const base64Image = await imageToBase64(item);
          parts.push({
            inlineData: {
              mimeType: item.type,
              data: base64Image,
            },
          });
        }
      }

      const requestBody = {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      };

      // 保存请求体以便重试
      setLastRequestBody({ type: mode, body: requestBody, prompt, uploadedImages });

      // 自动重试（最多3次）
      const maxAttempts = 3;
      let imageUrl = null;
      let lastErr = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          imageUrl = await callAPI(requestBody);
          break;
        } catch (err) {
          lastErr = err;
          const shouldRetry = shouldAutoRetryOnNoImage(err, prompt) && attempt < maxAttempts;
          console.warn(`⚠️ 第 ${attempt} 次尝试失败（编辑/合成）。${shouldRetry ? "准备自动重试..." : "不再重试"}`);
          if (!shouldRetry) throw err;
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      if (!imageUrl && lastErr) throw lastErr;
      setGeneratedImage(imageUrl);

      // 计算耗时
      const duration = Math.round((Date.now() - startTime) / 1000); // 转换为秒
      console.log(`✅ 图像处理成功！耗时: ${duration} 秒`);

      // 保存到历史记录，包含耗时
      await saveImageToHistory(imageUrl, prompt, mode, duration);

      // 更新统计
      updateStats();
      
      // 成功后清除重试数据
      setLastRequestBody(null);
    } catch (error) {
      if (error.cause?.isTimeout) {
        // 超时错误，显示重试按钮
        showErrorWithRetry(error.cause.title, error.cause.message, error.cause.details);
      } else if (error.cause) {
        showError(error.cause.title, error.cause.message, error.cause.details);
      } else {
        showError("图像处理失败", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const executeAction = () => {
    console.log("执行动作，当前模式:", mode);
    console.log("🔍 当前状态调试信息:");
    console.log("- mode:", mode);
    console.log("- loading:", loading);
    console.log("- apiKey:", apiKey ? '已配置' : '未配置');
    console.log("- prompt:", prompt);
    console.log("- uploadedImages.length:", uploadedImages.length);
    console.log("- uploadedImages:", uploadedImages);

    switch (mode) {
      case "generate":
        generateImage();
        break;
      case "edit":
      case "compose":
        processImages();
        break;
      default:
        console.error("未知模式:", mode);
    }
  };

  // 保存API设置（暂时只是本地状态，后续可以添加后端API）
  const [saveApiLoading, setSaveApiLoading] = useState(false);

  const saveApiSettings = useCallback(async () => {
    try {
      if (!currentUser || !currentUser.showApiConfig) {
        showError("操作受限", "当前账号不支持自助配置 API Key", "");
        return;
      }
      setSaveApiLoading(true);
      const response = await fetch(
        `${
          import.meta.env.DEV
            ? (import.meta.env.VITE_API_URL || "http://localhost:8080")
            : ""
        }/api/me/api-key`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ apiKey }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "保存失败");
      }

      const result = await response.json();
      
      // 如果是超级管理员批量更新，显示详细信息
      if (result.batchUpdated && result.updatedUsersCount !== undefined) {
        if (result.updatedUsersCount > 0) {
          showError(
            "批量更新成功", 
            `✅ 已更新您和其他 ${result.updatedUsersCount} 个使用相同Key的用户\n\n所有受影响的用户将自动使用新的API Key`,
            ""
          );
        } else {
          showError(
            "保存成功", 
            "✅ API 密钥已更新\n\n未发现其他用户使用相同的旧Key",
            ""
          );
        }
      } else {
        showError("保存成功", "API 密钥已更新", "");
      }
    } catch (error) {
      console.error("保存 API Key 失败:", error);
      showError("保存失败", error.message || "API 密钥保存失败，请稍后重试");
    } finally {
      setSaveApiLoading(false);
    }
  }, [apiKey, currentUser, showError]);

  // 切换API配置展开状态（仅前端控制）
  const [apiConfigExpanded, setApiConfigExpanded] = useState(true);
  const toggleApiConfigExpanded = () => {
    setApiConfigExpanded(!apiConfigExpanded);
  };

  // 添加全局事件监听器
  useEffect(() => {
    const handleGlobalPaste = (e) => {
      if (mode === "edit" || mode === "compose") {
        const items = e.clipboardData.items;
        const files = [];

        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            files.push(file);
          }
        }

        if (files.length > 0) {
          processFiles(files);
        }
      }
    };

    const handleGlobalDragOver = (e) => {
      e.preventDefault();
    };

    const handleGlobalDrop = (e) => {
      e.preventDefault();
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && errorModal.show) {
        closeErrorModal();
      }
    };

    document.addEventListener("paste", handleGlobalPaste);
    document.addEventListener("dragover", handleGlobalDragOver);
    document.addEventListener("drop", handleGlobalDrop);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("paste", handleGlobalPaste);
      document.removeEventListener("dragover", handleGlobalDragOver);
      document.removeEventListener("drop", handleGlobalDrop);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    mode,
    uploadedImages.length,
    errorModal.show,
    processFiles,
    closeErrorModal,
  ]);

  // 生成提示词示例
  const getPromptExample = () => {
    if (mode === "generate") {
      return "描述你想要生成的图像，例如：一只戴着帽子的猫在星空下跳舞";
    } else if (uploadedImages.length > 0) {
      return `基于已上传的${uploadedImages.length}张图片，你可以这样描述：
例如："使用图片1中的人物，图片2的背景，创造一个现代艺术风格的合成作品"
或："将图片1的风格应用到图片2的场景中"`;
    } else {
      return '上传图片后，你可以用编号引用：如"将图片1的人物放到图片2的背景中"';
    }
  };

  // 使用统一的 API Key 检查逻辑计算按钮是否可用
  const isApiKeyAvailable = useMemo(() => {
    const check = checkApiKeyAvailable();
    return check.isValid;
  }, [checkApiKeyAvailable]);
  
  // 保持向后兼容
  const hasApiKeyConfigured = isApiKeyAvailable;

  if (!currentUser) {
    return null; // 避免在重定向前显示内容
  }

  // 移动端图集：统一 history / shares 数据结构（用于顶部预览、左右滑动、缩略图选择）
  const mobileHistoryItems = useMemo(() => {
    const parseTime = (value) => {
      if (!value) return 0;
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : 0;
    };

    return nonDeletedHistory
      .slice()
      .sort((a, b) => {
        const diff = parseTime(b?.createdAt) - parseTime(a?.createdAt);
        if (diff) return diff;
        return String(b?.id || "").localeCompare(String(a?.id || ""));
      })
      .map((record) => ({
        key: String(record.id),
        type: "history",
        imageUrl: record.imageUrl,
        prompt: record.prompt || "",
        createdAt: record.createdAt,
        record,
      }));
  }, [nonDeletedHistory]);

  const mobileShareItems = useMemo(() => {
    const parseTime = (value) => {
      if (!value) return 0;
      const t = Date.parse(value);
      return Number.isFinite(t) ? t : 0;
    };

    return (incomingShares || [])
      .slice()
      .sort((a, b) => {
        const diff = parseTime(b?.createdAt) - parseTime(a?.createdAt);
        if (diff) return diff;
        return String(b?.id || "").localeCompare(String(a?.id || ""));
      })
      .map((item) => ({
        key: `${item?.owner?.id || "owner"}-${item?.id || "id"}`,
        type: "share",
        imageUrl: item.imageUrl,
        prompt: item.prompt || "",
        owner: item.owner,
        createdAt: item.createdAt,
        record: item,
      }));
  }, [incomingShares]);

  const mobileGalleryItems = useMemo(() => {
    return mobileLibraryTab === "shares" ? mobileShareItems : mobileHistoryItems;
  }, [mobileLibraryTab, mobileHistoryItems, mobileShareItems]);

  const mobileActiveItem = useMemo(() => {
    if (!mobileGalleryItems.length) return null;
    const idx = Math.max(0, Math.min(mobileActiveIndex, mobileGalleryItems.length - 1));
    return mobileGalleryItems[idx] || null;
  }, [mobileGalleryItems, mobileActiveIndex]);

  const mobileDisplayImageUrl = useMemo(() => {
    if (mobilePreferGenerated && generatedImage) return generatedImage;
    return mobileActiveItem?.imageUrl || generatedImage || null;
  }, [mobileActiveItem, generatedImage, mobilePreferGenerated]);

  const showMobileLibraryNav = useMemo(() => {
    return !mobilePreferGenerated && mobileGalleryItems.length > 0;
  }, [mobilePreferGenerated, mobileGalleryItems.length]);

  const showMobilePromptOverlay = useMemo(() => {
    return !mobileRefExpanded && showMobileLibraryNav && Boolean(mobileActiveItem?.prompt);
  }, [mobileRefExpanded, showMobileLibraryNav, mobileActiveItem?.prompt]);

  useEffect(() => {
    if (!mobileThumbsOpen) {
      setMobileThumbsScrollTop(0);
      setMobileThumbsViewportHeight(0);
      return;
    }

    const el = mobileThumbsScrollRef.current;
    if (!el) return;

    const update = () => {
      setMobileThumbsViewportHeight(el.clientHeight || 0);
      setMobileThumbsScrollTop(el.scrollTop || 0);
    };

    update();

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(update);
      ro.observe(el);
    } else {
      window.addEventListener("resize", update);
    }

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [mobileThumbsOpen, mobileThumbsExpanded, mobileLibraryTab]);

  const mobileThumbsVirtualState = useMemo(() => {
    const cols = 3;
    const paddingPx = 16;
    const gapPx = 12;
    const cellHeightPx = 140;
    const rowHeightPx = cellHeightPx + gapPx;
    const maxRowsInDom = 10;

    const totalItems = mobileGalleryItems.length;
    const totalRows = Math.ceil(totalItems / cols);

    const viewportHeight = Math.max(0, mobileThumbsViewportHeight - paddingPx * 2);
    const minRowsToCoverViewport = viewportHeight
      ? Math.min(totalRows, Math.ceil(viewportHeight / rowHeightPx) + 2)
      : 0;
    const rowsInDom = Math.min(
      totalRows,
      Math.max(minRowsToCoverViewport, Math.min(maxRowsInDom, totalRows)),
    );

    const centerRow = rowHeightPx
      ? Math.floor(Math.max(0, mobileThumbsScrollTop - paddingPx) / rowHeightPx)
      : 0;
    const startRow = rowsInDom
      ? Math.max(0, Math.min(totalRows - rowsInDom, centerRow - Math.floor(rowsInDom / 2)))
      : 0;
    const endRow = rowsInDom ? startRow + rowsInDom - 1 : -1;

    const startIndex = startRow * cols;
    const endIndex = Math.min(totalItems, (endRow + 1) * cols);

    const totalHeightPx = paddingPx * 2 + totalRows * rowHeightPx - (totalRows > 0 ? gapPx : 0);
    const offsetTopPx = paddingPx + startRow * rowHeightPx;

    return {
      paddingPx,
      totalHeightPx,
      offsetTopPx,
      startIndex,
      visibleItems: mobileGalleryItems.slice(startIndex, endIndex),
    };
  }, [mobileGalleryItems, mobileThumbsScrollTop, mobileThumbsViewportHeight]);

  const [mobilePromptScrollState, setMobilePromptScrollState] = useState({
    hasOverflow: false,
    atTop: true,
    atBottom: true,
  });
  const mobilePromptScrollRef = useRef(null);

  const updateMobilePromptScrollState = useCallback(() => {
    const el = mobilePromptScrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 1;
    const atTop = el.scrollTop <= 1;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    setMobilePromptScrollState((prev) => {
      if (
        prev.hasOverflow === hasOverflow &&
        prev.atTop === atTop &&
        prev.atBottom === atBottom
      ) {
        return prev;
      }
      return { hasOverflow, atTop, atBottom };
    });
  }, []);

  useEffect(() => {
    if (generatedImage) setMobilePreferGenerated(true);
  }, [generatedImage]);

  useEffect(() => {
    if (!isMobile) return;
    if (!showMobilePromptOverlay) return;
    setTimeout(() => updateMobilePromptScrollState(), 0);
  }, [isMobile, showMobilePromptOverlay, mobileActiveItem?.prompt, updateMobilePromptScrollState]);

  useEffect(() => {
    if (!mobileGalleryItems.length) {
      if (mobileActiveIndex !== 0) setMobileActiveIndex(0);
      return;
    }
    const idx = Math.max(0, Math.min(mobileActiveIndex, mobileGalleryItems.length - 1));
    if (idx !== mobileActiveIndex) setMobileActiveIndex(idx);
  }, [mobileGalleryItems.length, mobileActiveIndex]);

  useEffect(() => {
    if (!isMobile) {
      setMobileLeftOpen(false);
      setMobileRightOpen(false);
      setMobileThumbsOpen(false);
      setMobileThumbsExpanded(false);
      setMobileRefExpanded(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (mode === "generate") setMobileRefExpanded(false);
  }, [mode]);

  useEffect(() => {
    if (mode !== "edit") return;
    setUploadedImages((prev) => (prev.length > 1 ? [prev[0]] : prev));
    setImageUrls((prev) => (prev.length > 1 ? [prev[0]] : prev));
  }, [mode]);

  const mobilePrev = useCallback(() => {
    if (!mobileGalleryItems.length) return;
    setMobilePreferGenerated(false);
    setMobileActiveIndex((i) => Math.max(0, i - 1));
  }, [mobileGalleryItems.length]);

  const mobileNext = useCallback(() => {
    if (!mobileGalleryItems.length) return;
    setMobilePreferGenerated(false);
    setMobileActiveIndex((i) => Math.min(mobileGalleryItems.length - 1, i + 1));
  }, [mobileGalleryItems.length]);

  const shouldIgnoreViewerSwipe = useCallback((event) => {
    const target = event?.target;
    if (!target?.closest) return false;
    return Boolean(target.closest("[data-no-viewer-swipe]"));
  }, []);

  const onMobileViewerTouchStart = useCallback((event) => {
    if (shouldIgnoreViewerSwipe(event)) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    viewerSwipeRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      t: Date.now(),
      moved: false,
      lastX: touch.clientX,
    };
  }, [shouldIgnoreViewerSwipe]);

  const onMobileViewerTouchMove = useCallback((event) => {
    if (shouldIgnoreViewerSwipe(event)) return;
    const touch = event.touches?.[0];
    if (!touch) return;
    const start = viewerSwipeRef.current;
    viewerSwipeRef.current.lastX = touch.clientX;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      viewerSwipeRef.current.moved = true;
      event.preventDefault();
    }
  }, [shouldIgnoreViewerSwipe]);

  const onMobileViewerTouchEnd = useCallback(
    (event) => {
      if (shouldIgnoreViewerSwipe(event)) return;
      const touch = event.changedTouches?.[0];
      const start = viewerSwipeRef.current;
      if (!touch || !start) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (dx < 0) mobileNext();
      else mobilePrev();
    },
    [mobileNext, mobilePrev, shouldIgnoreViewerSwipe]
  );

  const shouldIgnoreDrawerSwipe = useCallback((event) => {
    const target = event?.target;
    if (!target?.closest) return false;
    return Boolean(target.closest("[data-no-drawer-swipe]"));
  }, []);

  const onMobileRootTouchStart = useCallback(
    (event) => {
      if (shouldIgnoreDrawerSwipe(event)) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      drawerSwipeRef.current = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    },
    [shouldIgnoreDrawerSwipe]
  );

  const onMobileRootTouchEnd = useCallback(
    (event) => {
      if (shouldIgnoreDrawerSwipe(event)) return;
      const touch = event.changedTouches?.[0];
      const start = drawerSwipeRef.current;
      if (!touch || !start) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

      const vw = typeof window !== "undefined" ? window.innerWidth : 0;
      const startX = start.x;
      const fromLeftEdge = startX <= 24;
      const fromRightEdge = vw ? startX >= vw - 24 : false;

      if (dx > 0) {
        if (mobileRightOpen) setMobileRightOpen(false);
        else if (fromLeftEdge) setMobileLeftOpen(true);
      } else {
        if (mobileLeftOpen) setMobileLeftOpen(false);
        else if (fromRightEdge) setMobileRightOpen(true);
      }
    },
    [shouldIgnoreDrawerSwipe, mobileLeftOpen, mobileRightOpen]
  );

  const addMobileReferenceRecordToUpload = useCallback(
    (record) => {
      try {
        if (!(mode === "edit" || mode === "compose")) {
          alert("请先切换到图像编辑或图像生成模式");
          return;
        }

        const serverPath = resolveHistoryServerPath(record?.imageUrl);
        const previewUrl = resolveHistoryImageUrl(record?.imageUrl);
        const name = record?.fileName || `history_${Date.now()}.png`;

        const ext = String(name).split(".").pop()?.toLowerCase();
        const mime =
          ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "png"
              ? "image/png"
              : ext === "webp"
                ? "image/webp"
                : ext === "gif"
                  ? "image/gif"
                  : "image/png";

        const remoteRef = { __remote: true, serverImagePath: serverPath, name, mimeType: mime };

        if (mode === "edit") {
          setUploadedImages([remoteRef]);
          setImageUrls([previewUrl]);
        } else {
          setUploadedImages((prev) => {
            const exists = prev.some(
              (it) => it?.__remote && it.serverImagePath === remoteRef.serverImagePath
            );
            return exists ? prev : [...prev, remoteRef];
          });
          setImageUrls((prev) => {
            const exists = prev.includes(previewUrl);
            return exists ? prev : [...prev, previewUrl];
          });
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        console.error("移动端参考图添加失败:", e);
        alert("添加失败，请稍后重试");
      }
    },
    [mode, resolveHistoryImageUrl, resolveHistoryServerPath]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100">
      {!isMobile && <Navigation />}

      <div className={isMobile ? "w-full max-w-none p-0" : "max-w-7xl mx-auto p-6"}>
        {isMobile && (
          <div
            className="min-h-[100svh] flex flex-col"
            onTouchStart={onMobileRootTouchStart}
            onTouchEnd={onMobileRootTouchEnd}
          >
            {/* 顶部栏：Logo最小化 + 左侧菜单 + 右侧功能 */}
            <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b">
              <div className="h-12 px-3 flex items-center justify-between">
                <button
                  onClick={() => setMobileLeftOpen(true)}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200"
                  title="菜单"
                >
                  <Menu className="w-5 h-5 text-gray-700" />
                </button>

                <button
                  onClick={() => navigate("/studio")}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 active:bg-gray-200"
                  title="BOB Studio"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center shadow-sm">
                    <span className="text-sm leading-none">🎨</span>
                  </div>
                  <div className="text-sm font-bold bg-gradient-to-r from-purple-700 to-blue-700 bg-clip-text text-transparent whitespace-nowrap">
                    BOB Studio
                  </div>
                </button>

                <button
                  onClick={() => setMobileRightOpen(true)}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200"
                  title="功能"
                >
                  <MoreVertical className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {/* 顶部永远显示：三种工作模式 */}
              <div className="px-3 pb-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setMode("generate");
                      clearAllImages();
                    }}
                    className={`h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${
                      mode === "generate"
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <Image className="w-4 h-4" />
                    文本生图
                  </button>
                  <button
                    onClick={() => {
                      setMode("edit");
                      clearAllImages();
                    }}
                    className={`h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${
                      mode === "edit"
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <Edit3 className="w-4 h-4" />
                    图像编辑
                  </button>
                  <button
                    onClick={() => {
                      setMode("compose");
                    }}
                    className={`h-10 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 ${
                      mode === "compose"
                        ? "border-purple-500 bg-purple-50 text-purple-700"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    图像生成
                  </button>
                </div>
              </div>
            </div>

            {/* 主内容：上部效果图 + 便捷提示词输入 */}
            <div className="flex-1 overflow-y-auto px-3 pt-3 pb-24">
              {(mode === "edit" || mode === "compose") && (
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple={mode === "compose"}
                  className="hidden"
                />
              )}

              <div className="bg-white rounded-xl shadow-lg p-3">
                <div className={`flex gap-2 ${mobileRefExpanded ? "items-stretch" : "items-start"}`}>
                  {(mode === "edit" || mode === "compose") && (
                    <>
                      {mobileRefExpanded ? (
                        <div
                          className="w-[42%] max-w-[220px] aspect-square rounded-lg border bg-gray-50 overflow-hidden flex flex-col"
                          data-no-drawer-swipe
                          data-no-viewer-swipe
                        >
                          <div className="p-2 flex items-center justify-between gap-2 border-b bg-white/90">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="h-9 w-9 rounded-lg bg-purple-600 text-white flex items-center justify-center active:bg-purple-700"
                              title="添加参考图片"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={clearAllImages}
                              disabled={uploadedImages.length === 0}
                              className="h-9 w-9 rounded-lg border bg-white text-red-700 flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                              title="清空参考图片"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex-1 overflow-y-auto p-2">
                            {imageUrls.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-sm text-gray-500">
                                暂无参考图
                              </div>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                {imageUrls
                                  .slice()
                                  .reverse()
                                  .map((url, reversedIndex) => {
                                    const originalIndex = imageUrls.length - 1 - reversedIndex;
                                    return (
                                      <div
                                        key={`${originalIndex}-${url}`}
                                        className="relative rounded-lg overflow-hidden border border-gray-200"
                                      >
                                        <img
                                          src={url}
                                          alt={`ref-${originalIndex}`}
                                          className="w-full h-24 object-cover"
                                        />
                                        <button
                                          onClick={() => removeImage(originalIndex)}
                                          className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 active:bg-black/70"
                                          title="移除"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="w-12 shrink-0 flex flex-col gap-2" data-no-drawer-swipe>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-12 h-12 rounded-lg bg-purple-600 text-white flex items-center justify-center active:bg-purple-700"
                            title="添加参考图片"
                          >
                            <Plus className="w-5 h-5" />
                          </button>

                          <button
                            onClick={() => setMobileRefExpanded(true)}
                            className="w-12 h-12 rounded-lg border bg-gray-50 overflow-hidden active:bg-gray-100"
                            title="展开参考图片"
                          >
                            {imageUrls.length > 0 ? (
                              <img
                                src={imageUrls[imageUrls.length - 1]}
                                alt="ref"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-gray-600">
                                参考
                              </div>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex-1">
                    <div
                      className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center"
                      data-no-drawer-swipe
                      onTouchStart={mobileRefExpanded ? undefined : onMobileViewerTouchStart}
                      onTouchMove={mobileRefExpanded ? undefined : onMobileViewerTouchMove}
                      onTouchEnd={mobileRefExpanded ? undefined : onMobileViewerTouchEnd}
                      onClick={mobileRefExpanded ? () => setMobileRefExpanded(false) : undefined}
                    >
                      {mobileDisplayImageUrl ? (
                        <img
                          src={mobileDisplayImageUrl}
                          alt="preview"
                          className="w-full h-full object-contain"
                          onClick={() => {
                            if (mobileRefExpanded) setMobileRefExpanded(false);
                            else setFullscreenImage(mobileDisplayImageUrl);
                          }}
                        />
                      ) : (
                        <div className="text-center text-gray-500">
                          <Image className="w-14 h-14 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">生成效果图将显示在这里</p>
                        </div>
                      )}

                  {!mobileRefExpanded && showMobileLibraryNav && (
                    <>
                      <button
                        onClick={mobilePrev}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/35 text-white flex items-center justify-center active:bg-black/50"
                        title="上一张"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={mobileNext}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/35 text-white flex items-center justify-center active:bg-black/50"
                        title="下一张"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      {!showMobilePromptOverlay && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white bg-black/40 px-2 py-1 rounded-full">
                          {mobileLibraryTab === "shares" ? "共享" : "生图"} {mobileActiveIndex + 1}/{mobileGalleryItems.length}
                        </div>
                      )}
                    </>
                  )}

                  {!mobileRefExpanded && showMobileLibraryNav && !showMobilePromptOverlay && mode !== "generate" && mobileActiveItem?.record && (
                    <button
                      onClick={() => addMobileReferenceRecordToUpload(mobileActiveItem.record)}
                      className="absolute bottom-2 left-2 px-3 py-1.5 rounded-full bg-black/40 text-white text-xs font-semibold active:bg-black/55 flex items-center gap-1"
                      title="加入参考区"
                    >
                      <Plus className="w-4 h-4" />
                      参考
                    </button>
                  )}

                  {showMobilePromptOverlay && (
                    <div
                      data-no-viewer-swipe
                      className="absolute left-0 right-0 bottom-0 px-3 py-2 bg-black/35 backdrop-blur text-white"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        {mode !== "generate" && mobileActiveItem?.record ? (
                          <button
                            onClick={() => addMobileReferenceRecordToUpload(mobileActiveItem.record)}
                            className="px-3 py-1 rounded-full bg-white/15 active:bg-white/25 text-xs font-semibold flex items-center gap-1"
                            title="加入参考区"
                          >
                            <Plus className="w-4 h-4" />
                            参考
                          </button>
                        ) : (
                          <div className="w-[64px]" />
                        )}

                        <div className="text-[11px] text-white/90 bg-black/30 px-2 py-1 rounded-full">
                          {mobileLibraryTab === "shares" ? "共享" : "生图"} {mobileActiveIndex + 1}/{mobileGalleryItems.length}
                        </div>

                        <button
                          onClick={() => {
                            setPrompt(mobileActiveItem.prompt);
                            setTimeout(() => {
                              try {
                                mobilePromptTextareaRef.current?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                                mobilePromptTextareaRef.current?.focus?.();
                              } catch {}
                            }, 0);
                          }}
                          className="px-3 py-1 rounded-full bg-white/15 active:bg-white/25 text-xs font-semibold"
                          title="复用该图提示词"
                        >
                          复用
                        </button>
                      </div>

                      <div className="relative">
                        <div
                          ref={mobilePromptScrollRef}
                          onScroll={updateMobilePromptScrollState}
                          className="h-24 overflow-y-auto pr-2 text-xs leading-5 whitespace-pre-wrap select-text"
                        >
                          {mobileActiveItem.prompt}
                        </div>

                        {mobilePromptScrollState.hasOverflow && !mobilePromptScrollState.atTop && (
                          <div className="pointer-events-none absolute top-0 left-0 right-0 h-5 bg-gradient-to-b from-black/60 to-transparent" />
                        )}
                        {mobilePromptScrollState.hasOverflow && !mobilePromptScrollState.atBottom && (
                          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-black/60 to-transparent" />
                        )}
                      </div>
                    </div>
                  )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-4 mt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-900">提示词</div>
                  {prompt && (
                    <button
                      onClick={() => setPrompt("")}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 active:bg-gray-200 text-gray-700"
                      title="清空提示词"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <textarea
                  ref={mobilePromptTextareaRef}
                  placeholder={getPromptExample()}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg min-h-[140px] max-h-[40vh] resize-none text-base leading-6 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />

                {suggestedPrompt && (
                  <div className="mt-3 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        AI优化建议
                      </div>
                      <button
                        onClick={useSuggestedPrompt}
                        className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
                      >
                        使用
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestedPrompt}</p>
                  </div>
                )}

                {uploadedImages.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium">提示词技巧</p>
                    <p className="text-xs text-blue-600 mt-1">
                      可以用“图片1”、“图片2”…引用特定图片，例如：“将图片1的人物特征应用到图片2的背景中”
                    </p>
                  </div>
                )}

                {!hasApiKeyConfigured && (
                  <p className="mt-3 text-sm text-orange-600">尚未配置 API Key，生成按钮已禁用。</p>
                )}
              </div>
            </div>

            {/* 底部永远显示：提示词助写 + 生成 */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t px-3 py-3">
              <div className="flex items-stretch gap-2">
                <button
                  onClick={optimizePrompt}
                  disabled={loadingSuggestion || loading || !isApiKeyAvailable || !prompt}
                  className="h-12 flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loadingSuggestion ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>助写中</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>助写</span>
                    </>
                  )}
                </button>

                <button
                  onClick={executeAction}
                  disabled={
                    loading ||
                    !isApiKeyAvailable ||
                    !prompt ||
                    ((mode === "edit" || mode === "compose") && uploadedImages.length === 0)
                  }
                  className="h-12 flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>处理中</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>{mode === "generate" ? "生成" : mode === "edit" ? "编辑" : "合成"}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setMobilePreferGenerated(false);
                    setMobileThumbsExpanded(false);
                    setMobileThumbsOpen(true);
                  }}
                  className="h-12 w-12 rounded-lg border bg-white text-gray-800 flex items-center justify-center active:bg-gray-50"
                  title="图库"
                >
                  <Grid3x3 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 左侧抽屉：菜单项归入这里 */}
            {mobileLeftOpen && (
              <div className="fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/40" onClick={() => setMobileLeftOpen(false)} />
                <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-4 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center shadow-sm">
                        <span className="text-base leading-none">🎨</span>
                      </div>
                      <div className="font-semibold">BOB Studio</div>
                    </div>
                    <button
                      onClick={() => setMobileLeftOpen(false)}
                      className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-100"
                      title="关闭"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-4 p-3 rounded-lg bg-gray-50 border">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {currentUser.displayName || currentUser.username}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => {
                        setMobileLeftOpen(false);
                        navigate("/friends");
                      }}
                      className="w-full h-11 rounded-lg border bg-white flex items-center gap-3 px-3"
                    >
                      <Users className="w-4 h-4 text-gray-700" />
                      <span className="text-sm">好友</span>
                    </button>
                    <button
                      onClick={() => {
                        setMobileLeftOpen(false);
                        navigate("/stats");
                      }}
                      className="w-full h-11 rounded-lg border bg-white flex items-center gap-3 px-3"
                    >
                      <BarChart3 className="w-4 h-4 text-gray-700" />
                      <span className="text-sm">统计</span>
                    </button>
                    {currentUser.isSuperAdmin && (
                      <button
                        onClick={() => {
                          setMobileLeftOpen(false);
                          navigate("/admin");
                        }}
                        className="w-full h-11 rounded-lg border bg-white flex items-center gap-3 px-3"
                      >
                        <span className="w-4 h-4 text-yellow-600 text-sm">管</span>
                        <span className="text-sm">管理端</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setMobileLeftOpen(false);
                        navigate("/profile");
                      }}
                      className="w-full h-11 rounded-lg border bg-white flex items-center gap-3 px-3"
                    >
                      <User className="w-4 h-4 text-gray-700" />
                      <span className="text-sm">个人中心</span>
                    </button>

                    <button
                      onClick={() => {
                        setMobileLeftOpen(false);
                        logout();
                      }}
                      className="w-full h-11 rounded-lg border bg-white flex items-center gap-3 px-3 text-red-700"
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">退出</span>
                    </button>
                  </div>

                  {currentUser?.showApiConfig && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                          <Settings className="w-4 h-4" />
                          API配置
                        </div>
                        <button
                          onClick={toggleApiConfigExpanded}
                          className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-100"
                          title={apiConfigExpanded ? "折叠" : "展开"}
                        >
                          {apiConfigExpanded ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>

                      {apiConfigExpanded && (
                        <div className="space-y-2">
                          <div className="relative">
                            <input
                              type={showApiKey ? "text" : "password"}
                              placeholder="输入 Gemini API Key"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              onCopy={(e) => e.preventDefault()}
                              onCut={(e) => e.preventDefault()}
                              className="w-full p-3 pr-10 border border-gray-300 rounded-lg"
                              autoComplete="off"
                              spellCheck="false"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500"
                              title={showApiKey ? "隐藏" : "显示"}
                            >
                              {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                          <button
                            onClick={saveApiSettings}
                            disabled={!apiKey || saveApiLoading}
                            className="w-full h-11 bg-green-600 text-white rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {saveApiLoading ? "保存中…" : "保存"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 右侧抽屉：生图/共享 + 快捷操作 */}
            {mobileRightOpen && (
              <div className="fixed inset-0 z-50">
                <div className="absolute inset-0 bg-black/40" onClick={() => setMobileRightOpen(false)} />
                <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl p-4 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900">功能</div>
                    <button
                      onClick={() => setMobileRightOpen(false)}
                      className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-100"
                      title="关闭"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setMobileLibraryTab("history");
                      setMobileActiveIndex(0);
                      setMobilePreferGenerated(false);
                      setMobileThumbsExpanded(false);
                    }}
                      className={`h-11 rounded-lg border font-medium ${
                        mobileLibraryTab === "history"
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-gray-200 bg-white text-gray-800"
                      }`}
                    >
                      生图
                    </button>
                  <button
                    onClick={() => {
                      setMobileLibraryTab("shares");
                      setMobileActiveIndex(0);
                      setMobilePreferGenerated(false);
                      setMobileThumbsExpanded(false);
                      loadIncomingShares();
                    }}
                      className={`h-11 rounded-lg border font-medium ${
                        mobileLibraryTab === "shares"
                          ? "border-purple-500 bg-purple-50 text-purple-700"
                          : "border-gray-200 bg-white text-gray-800"
                      }`}
                    >
                      共享
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <button
                      onClick={() => {
                        setMobilePreferGenerated(false);
                        setMobileThumbsOpen(true);
                        setMobileThumbsExpanded(false);
                      }}
                      className="w-full h-11 rounded-lg border bg-white flex items-center justify-center gap-2"
                    >
                      <Grid3x3 className="w-4 h-4" />
                      缩略图选择
                    </button>

                    {mobileLibraryTab === "shares" && (
                      <button
                        onClick={loadIncomingShares}
                        className="w-full h-11 rounded-lg border bg-white flex items-center justify-center gap-2"
                      >
                        刷新共享
                      </button>
                    )}
                  </div>

                  <div className="mt-6">
                    <div className="text-sm font-semibold text-gray-900 mb-2">当前图片操作</div>
                    <div className="space-y-2">
                      {mobileActiveItem?.type === "history" && (
                        <>
                          {(mode === "edit" || mode === "compose") && (
                            <button
                              onClick={() => {
                                addMobileReferenceRecordToUpload(mobileActiveItem.record);
                                setMobileRightOpen(false);
                              }}
                              className="w-full h-11 rounded-lg bg-purple-600 text-white flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              加入参考区
                            </button>
                          )}
                          <button
                            onClick={() =>
                              downloadImage(mobileActiveItem.record.imageUrl, mobileActiveItem.record.fileName)
                            }
                            className="w-full h-11 rounded-lg bg-green-600 text-white flex items-center justify-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            下载
                          </button>
                          <button
                            onClick={() => openShareModal(mobileActiveItem.record)}
                            className="w-full h-11 rounded-lg bg-blue-600 text-white flex items-center justify-center gap-2"
                          >
                            <Share2 className="w-4 h-4" />
                            分享
                          </button>
                          <button
                            onClick={() => {
                              deleteHistoryImage(mobileActiveItem.record.id);
                              setMobileRightOpen(false);
                            }}
                            className="w-full h-11 rounded-lg bg-red-600 text-white flex items-center justify-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            删除
                          </button>
                        </>
                      )}

                      {mobileActiveItem?.type === "share" && (
                        <>
                          {(mode === "edit" || mode === "compose") && (
                            <button
                              onClick={() => {
                                addMobileReferenceRecordToUpload(mobileActiveItem.record);
                                setMobileRightOpen(false);
                              }}
                              className="w-full h-11 rounded-lg bg-purple-600 text-white flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" />
                              加入参考区
                            </button>
                          )}
                        </>
                      )}

                      {mobileActiveItem?.prompt && (
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setPrompt(mobileActiveItem.prompt);
                              setMobileRightOpen(false);
                            }}
                            className="w-full h-11 rounded-lg border bg-white flex items-center justify-center gap-2"
                          >
                            复用提示词
                          </button>
                          <button
                            onClick={() => copyText(mobileActiveItem.prompt)}
                            className="w-full h-11 rounded-lg border bg-white flex items-center justify-center gap-2"
                          >
                            复制提示词
                          </button>
                        </div>
                      )}

                      {mobileDisplayImageUrl && (
                        <button
                          onClick={() => setFullscreenImage(mobileDisplayImageUrl)}
                          className="w-full h-11 rounded-lg border bg-white flex items-center justify-center gap-2"
                        >
                          全屏查看
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 缩略图选择：扩大选择范围 */}
            {mobileThumbsOpen && (
              <div className="fixed inset-0 z-50">
                {!mobileThumbsExpanded && (
                  <div className="absolute inset-0 bg-black/50" onClick={() => setMobileThumbsOpen(false)} />
                )}

                <div
                  className={
                    mobileThumbsExpanded
                      ? "absolute inset-0 bg-white shadow-2xl flex flex-col"
                      : "absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl h-[66svh] flex flex-col"
                  }
                >
                  <div className="p-4 flex items-center justify-between border-b">
                    <div className="font-semibold">
                      {mobileLibraryTab === "shares" ? "共享" : "生图"}图库（{mobileGalleryItems.length}）
                    </div>

                    <div className="flex items-center gap-2">
                      {!mobileThumbsExpanded ? (
                        <button
                          onClick={() => setMobileThumbsExpanded(true)}
                          className="px-3 h-10 rounded-lg border bg-white hover:bg-gray-50"
                          title="全屏"
                        >
                          全屏
                        </button>
                      ) : (
                        <button
                          onClick={() => setMobileThumbsExpanded(false)}
                          className="px-3 h-10 rounded-lg border bg-white hover:bg-gray-50"
                          title="返回"
                        >
                          返回
                        </button>
                      )}

                      <button
                        onClick={() => setMobileThumbsOpen(false)}
                        className="w-10 h-10 inline-flex items-center justify-center rounded-lg hover:bg-gray-100"
                        title="关闭"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div
                    ref={mobileThumbsScrollRef}
                    onScroll={(e) => setMobileThumbsScrollTop(e.currentTarget.scrollTop)}
                    className="flex-1 overflow-y-auto"
                  >
                    <div className="relative" style={{ height: mobileThumbsVirtualState.totalHeightPx }}>
                      <div
                        className="absolute left-0 right-0"
                        style={{
                          top: mobileThumbsVirtualState.offsetTopPx,
                          paddingLeft: mobileThumbsVirtualState.paddingPx,
                          paddingRight: mobileThumbsVirtualState.paddingPx,
                        }}
                      >
                        <div className="grid grid-cols-3 gap-3">
                          {mobileThumbsVirtualState.visibleItems.map((it, localIndex) => {
                            const idx = mobileThumbsVirtualState.startIndex + localIndex;
                            const canAddToUpload = mode === "edit" || mode === "compose";
                            const hasPrompt = Boolean(it.prompt);

                            return (
                              <div key={it.key} className="h-[140px] flex flex-col gap-2">
                                <button
                                  onClick={() => {
                                    setMobilePreferGenerated(false);
                                    setMobileActiveIndex(idx);
                                    setMobileThumbsOpen(false);
                                  }}
                                  className={`relative w-full rounded-lg overflow-hidden border ${
                                    idx === mobileActiveIndex ? "border-purple-500" : "border-gray-200"
                                  }`}
                                  style={{ height: 96 }}
                                  title={`第 ${idx + 1} 张`}
                                >
                                  <img
                                    src={it.imageUrl}
                                    alt="thumb"
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute bottom-1 right-1 text-[10px] text-white bg-black/50 px-1.5 py-0.5 rounded">
                                    {idx + 1}
                                  </div>
                                </button>

                                <div className="grid grid-cols-2 gap-2">
                                  <button
                                    onClick={() => {
                                      if (!canAddToUpload) return;
                                      addMobileReferenceRecordToUpload(it.record);
                                      setMobileThumbsOpen(false);
                                    }}
                                    disabled={!canAddToUpload}
                                    className="h-9 rounded-lg bg-purple-600 text-white text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                    title="加入参考区"
                                  >
                                    <Plus className="w-4 h-4" />
                                    参考
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!it.prompt) return;
                                      setPrompt(it.prompt);
                                      setMobileThumbsOpen(false);
                                    }}
                                    disabled={!hasPrompt}
                                    className="h-9 rounded-lg border bg-white text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="复用提示词"
                                  >
                                    复用
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!isMobile && (
          <>
        {/* API配置（仅允许自助配置时显示） */}
        {currentUser?.showApiConfig && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold">API配置</h2>
              </div>
              <button
                onClick={toggleApiConfigExpanded}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                title={apiConfigExpanded ? "折叠配置" : "展开配置"}
              >
                {apiConfigExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {apiConfigExpanded && (
              <>
                <div className="flex gap-3">
                  <div className="flex-1 relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="请输入Gemini API密钥"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      onCopy={(e) => {
                        e.preventDefault();
                        alert('🔒 为保护您的API密钥安全，禁止复制操作');
                      }}
                      onCut={(e) => {
                        e.preventDefault();
                        alert('🔒 为保护您的API密钥安全，禁止剪切操作');
                      }}
                      onKeyDown={(e) => {
                        // 禁止 Ctrl+C 和 Ctrl+X (Windows/Linux)
                        // 禁止 Cmd+C 和 Cmd+X (Mac)
                        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x')) {
                          e.preventDefault();
                          alert('🔒 为保护您的API密钥安全，禁止复制/剪切操作');
                        }
                      }}
                      className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      autoComplete="off"
                      spellCheck="false"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      title={showApiKey ? "隐藏密钥" : "显示密钥"}
                    >
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <button
                    onClick={saveApiSettings}
                    disabled={!apiKey || saveApiLoading}
                    className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saveApiLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        保存中…
                      </span>
                    ) : (
                      "保存"
                    )}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  前往 <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Google AI Studio</a> 获取免费API密钥
                </p>
              </>
            )}
            {!apiConfigExpanded && (
              <p className="text-sm text-gray-500 mt-2">点击展开按钮查看API配置选项</p>
            )}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 左侧控制面板 */}
          <div className="space-y-6">
            {/* 用户统计 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">今日统计</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-purple-600">{stats.today}</div>
                  <div className="text-sm text-gray-500">今日</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">{stats.thisMonth}</div>
                  <div className="text-sm text-gray-500">本月</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">{stats.total}</div>
                  <div className="text-sm text-gray-500">总计</div>
                </div>
              </div>
              {remainingQuota !== null && (
                <div className={`mt-3 text-sm px-3 py-2 rounded ${
                  remainingQuota.isSuperAdmin 
                    ? 'text-purple-700 bg-purple-50 border border-purple-200'
                    : remainingQuota.unlimited
                      ? 'text-green-700 bg-green-50 border border-green-200'
                      : 'text-amber-700 bg-amber-50 border border-amber-200'
                }`}>
                  {remainingQuota.isSuperAdmin ? (
                    <>
                      👑 超级管理员 | 使用限额：
                      <span className="font-semibold text-purple-600">无</span>
                      （已生成 {remainingQuota.total} 张）
                    </>
                  ) : remainingQuota.selfConfigured ? (
                    <>
                      使用限额：
                      <span className="font-semibold text-green-600">无</span>
                      （已生成 {remainingQuota.total} 张，使用自己的 API Key）
                    </>
                  ) : remainingQuota.unlimited ? (
                    <>
                      使用限额：
                      <span className="font-semibold text-green-600">无</span>
                      （已生成 {remainingQuota.total} 张）
                    </>
                  ) : (
                    <>
                      使用限额：
                      <span className="font-semibold">{remainingQuota.remaining} / {remainingQuota.limit}</span>
                      张（已生成 {remainingQuota.total} 张）
                    </>
                  )}
                </div>
              )}
              {!hasApiKeyConfigured && (
                <div className="mt-4 p-3 rounded-lg bg-orange-50 text-orange-700 text-sm">
                  当前账户尚未配置 API Key，生成图像功能不可用。
                  {currentUser?.showApiConfig
                    ? "请先在上方配置后保存。"
                    : "请联系管理员为你配置后再使用。"}
                </div>
              )}
            </div>

            {/* 模式选择 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">选择模式</h2>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setMode("generate");
                    clearAllImages();
                  }}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                    mode === "generate"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Image className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-xs sm:text-sm font-medium whitespace-nowrap">文本生图</div>
                </button>
                <button
                  onClick={() => {
                    setMode("edit");
                    clearAllImages();
                  }}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                    mode === "edit"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Edit3 className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-xs sm:text-sm font-medium whitespace-nowrap">图像编辑</div>
                </button>
                <button
                  onClick={() => {
                    console.log('切换到图像合成模式');
                    setMode("compose");
                  }}
                  className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                    mode === "compose"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Layers className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-xs sm:text-sm font-medium whitespace-nowrap">图像合成</div>
                </button>
              </div>
            </div>

            {/* 图像上传和预览 */}
            {(mode === "edit" || mode === "compose") && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">
                    {mode === "edit" ? "图像编辑" : "图像合成"}
                  </h2>
                  {uploadedImages.length > 0 && (
                    <button
                      onClick={clearAllImages}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      清空所有
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple={mode === "compose"}
                  className="hidden"
                />

                <div
                  ref={uploadAreaRef}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`w-full p-4 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                    dragActive
                      ? "border-purple-500 bg-purple-50"
                      : "border-gray-300 hover:border-purple-400"
                  }`}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600">
                    {mode === "edit"
                      ? "上传要编辑的图像"
                      : "上传多张图像进行合成"}
                  </p>
                  {mode === "compose" && (
                    <p className="text-sm text-gray-500 mt-1">
                      支持选择多张图片
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    支持拖拽文件、粘贴剪贴板图片 (Ctrl+V)
                  </p>
                </div>

                {/* 图片预览网格 */}
                {uploadedImages.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-3">
                      已上传 {uploadedImages.length} 张图片：
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {uploadedImages.map((img, index) => (
                        <div
                          key={index}
                          className="relative border border-gray-200 rounded-lg overflow-hidden"
                        >
                          <img
                            src={imageUrls[index]}
                            alt={`图片${index + 1}`}
                            className="w-full h-32 object-cover"
                          />
                          <div className="absolute top-2 left-2 bg-purple-600 text-white px-2 py-1 rounded text-xs font-bold">
                            图片{index + 1}
                          </div>
                          <button
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-2 text-xs">
                            {img.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 提示词输入 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-lg font-semibold mb-4">提示词</h2>
              <textarea
                placeholder={getPromptExample()}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-4 border border-gray-300 rounded-lg h-32 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              
              {/* AI提示词建议 */}
              {suggestedPrompt && (
                <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      AI优化建议
                    </h3>
                    <button
                      onClick={useSuggestedPrompt}
                      className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 flex items-center gap-1"
                    >
                      <span>✨</span>
                      使用建议
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {suggestedPrompt}
                  </p>
                </div>
              )}
              
              {!hasApiKeyConfigured && (
                <p className="mt-3 text-sm text-orange-600">
                  尚未配置 API Key，生成按钮已禁用。
                </p>
              )}
              {uploadedImages.length > 0 && (
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700 font-medium">
                    💡 提示词技巧：
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    可以用"图片1"、"图片2"等方式引用特定图片，例如："将图片1中的人物特征应用到图片2的场景中"
                  </p>
                </div>
              )}
            </div>

            {/* 操作按钮区域 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 提示词助写按钮 */}
              <button
                onClick={optimizePrompt}
                disabled={
                  loadingSuggestion ||
                  loading ||
                  !isApiKeyAvailable ||
                  !prompt
                }
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loadingSuggestion ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>优化中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>提示词助写</span>
                  </>
                )}
              </button>
              
              {/* 生成图像按钮 */}
              <button
                onClick={executeAction}
                disabled={
                  loading ||
                  !isApiKeyAvailable ||
                  !prompt ||
                  ((mode === "edit" || mode === "compose") &&
                    uploadedImages.length === 0)
                }
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>处理中...</span>
                    </div>
                    {loadingElapsedTime > 0 && (
                      <span className="text-xs opacity-80">
                        已等待 {loadingElapsedTime} 秒
                        {loadingElapsedTime > 30 && " (请耐心等待)"}
                        {loadingElapsedTime > 60 && " (Google 服务器响应较慢)"}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    {mode === "generate"
                      ? "生成图像"
                      : mode === "edit"
                        ? "编辑图像"
                        : "合成图像"}
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* 右侧结果显示 */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">生成结果</h2>
              {generatedImage && (
                <button
                  onClick={() => downloadImage(generatedImage)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  下载
                </button>
              )}
            </div>

            <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
              {generatedImage ? (
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="w-full h-full object-contain cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setFullscreenImage(generatedImage)}
                  title="点击查看全屏"
                />
              ) : (
                <div className="text-center text-gray-500">
                  <Image className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>生成的图像将显示在这里</p>
                </div>
              )}
            </div>
            {generatedImage && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={addGeneratedToUpload}
                  className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm flex items-center gap-2"
                  title="将该图像加入参考区以继续编辑/合成"
                >
                  <Plus className="w-4 h-4" /> 加入参考区
                </button>
              </div>
        )}
      </div>

      {/* 历史记录 - 全宽显示 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                📸 本次会话记录
                <span className="text-sm text-gray-500">
                  共 {nonDeletedHistory.length} 张
                </span>
                {pendingSync.length > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full animate-pulse">
                    ⚠️ {pendingSync.length} 条待同步
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                {/* 分页大小选择 */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">每页</span>
                  <select
                    value={historyPageSize}
                    onChange={(e) => { setHistoryPageSize(Number(e.target.value)); setHistoryCurrentPage(1); }}
                    className="border rounded px-2 py-1 text-gray-700"
                  >
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={36}>36</option>
                    <option value={48}>48</option>
                  </select>
                </div>
                {/* 分页导航 */}
                <div className="flex items-center gap-1 text-sm">
                  <button
                    onClick={() => setHistoryCurrentPage(1)}
                    className="px-2 py-1 border rounded hover:bg-gray-100"
                    title="第一页"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setHistoryCurrentPage(p => Math.max(1, p - 1))}
                    className="px-2 py-1 border rounded hover:bg-gray-100"
                    title="上一页"
                  >
                    ‹
                  </button>
                  <span className="px-2 text-gray-600">
                    第 {historyCurrentPage}
                  </span>
                  <button
                    onClick={() => setHistoryCurrentPage(p => Math.min(totalHistoryPages, p + 1))}
                    className="px-2 py-1 border rounded hover:bg-gray-100"
                    title="下一页"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setHistoryCurrentPage(totalHistoryPages)}
                    className="px-2 py-1 border rounded hover:bg-gray-100"
                    title="最后一页"
                  >
                    »
                  </button>
                </div>
                {pendingSync.length > 0 && (
                  <button
                    onClick={syncPendingToServer}
                    className="px-3 py-1 text-sm text-white bg-orange-600 hover:bg-orange-700 rounded transition-colors flex items-center gap-1"
                    title="将本地缓存的记录同步到服务器"
                  >
                    🔄 同步到服务器
                  </button>
                )}
                <button
                  onClick={importHistoryFromFile}
                  className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                  title="从文件导入历史记录"
                >
                  📁 导入
                </button>
                {imageHistory.length > 0 && (
                  <>
                    <button
                      onClick={exportHistoryToFile}
                      className="px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                      title="导出历史记录到文件"
                    >
                      💾 导出
                    </button>
                    <button
                      onClick={clearAllHistory}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                      title="清空当前会话历史记录"
                    >
                      🗑️ 清空
                    </button>
                  </>
                )}
              </div>
            </div>
            {imageHistory.length > 0 ? (
              <>
                <p className="text-xs text-blue-600 mb-4 bg-blue-50 p-2 rounded">
                  💡
                  历史记录自动保存到服务器，登录后会自动加载。也可以手动导入/导出进行备份
                </p>
                {(() => {
                  const start = (historyCurrentPage - 1) * historyPageSize;
                  const end = start + historyPageSize;
                  const pageItems = nonDeletedHistory.slice(start, end);
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {pageItems.map((record) => {
                      // 仅保留 下载 + 删除；查看大图改为点击图片触发
                    const actions = [
                      {
                        key: "download",
                        icon: Download,
                        title: "下载图片",
                        variant: "default",
                        onPress: () => downloadImage(record.imageUrl, record.fileName),
                      },
                      ...(mode === 'edit' || mode === 'compose' ? [{
                        key: 'use',
                        icon: Plus,
                        title: '加入参考区',
                        variant: 'default',
                        onPress: () => addHistoryRecordToUpload(record)
                      }] : []),
                      {
                        key: "delete",
                        icon: X,
                        title: "删除图片",
                        variant: "danger",
                        onPress: () => deleteHistoryImage(record.id),
                        stopPropagation: true,
                      },
                    ];

                    // 使用流式布局，按钮自动换行
                    const overlayLayoutClass = "flex flex-wrap items-center justify-center gap-3";
                    const mobileLayoutClass = "flex md:hidden flex-wrap items-center justify-center gap-2";

                    const preparedActions = [
                      {
                        key: "share",
                        icon: Share2,
                        title: "分享给好友",
                        variant: "default",
                        onPress: () => openShareModal(record),
                        stopPropagation: true,
                      },
                      ...actions,
                    ];

                    const renderActionButton = (action, layout) => {

                      const baseClass = "w-10 h-10 flex items-center justify-center rounded-full transition-all";
                      const variantClass =
                        action.variant === "danger"
                          ? layout === "overlay"
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-red-500 text-white shadow"
                          : layout === "overlay"
                            ? "bg-white bg-opacity-90 text-gray-700 hover:bg-opacity-100"
                            : "bg-white text-gray-700 shadow";

                      return (
                        <button
                          key={`${action.key}-${layout}`}
                          onClick={(event) => {
                            if (layout === "overlay" || action.stopPropagation) {
                              event.stopPropagation();
                            }
                            action.onPress();
                          }}
                          className={`${baseClass} ${variantClass}`}
                          title={action.title}
                        >
                          <action.icon className="w-4 h-4" />
                        </button>
                      );
                    };

                    return (
                      <div key={record.id} className="group">
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                          <img
                            src={record.imageUrl}
                            alt={`Generated ${record.mode}`}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setFullscreenImage(record.imageUrl)}
                            title="点击放大查看"
                          />
                          <div className="absolute inset-0 rounded-lg hidden md:flex items-end justify-center pb-6 px-4 transition-opacity md:bg-black md:bg-opacity-0 md:group-hover:bg-opacity-40"
                               onClick={() => setFullscreenImage(record.imageUrl)}>
                            <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${overlayLayoutClass}`}>
                              {preparedActions.map((action) => renderActionButton(action, "overlay"))}
                            </div>
                            <div className="absolute top-2 left-2 text-white text-xs md:opacity-0 md:group-hover:opacity-100 bg-black bg-opacity-40 px-2 py-1 rounded">
                              点击图片放大查看
                            </div>
                          </div>
                        </div>
                        <div className={`mt-2 ${mobileLayoutClass}`}>
                          {preparedActions.map((action) => renderActionButton(action, "mobile"))}
                        </div>
                        <div className="mt-2 text-xs text-gray-600">
                          <div className="font-medium text-blue-600 text-center">
                            #{imageHistory.length - imageHistory.indexOf(record)}
                          </div>
                          <div className="text-gray-500 text-center mb-1">
                            {new Date(record.createdAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          {record.duration && (
                            <div className={`text-center text-xs mb-1 ${
                              record.duration > 60 
                                ? 'text-red-600 font-semibold' 
                                : record.duration > 30 
                                  ? 'text-orange-600 font-medium' 
                                  : 'text-green-600'
                            }`}>
                              ⏱️ 耗时: {record.duration}秒
                              {record.duration > 60 && ' ⚠️'}
                            </div>
                          )}
                          {record.prompt && (
                            <div className="mt-2 bg-gray-50 rounded p-2 border border-gray-200">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <span className="font-medium text-gray-700 flex-shrink-0">提示词:</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => copyText(record.prompt)}
                                    className="flex-shrink-0 text-gray-700 hover:text-gray-900 text-xs px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                                    title="复制提示词到剪贴板"
                                  >
                                    复制
                                  </button>
                                  <button
                                    onClick={() => {
                                      setPrompt(record.prompt);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="flex-shrink-0 text-blue-600 hover:text-blue-800 text-xs px-2 py-0.5 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                    title="点击复用此提示词"
                                  >
                                    复用
                                  </button>
                                </div>
                              </div>
                              <p className="text-gray-600 line-clamp-2 text-left">
                                {record.prompt}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                    </div>
                  );
                })()}
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <span>第 {historyCurrentPage} / {totalHistoryPages} 页</span>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <Image className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>还没有生成任何图片</p>
                <p className="text-sm mt-2">
                  生成图片后会自动保存到服务器，历史记录会持久保存
                </p>
              </div>
            )}
      </div>

      {/* 与我共享 - 全宽显示 */}
      <div className="bg-white rounded-lg shadow-lg p-6 mt-6 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">与我共享</h3>
          <button
            onClick={loadIncomingShares}
            className="px-3 py-1 text-sm text-gray-700 border rounded hover:bg-gray-50"
          >刷新</button>
        </div>
        {incomingShares.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {incomingShares.map(item => (
              <div key={`${item.owner.id}-${item.id}`} className="group">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden relative">
                  <img
                    src={item.imageUrl}
                    alt={item.fileName}
                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                    onClick={() => setFullscreenImage(item.imageUrl)}
                    title={`来自 ${item.owner.username} - 点击放大`}
                  />
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  <div className="text-center text-gray-500 mb-1">来自：{item.owner.username}</div>
                  {item.prompt && (
                    <div className="bg-gray-50 rounded p-2 border border-gray-200">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-gray-700 flex-shrink-0">提示词:</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyText(item.prompt)}
                            className="text-gray-700 hover:text-gray-900 text-xs px-2 py-0.5 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                            title="复制提示词到剪贴板"
                          >复制</button>
                          <button
                            onClick={() => {
                              setPrompt(item.prompt);
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="text-blue-600 hover:text-blue-800 text-xs px-2 py-0.5 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                            title="复用此提示词"
                          >复用</button>
                        </div>
                      </div>
                      <p className="text-gray-600 line-clamp-2 text-left">{item.prompt}</p>
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => addHistoryRecordToUpload(item)}
                      className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                      title="加入参考区"
                    >加入参考区</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm">暂无共享内容</div>
        )}
      </div>
        </div>

        {/* 使用说明 */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4 text-blue-800">
            ✨ 功能说明
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <strong>📸 多种上传方式：</strong>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• 点击按钮选择文件</li>
                <li>• 直接拖拽图片到参考区</li>
                <li>• 复制图片后按 Ctrl+V 粘贴</li>
                <li>• 在历史记录中点击 ➕ 按钮快速添加参考</li>
              </ul>
            </div>
            <div>
              <strong>🏷️ 图片标号引用：</strong>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• 上传后自动标号（图片1、图片2...）</li>
                <li>• 提示词中可精确引用特定图片</li>
                <li>• 例如："用图片1中的人物，图片2的背景"</li>
              </ul>
            </div>
            <div>
              <strong>🎨 使用技巧：</strong>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• 避免直接提及"保留容貌"等敏感词</li>
                <li>• 用"风格参考"、"艺术创作"等表达</li>
                <li>• 描述要创作的内容而非编辑要求</li>
              </ul>
            </div>
            <div>
              <strong>💾 自动保存：</strong>
              <ul className="mt-2 space-y-1 text-xs">
                <li>• 生成的图片会自动保存到本地</li>
                <li>• 文件名格式：YYYYMMDD_HHMMSS_计数</li>
                <li>• 统计数据自动更新</li>
              </ul>
            </div>
          </div>
        </div>

          </>
        )}

        {/* 错误模态框 */}
        {errorModal.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
              <div className="bg-red-50 border-b border-red-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-red-800 flex items-center gap-2">
                    <span className="text-red-500">⚠️</span>
                    {errorModal.title}
                  </h3>
                  <button
                    onClick={closeErrorModal}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="text-gray-700 whitespace-pre-line mb-4">
                  {errorModal.message}
                </div>

                {errorModal.details && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
                      显示技术详情
                    </summary>
                    <div className="bg-gray-50 p-3 rounded text-xs text-gray-600 font-mono overflow-auto max-h-40">
                      {errorModal.details}
                    </div>
                  </details>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                {errorModal.showRetry && (
                  <button
                    onClick={retryLastRequest}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    重试
                  </button>
                )}
                <button
                  onClick={closeErrorModal}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 超时提示对话框 */}
        {showTimeoutDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4">
                <h3 className="text-lg font-semibold text-yellow-800 flex items-center gap-2">
                  <span className="text-yellow-500">⏰</span>
                  请求处理时间较长
                </h3>
              </div>

              <div className="p-6">
                <p className="text-gray-700 mb-4">
                  图像生成已经运行了 <span className="font-bold text-blue-600">{Math.floor(loadingElapsedTime / 60)} 分钟 {loadingElapsedTime % 60} 秒</span>，
                  Google API 仍在处理中。
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                  <p className="text-sm text-blue-800">
                    <strong>💡 温馨提示：</strong><br/>
                    • 如果您选择"放弃"，已产生的 API 费用将无法退回<br/>
                    • 建议选择"继续等待"，避免浪费费用<br/>
                    • 复杂的图像生成可能需要更长时间
                  </p>
                </div>

                <p className="text-sm text-gray-600">
                  您希望如何处理？
                </p>
              </div>

              <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
                <button
                  onClick={cancelRequest}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  放弃请求
                </button>
                <button
                  onClick={continueWaiting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  继续等待 5 分钟
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 全屏图片查看器 */}
        {fullscreenImage && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4"
            onClick={isMobile ? undefined : () => setFullscreenImage(null)}
          >
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition-all"
              title={isMobile ? "关闭" : "关闭 (ESC)"}
            >
              <X className="w-6 h-6" />
            </button>
            
            <img
              src={fullscreenImage}
              alt="全屏查看"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => {
                if (isMobile) setFullscreenImage(null);
                else e.stopPropagation();
              }}
            />
            
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded">
              {isMobile ? "点图片关闭" : "点击背景或按 ESC 关闭"}
            </div>
          </div>
        )}

        {/* 分享弹窗 */}
        {shareModal.open && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={closeShareModal}>
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
                <h3 className="text-lg font-semibold text-gray-800">分享给好友</h3>
              </div>
              <div className="p-6 space-y-2 max-h-[60vh] overflow-y-auto">
                {friends.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>暂无好友</p>
                    <p className="text-xs mt-2">添加好友后即可分享图片</p>
                  </div>
                ) : (
                  friends.map(f => {
                    const displayText = f.displayName || f.username || f.id;
                    const usernameText = f.username || '';
                    return (
                      <label 
                        key={f.id} 
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={shareModal.targets.includes(f.id)}
                          onChange={() => toggleShareTarget(f.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">
                            {displayText}
                            {f.isSuperAdmin && <span className="ml-1 text-yellow-600">👑</span>}
                          </div>
                          {usernameText && usernameText !== displayText && (
                            <div className="text-xs text-gray-500">@{usernameText}</div>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-2">
                <button 
                  onClick={closeShareModal} 
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={saveShareTargets} 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {shareModal.targets.length === 0 ? "取消分享" : `保存 (${shareModal.targets.length})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Studio;
