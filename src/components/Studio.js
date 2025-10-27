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
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState(currentUser?.apiKey || "");
  const [prompt, setPrompt] = useState("");
  const [uploadedImages, setUploadedImages] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("generate");
  const [imageHistory, setImageHistory] = useState([]);

  // 从服务器加载用户的历史记录
  const loadImageHistory = useCallback(async () => {
    console.log("🔄 从服务器加载历史记录，currentUser:", currentUser?.id);
    if (!currentUser) {
      console.warn("❌ currentUser为空，无法加载历史记录");
      return;
    }

    try {
      // 从服务器API加载历史记录
      const baseURL =
        process.env.NODE_ENV === "development" ? "http://localhost:8080" : "";
      const response = await fetch(`${baseURL}/api/history/${currentUser.id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
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
      console.log(
        "💾 保存历史记录到服务器，用户:",
        userId,
        "图片数量:",
        historyData.length,
      );

      const baseURL =
        process.env.NODE_ENV === "development" ? "http://localhost:8080" : "";
      const response = await fetch(`${baseURL}/api/history/${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(historyData),
      });

      if (response.ok) {
        console.log("✅ 历史记录已保存到服务器");
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error("❌ 保存历史记录到服务器失败:", error);

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
  });
  const [showApiKey, setShowApiKey] = useState(false);

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
    });
  }, []);

  // 关闭错误模态框
  const closeErrorModal = useCallback(() => {
    setErrorModal({ show: false, title: "", message: "", details: "" });
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

  // 自动保存图片到本地
  // 保存图片到会话历史记录（内存存储）
  const saveImageToHistory = useCallback(
    async (imageUrl, prompt, mode) => {
      try {
        // 生成文件名（即使没有currentUser也能生成）
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

        // 创建图片记录（包含图片数据用于当前会话显示）
        const imageRecord = {
          id: Date.now().toString(),
          imageUrl, // 保留图片数据用于当前会话显示
          fileName: fullFileName,
          prompt,
          mode,
          createdAt: new Date().toISOString(),
          userId: currentUser?.id || "anonymous",
        };

        // 添加到当前会话历史记录（内存存储）
        setImageHistory((prev) => {
          const updatedHistory = [imageRecord, ...prev].slice(0, 20);

          // 同时保存到服务器（如果用户已登录）
          if (currentUser) {
            saveHistoryToServer(updatedHistory, currentUser.id);
          }

          return updatedHistory;
        });
      } catch (error) {
        console.error("保存图片到历史记录失败:", error);
        showError("保存失败", "保存图片到历史记录时出现错误");
      }
    },
    [currentUser, showError, saveHistoryToServer],
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

  // 删除单条会话历史记录
  const deleteHistoryImage = useCallback(
    (imageId) => {
      setImageHistory((prev) => {
        const updatedHistory = prev.filter((record) => record.id !== imageId);

        // 同时更新服务器
        if (currentUser) {
          saveHistoryToServer(updatedHistory, currentUser.id);
        }

        return updatedHistory;
      });
      console.log("已删除历史记录:", imageId);
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

  // 更新用户统计（暂时移除，后续可以添加后端API）
  const updateStats = useCallback(() => {
    // TODO: 调用后端API更新用户统计
    console.log("图像生成完成，统计已更新");
  }, []);

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
  const callAPI = async (requestBody) => {
    try {
      console.log("发送API请求:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent",
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
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
      showError("参数缺失", "请输入API密钥");
      return;
    }

    if (!prompt) {
      showError("参数缺失", "请输入提示词");
      return;
    }

    setLoading(true);
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

      const imageUrl = await callAPI(requestBody);
      setGeneratedImage(imageUrl);

      // 保存到历史记录
      await saveImageToHistory(imageUrl, prompt, "generate");

      // 更新统计
      updateStats();
    } catch (error) {
      if (error.cause) {
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

      const imageUrl = await callAPI(requestBody);
      setGeneratedImage(imageUrl);

      // 保存到历史记录
      await saveImageToHistory(imageUrl, prompt, mode);

      // 更新统计
      updateStats();
    } catch (error) {
      if (error.cause) {
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
          process.env.NODE_ENV === "development"
            ? "http://localhost:8080"
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                🎨 BOB Studio
              </h1>
              <span className="text-gray-600">工作室</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                to="/stats"
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <BarChart3 className="w-4 h-4" />
                统计
              </Link>
              {currentUser.isSuperAdmin && (
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
                欢迎，{currentUser.username}
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
                  <div className="text-2xl font-bold text-purple-600">0</div>
                  <div className="text-sm text-gray-500">今日</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-blue-600">0</div>
                  <div className="text-sm text-gray-500">本月</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">0</div>
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
                  className={`p-4 rounded-lg border-2 transition-all ${
                    mode === "generate"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Image className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">文本生图</div>
                </button>
                <button
                  onClick={() => {
                    setMode("edit");
                    clearAllImages();
                  }}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    mode === "edit"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Edit3 className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">图像编辑</div>
                </button>
                <button
                  onClick={() => setMode("compose")}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    mode === "compose"
                      ? "border-purple-500 bg-purple-50 text-purple-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Layers className="w-6 h-6 mx-auto mb-2" />
                  <div className="text-sm font-medium">图像合成</div>
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
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  处理中...
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
                  className="w-full h-full object-contain"
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
                  ({imageHistory.length}/20)
                </span>
              </h3>
              <div className="flex gap-2">
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
                  {imageHistory.map((record) => {
                    const actions = [
                      {
                        key: "view",
                        icon: Eye,
                        title: "查看大图",
                        variant: "default",
                        onPress: () => setGeneratedImage(record.imageUrl),
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
                      <div key={record.id} className="relative group">
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={record.imageUrl}
                            alt={`Generated ${record.mode}`}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setGeneratedImage(record.imageUrl)}
                          />
                        </div>
                        <div className="absolute inset-0 rounded-lg hidden md:flex items-end justify-center pb-6 px-4 transition-opacity md:bg-black md:bg-opacity-0 md:group-hover:bg-opacity-40">
                          <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${overlayLayoutClass}`}>
                            {preparedActions.map((action) => renderActionButton(action, "overlay"))}
                          </div>
                        </div>
                        <div className={`mt-2 ${mobileLayoutClass}`}>
                          {preparedActions.map((action) => renderActionButton(action, "mobile"))}
                        </div>
                        <div className="mt-2 text-xs text-gray-600 text-center">
                          <div className="font-medium text-blue-600">
                            #{imageHistory.length - imageHistory.indexOf(record)}
                          </div>
                          <div className="text-gray-500">
                            {new Date(record.createdAt).toLocaleString("zh-CN", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
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

              <div className="bg-gray-50 px-6 py-4 flex justify-end">
                <button
                  onClick={closeErrorModal}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  关闭
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
