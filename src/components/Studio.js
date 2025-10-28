import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  Upload,
  Image,
  Edit3,
  Layers,
  Download,
  Settings,
  Sparkles,
  Plus,
  X,
  Home,
  LogOut,
  BarChart3,
  Eye,
  EyeOff,
  Shield,
} from "lucide-react";

const Studio = () => {
  const { currentUser, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  // API 请求超时设置（毫秒）
  const API_TIMEOUT = 300000; // 5分钟
  
  const [apiKey, setApiKey] = useState(currentUser?.apiKey || "");
  const [prompt, setPrompt] = useState("");
  const [uploadedImages, setUploadedImages] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("generate");
  const [imageHistory, setImageHistory] = useState([]);
  
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
  const [showTimeoutDialog, setShowTimeoutDialog] = useState(false); // 超时对话框
  
  // 本地缓存和服务器状态
  const [pendingSync, setPendingSync] = useState([]); // 待同步的历史记录
  const [serverAvailable, setServerAvailable] = useState(true); // 服务器是否可用

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
      const baseURL = import.meta.env.DEV
        ? (import.meta.env.VITE_API_URL || "http://localhost:8080")
        : "";
      const response = await fetch(`${baseURL}/api/history/${currentUser.id}`, {
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

      const baseURL = import.meta.env.DEV
        ? (import.meta.env.VITE_API_URL || "http://localhost:8080")
        : "";
      const url = `${baseURL}/api/history/${userId}`;
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
            "🎉 您已完成 30 张图片的免费体验！\n\n" +
            "管理员分配的体验 API Key 已自动清空。\n" +
            "请在右上角个人信息中配置您自己的 Google Gemini API Key 继续使用。\n\n" +
            "如何获取 API Key：\n" +
            "1. 访问 https://aistudio.google.com/apikey\n" +
            "2. 创建并复制您的 API Key\n" +
            "3. 在个人信息中填入 API Key 即可继续创作"
          );
          // 刷新用户信息
          if (currentUser && refreshUserInfo) {
            refreshUserInfo(currentUser.id);
          }
        } else if (result.reachedLimit && result.recordCount >= 30) {
          console.log("⚠️ 用户已达到30张限制");
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
  }, []);

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
      setApiKey(currentUser.apiKey || "");

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
      if (event.key === 'Escape' && fullscreenImage) {
        setFullscreenImage(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [fullscreenImage]);

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
      
      const baseURL = import.meta.env.DEV
        ? (import.meta.env.VITE_API_URL || "http://localhost:8080")
        : "";
      
      const response = await fetch(`${baseURL}/api/images/upload`, {
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

      console.log(`🌐 发送请求到: ${baseURL}/api/images/upload`);
      
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
          const updatedHistory = [imageRecord, ...prev].slice(0, 20);

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
      ).slice(0, 20);

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
    if (window.confirm("确定要清空当前会话的所有历史记录吗？")) {
      setImageHistory([]);

      // 同时清空服务器记录
      if (currentUser) {
        saveHistoryToServer([], currentUser.id);
      }

      console.log("已清空所有历史记录");
    }
  }, [currentUser, saveHistoryToServer]);

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
      const baseURL = import.meta.env.DEV
        ? (import.meta.env.VITE_API_URL || "http://localhost:8080")
        : "";
      
      const response = await fetchWithTimeout(
        `${baseURL}/api/gemini/generate`,
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
          throw new Error("API密钥权限不足或配额已用完");
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
    if (!currentUser?.showApiConfig && !apiKey) {
      showError("权限受限", "请联系管理员为该账号配置 API Key");
      return;
    }

    if (!apiKey) {
      showError(
        "需要配置 API Key", 
        "请在右上角个人信息中配置您的 Google Gemini API Key。\n\n" +
        "获取方法：访问 https://aistudio.google.com/apikey 创建免费 API Key"
      );
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

      const imageUrl = await callAPI(requestBody);
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
    if (!currentUser?.showApiConfig && !apiKey) {
      showError("权限受限", "请联系管理员为该账号配置 API Key");
      return;
    }

    if (!apiKey) {
      showError("参数缺失", "请输入API密钥");
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
        const base64Image = await imageToBase64(uploadedImages[i]);
        parts.push({
          inlineData: {
            mimeType: uploadedImages[i].type,
            data: base64Image,
          },
        });
      }

      const requestBody = {
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      };

      // 保存请求体以便重试
      setLastRequestBody({ type: mode, body: requestBody, prompt, uploadedImages });

      const imageUrl = await callAPI(requestBody);
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

      showError("保存成功", "API 密钥已更新", "");
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

  const hasApiKeyConfigured = Boolean(currentUser?.hasApiKey || apiKey);

  if (!currentUser) {
    return null; // 避免在重定向前显示内容
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 to-blue-100">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                🎨 BOB Studio
              </h1>
              <span className="text-sm sm:text-base text-gray-600">工作室</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
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
                to="/"
                className="flex items-center gap-1 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors text-sm sm:text-base"
                title="首页"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">首页</span>
              </Link>
              <span className="text-xs sm:text-sm text-gray-600 truncate max-w-[100px] sm:max-w-none">
                {currentUser.username}
                {currentUser.isSuperAdmin && (
                  <span className="ml-1 text-yellow-600">👑</span>
                )}
              </span>
              <button
                onClick={() => {
                  console.log("工作室退出按钮被点击");
                  logout(); // logout函数现在自己处理跳转
                }}
                className="flex items-center gap-2 text-red-600 hover:text-red-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                退出
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
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
                      className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                  onClick={() => setMode("compose")}
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

            {/* 生成按钮 */}
            <button
              onClick={executeAction}
              disabled={
                loading ||
                !apiKey ||
                !prompt ||
                ((mode === "edit" || mode === "compose") &&
                  uploadedImages.length === 0)
              }
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          </div>

          {/* 历史记录 */}
          <div className="bg-white rounded-lg shadow-lg p-6 mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                📸 本次会话记录
                <span className="text-sm text-gray-500">
                  ({imageHistory.filter(r => !r.deleted).length}/20)
                </span>
                {pendingSync.length > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full animate-pulse">
                    ⚠️ {pendingSync.length} 条待同步
                  </span>
                )}
              </h3>
              <div className="flex gap-2">
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                  {imageHistory.filter(record => !record.deleted).map((record) => {
                    const actions = [
                      {
                        key: "view",
                        icon: Eye,
                        title: "查看大图",
                        variant: "default",
                        onPress: () => setFullscreenImage(record.imageUrl),
                      },
                      ...(mode !== "generate"
                        ? [
                            {
                              key: "add",
                              icon: Plus,
                              title: "添加到参考图片",
                              variant: "default",
                              onPress: () => addHistoryImageToUploads(record),
                              stopPropagation: true,
                            },
                          ]
                        : []),
                      {
                        key: "download",
                        icon: Download,
                        title: "下载图片",
                        variant: "default",
                        onPress: () => downloadImage(record.imageUrl, record.fileName),
                      },
                      {
                        key: "delete",
                        icon: X,
                        title: "删除图片",
                        variant: "danger",
                        onPress: () => deleteHistoryImage(record.id),
                        stopPropagation: true,
                      },
                    ];

                    const shouldUseGrid = actions.length >= 3;
                    const overlayLayoutClass = shouldUseGrid
                      ? "grid grid-cols-2 gap-3 justify-items-center"
                      : "flex items-center gap-3";
                    const mobileLayoutClass = shouldUseGrid
                      ? "grid grid-cols-2 gap-2 md:hidden justify-items-center"
                      : "flex md:hidden items-center justify-center gap-2";

                    const preparedActions = [...actions];
                    const needsPlaceholder = shouldUseGrid && preparedActions.length % 2 !== 0;
                    if (needsPlaceholder) {
                      preparedActions.push({ key: "placeholder", placeholder: true });
                    }

                    const renderActionButton = (action, layout) => {
                      if (action.placeholder) {
                        return (
                          <div
                            key={`${action.key}-${layout}`}
                            className="w-10 h-10"
                            aria-hidden="true"
                          ></div>
                        );
                      }

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
                          />
                          <div className="absolute inset-0 rounded-lg hidden md:flex items-end justify-center pb-6 px-4 transition-opacity md:bg-black md:bg-opacity-0 md:group-hover:bg-opacity-40">
                            <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${overlayLayoutClass}`}>
                              {preparedActions.map((action) => renderActionButton(action, "overlay"))}
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
                                <button
                                  onClick={() => {
                                    setPrompt(record.prompt);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="flex-shrink-0 text-blue-600 hover:text-blue-800 text-xs px-2 py-0.5 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                  title="点击复用此提示词"
                                >
                                  📋 复用
                                </button>
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
                <li>• 直接拖拽图片到上传区域</li>
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
            onClick={() => setFullscreenImage(null)}
          >
            <button
              onClick={() => setFullscreenImage(null)}
              className="absolute top-4 right-4 z-10 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-full p-3 transition-all"
              title="关闭 (ESC)"
            >
              <X className="w-6 h-6" />
            </button>
            
            <img
              src={fullscreenImage}
              alt="全屏查看"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-50 px-4 py-2 rounded">
              点击背景或按 ESC 关闭
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Studio;
