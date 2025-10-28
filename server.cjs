const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const crypto = require("crypto");

const API_KEY_SECRET =
  process.env.API_KEY_ENCRYPTION_SECRET || "change-me-bobstudio-secret";
const API_KEY_KEY = crypto.createHash("sha256").update(API_KEY_SECRET).digest();
const API_KEY_IV_LENGTH = 12;

// 目录定义
const HISTORY_DIR = path.join(__dirname, "history");
const IMAGES_DIR = path.join(__dirname, "images");
const SESSIONS_DIR = path.join(__dirname, "sessions");

let users = [];

const saveUsers = () => {
  require("fs").writeFileSync(
    path.join(__dirname, "users.json"),
    JSON.stringify(users, null, 2),
  );
};

// 更新用户统计数据
const updateUserStats = async (userId, historyData) => {
  try {
    const user = users.find(u => u.id === userId);
    if (!user) {
      console.log(`⚠️ 用户 ${userId} 不存在，跳过统计更新`);
      return;
    }

    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

    // 计算统计
    let todayCount = 0;
    let thisMonthCount = 0;
    const totalCount = historyData.length;

    historyData.forEach(item => {
      if (item.createdAt) {
        const itemDate = new Date(item.createdAt);
        const itemDay = itemDate.toISOString().split('T')[0];
        const itemMonth = `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}`;

        if (itemDay === today) {
          todayCount++;
        }
        if (itemMonth === thisMonth) {
          thisMonthCount++;
        }
      }
    });

    // 更新用户统计
    user.generationStats = {
      today: todayCount,
      thisMonth: thisMonthCount,
      total: totalCount
    };

    // 保存用户数据
    saveUsers();
    console.log(`✅ 统计已更新 - 今日: ${todayCount}, 本月: ${thisMonthCount}, 总计: ${totalCount}`);
  } catch (error) {
    console.error(`❌ 更新用户统计失败:`, error);
  }
};

// 加密工具函数会在 users 初始化之后使用
const encryptSensitiveValue = (plainText = "") => {
  if (!plainText) return "";
  try {
    const iv = crypto.randomBytes(API_KEY_IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-gcm", API_KEY_KEY, iv);
    const encrypted = Buffer.concat([
      cipher.update(String(plainText), "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
  } catch (error) {
    console.error("加密敏感数据失败:", error);
    return "";
  }
};

const decryptSensitiveValue = (payload = "") => {
  if (!payload) return "";
  try {
    const [ivPart, tagPart, dataPart] = String(payload).split(":");
    if (!ivPart || !tagPart || !dataPart) return "";
    const iv = Buffer.from(ivPart, "base64");
    const authTag = Buffer.from(tagPart, "base64");
    const encrypted = Buffer.from(dataPart, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", API_KEY_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("解密敏感数据失败:", error);
    return "";
  }
};

const app = express();
const PORT = process.env.PORT || 8080;

// 服务器实例标识与启动时间（用于客户端检测重启并失效会话）
const SERVER_INSTANCE_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SERVER_STARTED_AT = new Date().toISOString();

// Session配置（使用文件存储实现持久化）
app.use(
  session({
    store: new FileStore({
      path: SESSIONS_DIR,
      ttl: 24 * 60 * 60, // 24小时（秒）
      retries: 0,
      reapInterval: 3600, // 每小时清理过期session
    }),
    secret: process.env.SESSION_SECRET || "bob-studio-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production" && process.env.USE_HTTPS === "true", // 生产环境且使用HTTPS时设为true
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24小时
    },
  }),
);

// 中间件
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "development" ? "http://localhost:3005" : true,
    credentials: true, // 允许发送cookies
  }),
);
// 大幅增加请求体限制，支持超大图片
app.use(express.json({ limit: "2gb" }));
app.use(express.urlencoded({ limit: "2gb", extended: true, parameterLimit: 500000 }));

// 服务静态文件
app.use(express.static("build")); // 服务React构建文件

// 服务图片文件
app.use("/images", express.static(IMAGES_DIR));

// 上传图片API
app.post("/api/images/upload", async (req, res) => {
  console.log("📸 收到图片上传请求");
  
  try {
    const { imageData, fileName, userId } = req.body;
    
    if (!imageData || !userId) {
      console.error("❌ 缺少必要参数");
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    console.log(`用户: ${userId}, 文件名: ${fileName || '未指定'}`);
    const sizeInMB = (imageData.length / 1024 / 1024).toFixed(2);
    console.log(`图片数据大小: ${sizeInMB} MB (${imageData.length} 字节)`);
    
    // 警告：如果图片超过 50MB
    if (imageData.length > 50 * 1024 * 1024) {
      console.warn(`⚠️  警告：图片非常大 (${sizeInMB} MB)，建议压缩`);
    }
    
    // 保存图片并获取URL
    const imageUrl = await saveBase64Image(imageData, userId, fileName);
    
    console.log(`✅ 图片上传成功: ${imageUrl}`);
    res.json({ 
      success: true, 
      imageUrl: imageUrl 
    });
  } catch (error) {
    console.error("❌ 图片上传失败:", error);
    res.status(500).json({ error: "Failed to upload image", details: error.message });
  }
});

// 用户数据存储（实际项目中应该是数据库）
try {
  const usersData = require("fs").readFileSync(
    path.join(__dirname, "users.json"),
    "utf8",
  );
  users = JSON.parse(usersData);
  if (Array.isArray(users)) {
    let migrated = false;
    users = users.map((user) => {
      if (user && user.apiKey && !user.apiKeyEncrypted) {
        user.apiKeyEncrypted = encryptSensitiveValue(user.apiKey);
        delete user.apiKey;
        migrated = true;
      }
      return user;
    });
    if (migrated) {
      saveUsers();
    }
  }
} catch (error) {
  users = [];
}

// 返回到客户端时隐藏敏感字段
const defaultGenerationStats = {
  today: 0,
  thisMonth: 0,
  total: 0,
};

const toSafeUser = (user) => {
  if (!user) return null;

  const {
    password,
    resetToken,
    resetTokenExpiresAt,
    // Legacy字段，保持兼容
    apiKey,
    apiKeyEncrypted,
    apiKeyNonce,
    ...rest
  } = user;

  const stats =
    rest && typeof rest.generationStats === "object"
      ? {
          today: Number.isFinite(rest.generationStats.today)
            ? rest.generationStats.today
            : 0,
          thisMonth: Number.isFinite(rest.generationStats.thisMonth)
            ? rest.generationStats.thisMonth
            : 0,
          total: Number.isFinite(rest.generationStats.total)
            ? rest.generationStats.total
            : 0,
        }
      : { ...defaultGenerationStats };

  const safe = {
    ...rest,
    generationStats: stats,
    showApiConfig: Boolean(rest?.showApiConfig),
    isActive: Boolean(rest?.isActive),
    isSuperAdmin: Boolean(rest?.isSuperAdmin),
    hasApiKey: Boolean(apiKeyEncrypted || apiKey),
  };

  return safe;
};

// 返回前端会话所需的用户信息
const toSessionUser = (user) => {
  const safe = toSafeUser(user);
  if (!safe) return null;
  const decryptedKey = decryptSensitiveValue(
    user.apiKeyEncrypted || user.apiKey || "",
  );
  return {
    ...safe,
    isSuperAdmin: Boolean(safe.isSuperAdmin),
    isActive: Boolean(safe.isActive),
    apiKey: decryptedKey,
    hasApiKey: safe.hasApiKey,
  };
};

// 哈希密码
const hashPassword = (password) => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

// 初始化超级管理员
const initSuperAdmin = () => {
  const adminConfig = {
    username: "admin",
    email: "sunsx@briconbric.com",
    password: "twgdh169",
  };

  let admin = users.find((u) => u.isSuperAdmin);
  if (!admin) {
    admin = {
      id: "super-admin-001",
      username: adminConfig.username,
      email: adminConfig.email.toLowerCase().trim(),
      password: hashPassword(adminConfig.password),
      isActive: true,
      isSuperAdmin: true,
      createdAt: new Date().toISOString(),
    };
    users.push(admin);
    saveUsers();
    console.log("✅ 超级管理员已初始化");
  }
};

// 启动时初始化
initSuperAdmin();

// 认证中间件
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.user || !req.session.user.isSuperAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

// 认证API
app.post("/api/auth/login", (req, res) => {
  const { identifier, email, password } = req.body || {};

  if (!password || (!identifier && !email)) {
    return res.status(400).json({ error: "账号和密码不能为空" });
  }

  const rawIdentifier = typeof identifier === "string" ? identifier.trim() : "";
  const rawEmail = typeof email === "string" ? email.trim() : "";
  const loginValue = rawIdentifier || rawEmail;

  const isEmail = loginValue.includes("@");
  const normalizedEmail = loginValue.toLowerCase();

  let user;
  if (isEmail) {
    user = users.find((u) => u.email === normalizedEmail);
  } else {
    const normalizedUsername = loginValue.toLowerCase();
    user = users.find(
      (u) => u.username && u.username.toLowerCase() === normalizedUsername,
    );
  }

  if (!user) {
    return res.status(401).json({ error: "用户不存在" });
  }

  if (!user.isActive && !user.isSuperAdmin) {
    return res.status(401).json({ error: "账户尚未激活" });
  }

  if (user.password !== hashPassword(password)) {
    return res.status(401).json({ error: "密码错误" });
  }

  // 创建session
  req.session.user = toSessionUser(user);

  console.log(`✅ 用户 ${user.username} 登录成功`);
  res.json({
    success: true,
    message: "登录成功",
    user: req.session.user,
  });
});

// 刷新当前用户信息（更新统计数据）
app.get("/api/auth/refresh", requireAuth, (req, res) => {
  try {
    const user = users.find((u) => u.id === req.session.user.id);
    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }
    
    // 更新session中的用户信息
    req.session.user = toSessionUser(user);
    
    console.log(`🔄 刷新用户 ${user.username} 的信息`);
    res.json({
      success: true,
      user: req.session.user
    });
  } catch (error) {
    console.error("刷新用户信息失败:", error);
    res.status(500).json({ error: "刷新失败" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  if (req.session.user) {
    console.log(`🚪 用户 ${req.session.user.username} 退出登录`);
  }

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "退出失败" });
    }
    res.clearCookie("connect.sid"); // 清除session cookie
    res.json({ success: true, message: "退出成功" });
  });
});

app.get("/api/auth/me", (req, res) => {
  const sessionUser = req.session.user;
  if (!sessionUser) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const latestUser = users.find((u) => u.id === sessionUser.id);
  if (!latestUser) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: "Not authenticated" });
  }

  const refreshedSessionUser = toSessionUser(latestUser);
  req.session.user = refreshedSessionUser;
  res.json({ user: refreshedSessionUser });
});

// 管理端 API（需要超级管理员）
// 获取用户列表
app.get("/api/admin/users", requireAdmin, (req, res) => {
  try {
    const list = users.map(toSafeUser);
    res.json({ users: list });
  } catch (error) {
    console.error("获取用户列表失败:", error);
    res.status(500).json({ error: "Failed to list users" });
  }
});

// 创建用户
app.post("/api/admin/users", requireAdmin, (req, res) => {
  try {
    const {
      username,
      email,
      password,
      isActive = false,
      isSuperAdmin = false,
      showApiConfig = false,
    } = req.body || {};
    if (!username || !email || !password) {
      return res.status(400).json({ error: "用户名、邮箱、密码均为必填" });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim().toLowerCase();

    if (users.some((u) => u.email === normalizedEmail)) {
      return res.status(409).json({ error: "邮箱已存在" });
    }

    if (
      users.some(
        (u) => u.username && u.username.toLowerCase() === normalizedUsername,
      )
    ) {
      return res.status(409).json({ error: "用户名已存在" });
    }
    const newUser = {
      id: `user_${Date.now()}`,
      username: String(username).trim(),
      email: normalizedEmail,
      password: hashPassword(password),
      apiKeyEncrypted: "",
      isActive: Boolean(isActive),
      isSuperAdmin: Boolean(isSuperAdmin),
      showApiConfig: Boolean(showApiConfig),
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    saveUsers();
    res.status(201).json({ user: toSafeUser(newUser) });
  } catch (error) {
    console.error("创建用户失败:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// 更新用户（不含密码）
app.put("/api/admin/users/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const targetIndex = users.findIndex((u) => u.id === id);
    if (targetIndex === -1) {
      return res.status(404).json({ error: "用户不存在" });
    }
    const target = users[targetIndex];
    const { username, email, isActive, isSuperAdmin, apiKey, showApiConfig } =
      req.body || {};

    if (typeof email !== "undefined") {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (
        normalizedEmail !== target.email &&
        users.some((u) => u.email === normalizedEmail)
      ) {
        return res.status(409).json({ error: "邮箱已存在" });
      }
      target.email = normalizedEmail;
    }
    if (typeof username !== "undefined")
      target.username = String(username).trim();
    if (typeof isActive !== "undefined") target.isActive = Boolean(isActive);
    if (typeof isSuperAdmin !== "undefined")
      target.isSuperAdmin = Boolean(isSuperAdmin);
    if (typeof showApiConfig !== "undefined")
      target.showApiConfig = Boolean(showApiConfig);
    if (typeof apiKey !== "undefined") {
      target.apiKeyEncrypted = encryptSensitiveValue(String(apiKey));
    }

    // 兼容旧字段
    delete target.apiKey;

    users[targetIndex] = target;
    if (req.session.user && req.session.user.id === id) {
      req.session.user = toSessionUser(target);
    }
    saveUsers();
    res.json({ user: toSafeUser(target) });
  } catch (error) {
    console.error("更新用户失败:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// 重置用户密码
app.post("/api/admin/users/:id/reset-password", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body || {};
    if (!newPassword) return res.status(400).json({ error: "新密码不能为空" });
    const target = users.find((u) => u.id === id);
    if (!target) return res.status(404).json({ error: "用户不存在" });
    target.password = hashPassword(newPassword);
    saveUsers();
    res.json({ success: true });
  } catch (error) {
    console.error("重置密码失败:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// 设置/清除用户 API Key
app.post("/api/admin/users/:id/api-key", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { apiKey } = req.body || {};
    const target = users.find((u) => u.id === id);
    if (!target) return res.status(404).json({ error: "用户不存在" });
    target.apiKeyEncrypted =
      typeof apiKey === "string" ? encryptSensitiveValue(apiKey) : "";
    delete target.apiKey;
    if (req.session.user && req.session.user.id === id) {
      req.session.user = toSessionUser(target);
    }
    saveUsers();
    res.json({ success: true, apiKeySet: Boolean(target.apiKeyEncrypted) });
  } catch (error) {
    console.error("设置API Key失败:", error);
    res.status(500).json({ error: "Failed to set API key" });
  }
});

// 读取用户 API Key（仅管理员）
app.get("/api/admin/users/:id/api-key", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const target = users.find((u) => u.id === id);
    if (!target) return res.status(404).json({ error: "用户不存在" });
    const apiKey = decryptSensitiveValue(
      target.apiKeyEncrypted || target.apiKey || "",
    );
    res.json({ apiKey });
  } catch (error) {
    console.error("读取API Key失败:", error);
    res.status(500).json({ error: "Failed to load api key" });
  }
});

// 用户自助配置 API Key
app.post("/api/me/api-key", requireAuth, (req, res) => {
  try {
    const { apiKey } = req.body || {};
    const target = users.find((u) => u.id === req.session.user.id);
    if (!target) return res.status(404).json({ error: "用户不存在" });
    if (!target.showApiConfig && !target.isSuperAdmin) {
      return res.status(403).json({ error: "该用户未开放自助配置" });
    }
    target.apiKeyEncrypted =
      typeof apiKey === "string" ? encryptSensitiveValue(apiKey) : "";
    delete target.apiKey;
    req.session.user = toSessionUser(target);
    saveUsers();
    res.json({ success: true, apiKeySet: Boolean(target.apiKeyEncrypted) });
  } catch (error) {
    console.error("用户设置API Key失败:", error);
    res.status(500).json({ error: "Failed to set api key" });
  }
});

// 删除用户（不允许删除超级管理员）
app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const target = users.find((u) => u.id === id);
    if (!target) return res.status(404).json({ error: "用户不存在" });
    if (target.isSuperAdmin)
      return res.status(400).json({ error: "不允许删除超级管理员" });
    users = users.filter((u) => u.id !== id);
    saveUsers();
    res.json({ success: true });
  } catch (error) {
    console.error("删除用户失败:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

const MODE_META = {
  generate: { key: "generate", label: "文本生图", color: "#8B5CF6" },
  edit: { key: "edit", label: "图像编辑", color: "#3B82F6" },
  compose: { key: "compose", label: "图像合成", color: "#10B981" },
  other: { key: "other", label: "其他操作", color: "#F97316" },
};

const safeParseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const formatDateKey = (date) => date.toISOString().slice(0, 10);
const formatMonthKey = (date) => date.toISOString().slice(0, 7);

async function loadUserHistory(userId) {
  const filePath = path.join(HISTORY_DIR, `history-${userId}.json`);
  try {
    const data = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function computeStatsFromHistory(history) {
  const now = new Date();
  const todayKey = formatDateKey(now);
  const monthKey = formatMonthKey(now);

  const totals = {
    today: 0,
    thisMonth: 0,
    total: 0,
  };

  const dailyMap = new Map();
  const monthlyMap = new Map();
  const modeCounts = {
    generate: 0,
    edit: 0,
    compose: 0,
    other: 0,
  };

  let lastGeneratedAt = null;

  for (const item of history) {
    const createdAt = safeParseDate(item?.createdAt);
    if (!createdAt) continue;

    const dayKey = formatDateKey(createdAt);
    const monthKeyItem = formatMonthKey(createdAt);

    totals.total += 1;
    dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
    monthlyMap.set(monthKeyItem, (monthlyMap.get(monthKeyItem) || 0) + 1);

    if (dayKey === todayKey) {
      totals.today += 1;
    }
    if (monthKeyItem === monthKey) {
      totals.thisMonth += 1;
    }

    const mode = typeof item?.mode === "string" ? item.mode : "other";
    if (modeCounts[mode] === undefined) {
      modeCounts.other += 1;
    } else {
      modeCounts[mode] += 1;
    }

    if (!lastGeneratedAt || createdAt > lastGeneratedAt) {
      lastGeneratedAt = createdAt;
    }
  }

  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const key = formatDateKey(date);
    daily.push({
      date: key,
      label: date.toLocaleDateString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
      }),
      count: dailyMap.get(key) || 0,
    });
  }

  const monthly = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = formatMonthKey(date);
    monthly.push({
      month: key,
      label: date.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
      }),
      count: monthlyMap.get(key) || 0,
    });
  }

  const distribution = Object.entries(modeCounts).map(([key, count]) => {
    const meta = MODE_META[key] || MODE_META.other;
    return {
      key,
      label: meta.label,
      color: meta.color,
      count,
    };
  });

  return {
    totals,
    daily,
    monthly,
    distribution,
    lastGeneratedAt: lastGeneratedAt ? lastGeneratedAt.toISOString() : null,
    historyCount: totals.total,
  };
}

async function buildUserStatsPayload(user) {
  const stats = computeStatsFromHistory(await loadUserHistory(user.id));
  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      isSuperAdmin: Boolean(user.isSuperAdmin),
      isActive: Boolean(user.isActive),
      showApiConfig: Boolean(user.showApiConfig),
      apiKeyConfigured:
        typeof user.apiKeyEncrypted === "string" &&
        user.apiKeyEncrypted.trim() !== "",
      createdAt: user.createdAt || null,
    },
    totals: stats.totals,
    daily: stats.daily,
    monthly: stats.monthly,
    distribution: stats.distribution,
    lastGeneratedAt: stats.lastGeneratedAt,
    historyCount: stats.historyCount,
  };
}

async function buildSummaryStats() {
  const summary = {
    totals: { today: 0, thisMonth: 0, total: 0 },
    users: {
      total: users.length,
      activeWithGenerations: 0,
      withApiKey: users.filter(
        (u) =>
          typeof u.apiKeyEncrypted === "string" &&
          u.apiKeyEncrypted.trim() !== "",
      ).length,
    },
    perUser: [],
  };

  for (const user of users) {
    const userStats = await buildUserStatsPayload(user);
    summary.totals.today += userStats.totals.today;
    summary.totals.thisMonth += userStats.totals.thisMonth;
    summary.totals.total += userStats.totals.total;
    if (userStats.totals.total > 0) {
      summary.users.activeWithGenerations += 1;
    }
    summary.perUser.push({
      ...userStats.user,
      totals: userStats.totals,
      lastGeneratedAt: userStats.lastGeneratedAt,
      historyCount: userStats.historyCount,
    });
  }

  summary.perUser.sort((a, b) => b.totals.total - a.totals.total);
  return summary;
}

// 确保历史记录目录存在
async function ensureHistoryDir() {
  try {
    await fs.access(HISTORY_DIR);
  } catch {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
    console.log("📁 创建历史记录目录:", HISTORY_DIR);
  }
}

// 确保图片存储目录存在
async function ensureImagesDir() {
  try {
    await fs.access(IMAGES_DIR);
  } catch {
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    console.log("📁 创建图片存储目录:", IMAGES_DIR);
  }
}

// 确保Session存储目录存在
async function ensureSessionsDir() {
  try {
    await fs.access(SESSIONS_DIR);
  } catch {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
    console.log("📁 创建Session存储目录:", SESSIONS_DIR);
  }
}

// 将 BASE64 图片保存到文件系统
async function saveBase64Image(base64Data, userId, fileName) {
  try {
    // 确保图片目录存在
    await ensureImagesDir();
    
    // 解析 BASE64 数据
    const base64Regex = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/;
    const matches = base64Data.match(base64Regex);
    
    if (!matches) {
      throw new Error("Invalid base64 image format");
    }
    
    const imageType = matches[1];
    const base64String = base64Data.replace(base64Regex, "");
    
    // 将 BASE64 转换为 Buffer
    const imageBuffer = Buffer.from(base64String, "base64");
    
    // 创建用户专属的图片目录
    const userImageDir = path.join(IMAGES_DIR, userId);
    try {
      await fs.access(userImageDir);
    } catch {
      await fs.mkdir(userImageDir, { recursive: true });
    }
    
    // 保存图片文件
    let imageFileName = fileName || `${Date.now()}.${imageType}`;
    
    // 提取文件名（去除路径）
    if (imageFileName.includes('/') || imageFileName.includes('\\')) {
      imageFileName = path.basename(imageFileName);
    }
    
    // 如果没有扩展名，添加图片类型
    if (!imageFileName.includes('.')) {
      imageFileName = `${imageFileName}.${imageType}`;
    }
    
    const imageFilePath = path.join(userImageDir, imageFileName);
    await fs.writeFile(imageFilePath, imageBuffer);
    
    // 返回图片的 URL
    const imageUrl = `/images/${userId}/${imageFileName}`;
    console.log(`💾 图片已保存: ${imageFilePath} (${(imageBuffer.length / 1024).toFixed(2)} KB)`);
    
    return imageUrl;
  } catch (error) {
    console.error("保存图片失败:", error);
    throw error;
  }
}

// 获取用户历史记录
app.get("/api/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = path.join(HISTORY_DIR, `history-${userId}.json`);

    console.log(`📖 请求加载用户 ${userId} 的历史记录`);

    try {
      const data = await fs.readFile(filePath, "utf8");
      const historyData = JSON.parse(data);
      console.log(
        `✅ 成功加载用户 ${userId} 的历史记录: ${historyData.length} 张图片`,
      );
      res.json(historyData);
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(`ℹ️ 用户 ${userId} 的历史记录文件不存在`);
        res.status(404).json({ message: "History file not found" });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("❌ 加载历史记录失败:", error);
    res.status(500).json({ error: "Failed to load history" });
  }
});

// 保存用户历史记录
app.post("/api/history/:userId", async (req, res) => {
  console.log("=".repeat(60));
  console.log("📥 收到保存历史记录请求");
  
  try {
    const { userId } = req.params;
    const historyData = req.body;
    
    console.log(`用户ID: ${userId}`);
    console.log(`历史数据类型: ${Array.isArray(historyData) ? '数组' : typeof historyData}`);
    console.log(`历史数据长度: ${historyData?.length || 0}`);
    
    if (!Array.isArray(historyData)) {
      console.error("❌ 历史数据不是数组");
      return res.status(400).json({ error: "Invalid history data format" });
    }
    
    // 确保目录存在
    await ensureHistoryDir();
    await ensureImagesDir();
    console.log("✅ 目录已确认存在");
    
    const filePath = path.join(HISTORY_DIR, `history-${userId}.json`);
    console.log(`📝 目标文件路径: ${filePath}`);
    
    // 直接保存历史记录（图片已经在前端上传时转换为URL）
    console.log(`\n📊 历史记录概览:`);
    for (let i = 0; i < historyData.length; i++) {
      const item = historyData[i];
      console.log(`  ${i + 1}. ${item.fileName} - ${item.imageUrl ? (item.imageUrl.startsWith('/images/') ? '服务器图片' : item.imageUrl.startsWith('data:') ? 'BASE64数据' : '其他URL') : '无图片'}`);
    }

    // 将数据写入文件
    const jsonData = JSON.stringify(historyData, null, 2);
    console.log(`💾 开始写入JSON文件...`);
    await fs.writeFile(filePath, jsonData, "utf8");
    console.log(`✅ JSON文件写入成功`);
    
    // 验证文件是否创建
    const stats = await fs.stat(filePath);
    console.log(`📁 JSON文件大小: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // 更新用户统计
    console.log(`\n📊 更新用户统计...`);
    await updateUserStats(userId, historyData);
    
    console.log("=".repeat(60));
    res.json({ 
      message: "History saved successfully",
      recordCount: historyData.length
    });
  } catch (error) {
    console.error("❌ 保存历史记录失败:", error);
    console.error("错误类型:", error.name);
    console.error("错误消息:", error.message);
    console.error("错误堆栈:", error.stack);
    console.log("=".repeat(60));
    res.status(500).json({ error: "Failed to save history", details: error.message });
  }
});

// 删除用户历史记录
app.delete("/api/history/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = path.join(HISTORY_DIR, `history-${userId}.json`);

    console.log(`🗑️ 删除用户 ${userId} 的历史记录文件`);

    try {
      await fs.unlink(filePath);
      console.log(`✅ 成功删除用户 ${userId} 的历史记录文件`);
      res.json({ message: "History deleted successfully" });
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(`ℹ️ 用户 ${userId} 的历史记录文件不存在`);
        res.status(404).json({ message: "History file not found" });
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error("❌ 删除历史记录失败:", error);
    res.status(500).json({ error: "Failed to delete history" });
  }
});

// 统计 API
app.get("/api/stats", requireAuth, async (req, res) => {
  try {
    const { user: sessionUser } = req.session;
    const { scope = "self", userId } = req.query;

    if (scope === "summary") {
      if (!sessionUser.isSuperAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const summary = await buildSummaryStats();
      return res.json({ scope: "summary", summary });
    }

    if (scope === "user") {
      if (!sessionUser.isSuperAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const targetId = userId || sessionUser.id;
      const user = users.find((u) => u.id === targetId);
      if (!user) {
        return res.status(404).json({ error: "用户不存在" });
      }
      const stats = await buildUserStatsPayload(user);
      return res.json({ scope: "user", stats });
    }

    const user = users.find((u) => u.id === sessionUser.id);
    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }
    const stats = await buildUserStatsPayload(user);
    res.json({ scope: "self", stats });
  } catch (error) {
    console.error("获取统计数据失败:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// 管理端获取所有用户的历史记录
app.get("/api/admin/all-history", requireAdmin, async (req, res) => {
  try {
    console.log("📖 管理员请求获取所有用户的历史记录");
    
    const allHistory = [];
    
    // 遍历所有用户
    for (const user of users) {
      try {
        const history = await loadUserHistory(user.id);
        
        // 为每条记录添加用户信息
        const historyWithUser = history.map(record => ({
          ...record,
          user: {
            id: user.id,
            username: user.username,
            email: user.email
          }
        }));
        
        allHistory.push(...historyWithUser);
      } catch (error) {
        console.error(`加载用户 ${user.id} 的历史记录失败:`, error);
        // 继续处理其他用户
      }
    }
    
    // 按创建时间倒序排序
    allHistory.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA;
    });
    
    console.log(`✅ 成功加载所有用户的历史记录: ${allHistory.length} 条`);
    res.json({ history: allHistory, total: allHistory.length });
  } catch (error) {
    console.error("❌ 获取所有用户历史记录失败:", error);
    res.status(500).json({ error: "Failed to fetch all history" });
  }
});

// Google Gemini API 代理（解决中国用户网络屏蔽问题）
app.post("/api/gemini/generate", requireAuth, async (req, res) => {
  try {
    const { requestBody, apiKey } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: "API 密钥不能为空" });
    }
    
    if (!requestBody) {
      return res.status(400).json({ error: "请求体不能为空" });
    }
    
    console.log("🌐 代理 Google Gemini API 请求...");
    
    // 使用 fetch 调用 Google API
    // Node.js 18+ 内置 fetch，低版本使用 node-fetch v2
    let fetch;
    if (globalThis.fetch) {
      fetch = globalThis.fetch;
    } else {
      // 动态导入 node-fetch v2（CommonJS 兼容）
      fetch = require('node-fetch');
    }
    
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error("❌ Google API 返回错误:", response.status);
      return res.status(response.status).json(data);
    }
    
    console.log("✅ Google API 请求成功");
    res.json(data);
  } catch (error) {
    console.error("❌ 代理 Google API 请求失败:", error);
    res.status(500).json({ 
      error: "代理请求失败", 
      details: error.message 
    });
  }
});

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Server is running",
    instanceId: SERVER_INSTANCE_ID,
    startedAt: SERVER_STARTED_AT,
  });
});

// 所有其他路由返回React应用
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// 启动服务器
async function startServer() {
  await ensureHistoryDir();
  await ensureImagesDir();
  await ensureSessionsDir();

  const net = require("net");

  // 检查端口是否可用
  function isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.listen(port, "0.0.0.0", () => {
        server.once("close", () => {
          resolve(true);
        });
        server.close();
      });
      server.on("error", () => {
        resolve(false);
      });
    });
  }

  // 尝试启动服务器
  async function tryStartServer(port) {
    const available = await isPortAvailable(port);
    if (!available) {
      console.log(`⚠️ 端口 ${port} 不可用，尝试下一个端口...`);
      return false;
    }

    return new Promise((resolve, reject) => {
      const server = app.listen(port, "0.0.0.0", () => {
        console.log(`🚀 服务器运行在端口 ${port}`);
        console.log(`📁 历史记录存储在: ${HISTORY_DIR}`);
        console.log(`🌐 本地访问地址: http://localhost:${port}`);
        console.log(`🌐 网络访问地址: http://0.0.0.0:${port}`);
        console.log(`✅ 服务器已绑定所有网络接口，可从外部访问`);
        resolve(true);
      });

      server.on("error", (err) => {
        console.log(`⚠️ 端口 ${port} 启动失败: ${err.message}`);
        resolve(false);
      });
    });
  }

  // 尝试多个端口
  const portsToTry = [8080, 8081, 8082, 9000, 9001, 3001];

  for (const port of portsToTry) {
    const success = await tryStartServer(port);
    if (success) {
      return;
    }
  }

  console.error("❌ 所有端口都无法启动，请检查系统权限或防火墙设置");
  process.exit(1);
}

startServer().catch(console.error);

module.exports = app;
