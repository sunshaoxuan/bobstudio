const express = require("express");
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const cors = require("cors");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const crypto = require("crypto");
const nodemailer = require("nodemailer");

// ===== 日志管理系统 =====
const LOGS_DIR = path.join(__dirname, "logs");
const CURRENT_LOG_FILE = path.join(LOGS_DIR, "output.log");
let currentLogDate = null;
let logStream = null;

// 确保日志目录存在
async function ensureLogsDir() {
  try {
    await fs.access(LOGS_DIR);
  } catch {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    console.log("📁 创建日志目录:", LOGS_DIR);
  }
}

// 获取当前日期字符串（YYYY-MM-DD）
function getCurrentDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 归档当前日志文件
async function archiveCurrentLog() {
  try {
    // 检查当前日志文件是否存在
    try {
      await fs.access(CURRENT_LOG_FILE);
    } catch {
      return; // 文件不存在，无需归档
    }
    
    // 读取日志文件第一行获取日期
    const content = await fs.readFile(CURRENT_LOG_FILE, 'utf8');
    if (!content.trim()) {
      return; // 空文件，无需归档
    }
    
    // 从第一行提取日期
    const firstLine = content.split('\n')[0];
    const dateMatch = firstLine.match(/\[(\d{4}-\d{2}-\d{2})/);
    const logDate = dateMatch ? dateMatch[1] : getCurrentDateString();
    
    // 归档文件名
    const archiveFileName = `output-${logDate}.log`;
    const archivePath = path.join(LOGS_DIR, archiveFileName);
    
    // 如果归档文件已存在，追加内容
    if (fsSync.existsSync(archivePath)) {
      const existingContent = await fs.readFile(archivePath, 'utf8');
      await fs.writeFile(archivePath, existingContent + '\n' + content, 'utf8');
      console.log(`📝 追加到归档日志: ${archiveFileName}`);
    } else {
      await fs.rename(CURRENT_LOG_FILE, archivePath);
      console.log(`📦 归档日志文件: ${archiveFileName}`);
    }
  } catch (error) {
    console.error('❌ 归档日志失败:', error);
  }
}

// 检查并分割跨日日志
async function checkAndRotateLog() {
  const today = getCurrentDateString();
  
  // 如果日期没变，无需操作
  if (currentLogDate === today) {
    return;
  }
  
  // 如果这是首次启动或日期已改变
  if (currentLogDate && currentLogDate !== today) {
    console.log(`📅 检测到日期变更: ${currentLogDate} -> ${today}，开始归档旧日志...`);
    
    // 关闭当前日志流
    if (logStream) {
      logStream.end();
      logStream = null;
    }
    
    // 归档旧日志
    await archiveCurrentLog();
  }
  
  // 更新当前日期
  currentLogDate = today;
  
  // 创建新的日志流
  if (!logStream || logStream.destroyed) {
    logStream = fsSync.createWriteStream(CURRENT_LOG_FILE, { flags: 'a' });
  }
}

// 初始化日志系统
async function initLogSystem() {
  await ensureLogsDir();
  await checkAndRotateLog();
  
  // 每小时检查一次日志分割
  setInterval(async () => {
    await checkAndRotateLog();
  }, 60 * 60 * 1000); // 1小时检查一次
  
  console.log('📝 日志系统已初始化');
}

// 保存原始console方法
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

// 格式化日志时间
const formatLogTime = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 23);
};

// 写入日志文件
const writeToLogFile = (message) => {
  if (logStream && !logStream.destroyed) {
    logStream.write(message + '\n');
  }
};

// 重写console方法，同时输出到控制台和文件
console.log = (...args) => {
  const message = `[${formatLogTime()}] ${args.join(' ')}`;
  originalLog(message);
  writeToLogFile(message);
};

console.error = (...args) => {
  const message = `[${formatLogTime()}] ${args.join(' ')}`;
  originalError(message);
  writeToLogFile(message);
};

console.warn = (...args) => {
  const message = `[${formatLogTime()}] ${args.join(' ')}`;
  originalWarn(message);
  writeToLogFile(message);
};
// ===== 日志管理系统结束 =====

const API_KEY_SECRET =
  process.env.API_KEY_ENCRYPTION_SECRET || "change-me-bobstudio-secret";
const API_KEY_KEY = crypto.createHash("sha256").update(API_KEY_SECRET).digest();
const API_KEY_IV_LENGTH = 12;

// 目录定义
const HISTORY_DIR = path.join(__dirname, "history");
const IMAGES_DIR = path.join(__dirname, "images");
const SESSIONS_DIR = path.join(__dirname, "sessions");

// ===== 在线用户跟踪 =====
const activeUsers = new Map(); // { username: { lastActivity: timestamp, sessionId: string } }
const IDLE_TIMEOUT = 15 * 60 * 1000; // 15分钟无活动视为离线

function updateUserActivity(username, sessionId) {
  if (username) {
    activeUsers.set(username, {
      lastActivity: Date.now(),
      sessionId: sessionId
    });
  }
}

function getOnlineUsers() {
  const now = Date.now();
  const onlineUsers = [];
  
  for (const [username, data] of activeUsers.entries()) {
    const idleTime = now - data.lastActivity;
    if (idleTime < IDLE_TIMEOUT) {
      onlineUsers.push({
        username,
        lastActivity: data.lastActivity,
        idleTime: idleTime,
        status: idleTime < 60000 ? 'active' : 'idle' // 1分钟内为活跃，否则为闲置
      });
    } else {
      // 移除超时用户
      activeUsers.delete(username);
    }
  }
  
  return onlineUsers.sort((a, b) => a.idleTime - b.idleTime);
}

// 定期清理离线用户
setInterval(() => {
  const now = Date.now();
  for (const [username, data] of activeUsers.entries()) {
    if (now - data.lastActivity >= IDLE_TIMEOUT) {
      activeUsers.delete(username);
      console.log(`🚪 用户 ${username} 已离线（超时）`);
    }
  }
}, 60000); // 每分钟检查一次
// ===== 在线用户跟踪结束 =====

// ===== 邮件配置 =====
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'mail.briconbric.com',
  port: process.env.SMTP_PORT || 465,
  secure: true, // true for 465 (SSL), false for 587 (TLS)
  auth: {
    user: process.env.SMTP_USER || 'postmaster@briconbric.com',
    pass: process.env.SMTP_PASS || 'BtZhY1^3'
  },
  tls: {
    rejectUnauthorized: false // 允许自签名证书
  },
  connectionTimeout: 30000, // 30秒连接超时
  greetingTimeout: 30000,
  socketTimeout: 30000
};

const SITE_URL = process.env.SITE_URL || 'https://studio.briconbric.com';
const EMAIL_FROM = process.env.EMAIL_FROM || 'BOB Studio <postmaster@briconbric.com>';

// 创建邮件传输器
let emailTransporter = null;
try {
  emailTransporter = nodemailer.createTransport(EMAIL_CONFIG);
  console.log('✅ 邮件服务已配置:', EMAIL_CONFIG.host);
} catch (error) {
  console.error('❌ 邮件服务配置失败:', error.message);
}

// 发送激活邮件
async function sendActivationEmail(email, username, activationToken) {
  if (!emailTransporter) {
    throw new Error('邮件服务未配置');
  }

  const activationLink = `${SITE_URL}/activate/${activationToken}`;
  
  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: '激活您的 BOB Studio 账户',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #8B5CF6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎨 欢迎来到 BOB Studio</h1>
          </div>
          <div class="content">
            <p>亲爱的 <strong>${username}</strong>，</p>
            <p>感谢您注册 BOB Studio！您的 AI 图像创作之旅即将开始。</p>
            <p>请点击下面的按钮激活您的账户：</p>
            <p style="text-align: center;">
              <a href="${activationLink}" class="button">激活账户</a>
            </p>
            <p>或复制以下链接到浏览器打开：</p>
            <p style="background: #fff; padding: 10px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 12px;">
              ${activationLink}
            </p>
            <p><strong>注意：</strong>此链接将在 24 小时后失效。</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">
              如果您没有注册 BOB Studio 账户，请忽略此邮件。
            </p>
          </div>
          <div class="footer">
            <p>© 2025 BOB Studio. All rights reserved.</p>
            <p>${SITE_URL}</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    console.log('📧 激活邮件已发送:', email, '| MessageID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ 发送激活邮件失败:', email, '|', error.message);
    throw error;
  }
}

// 发送密码重置邮件
async function sendPasswordResetEmail(email, username, resetToken) {
  if (!emailTransporter) {
    throw new Error('邮件服务未配置');
  }

  const resetLink = `${SITE_URL}/reset-password/${resetToken}`;
  
  const mailOptions = {
    from: EMAIL_FROM,
    to: email,
    subject: '重置您的 BOB Studio 密码',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #EF4444 0%, #F97316 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #EF4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 重置密码请求</h1>
          </div>
          <div class="content">
            <p>亲爱的 <strong>${username}</strong>，</p>
            <p>我们收到了您的密码重置请求。</p>
            <p>请点击下面的按钮重置您的密码：</p>
            <p style="text-align: center;">
              <a href="${resetLink}" class="button">重置密码</a>
            </p>
            <p>或复制以下链接到浏览器打开：</p>
            <p style="background: #fff; padding: 10px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 12px;">
              ${resetLink}
            </p>
            <div class="warning">
              <p><strong>⚠️ 重要提示：</strong></p>
              <ul>
                <li>此链接将在 <strong>24 小时</strong>后失效</li>
                <li>此链接仅可使用一次</li>
                <li>请勿将此链接分享给他人</li>
              </ul>
            </div>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="color: #666; font-size: 14px;">
              如果您没有请求重置密码，请忽略此邮件。您的密码不会被更改。
            </p>
          </div>
          <div class="footer">
            <p>© 2025 BOB Studio. All rights reserved.</p>
            <p>${SITE_URL}</p>
          </div>
        </div>
      </body>
      </html>
    `.trim()
  };

  try {
    const info = await emailTransporter.sendMail(mailOptions);
    console.log('📧 密码重置邮件已发送:', email, '| MessageID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ 发送密码重置邮件失败:', email, '|', error.message);
    throw error;
  }
}
// ===== 邮件配置结束 =====

let users = [];

const saveUsers = () => {
  require("fs").writeFileSync(
    path.join(__dirname, "users.json"),
    JSON.stringify(users, null, 2),
  );
};

// ===== 社交关系与共享逻辑 =====
const getSuperAdminIds = () => users.filter(u => u && u.isSuperAdmin).map(u => u.id);
const getFirstSuperAdminId = () => {
  const ids = getSuperAdminIds();
  return ids.length ? ids[0] : null;
};

// 计算用户的好友列表（包含默认关系：管理员<->所有人）
const computeFriends = (user) => {
  if (!user) return [];
  const base = Array.isArray(user.friends) ? [...user.friends] : [];
  const adminId = getFirstSuperAdminId();
  if (!adminId) return base;

  if (user.id === adminId) {
    // 管理员默认与所有人互为好友
    const all = users.filter(u => u.id !== adminId).map(u => u.id);
    return Array.from(new Set([...base, ...all]));
  }
  // 普通用户默认与管理员互为好友
  return Array.from(new Set([ ...base, adminId ]));
};

// 双向添加好友（不覆盖默认规则）
const addFriendship = (userId, friendId) => {
  if (userId === friendId) return;
  const a = users.find(u => u.id === userId);
  const b = users.find(u => u.id === friendId);
  if (!a || !b) return;
  a.friends = Array.isArray(a.friends) ? a.friends : [];
  b.friends = Array.isArray(b.friends) ? b.friends : [];
  if (!a.friends.includes(friendId)) a.friends.push(friendId);
  if (!b.friends.includes(userId)) b.friends.push(userId);
  saveUsers();
};

// 双向移除好友（管理员默认关系不可移除）
const removeFriendship = (userId, friendId) => {
  const adminId = getFirstSuperAdminId();
  if (!adminId) return;
  if (userId === adminId || friendId === adminId) {
    // 管理员与任何人的默认好友关系不可移除
    return;
  }
  const a = users.find(u => u.id === userId);
  const b = users.find(u => u.id === friendId);
  if (!a || !b) return;
  a.friends = (Array.isArray(a.friends) ? a.friends : []).filter(id => id !== friendId);
  b.friends = (Array.isArray(b.friends) ? b.friends : []).filter(id => id !== userId);
  saveUsers();
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

    // 计算统计（包括已删除的记录，因为生成过就产生了成本）
    let todayCount = 0;
    let thisMonthCount = 0;
    const totalCount = historyData.length; // 所有记录，包括已删除

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

    // 🔑 管理员分配的API Key限制：达到额度后自动清空（可配置）
    // 注意：超级管理员不受限制
    const isSuperAdmin = Boolean(user.isSuperAdmin);
    const limitEnabled = !isSuperAdmin && (typeof user.freeLimitEnabled === 'boolean' ? user.freeLimitEnabled : true);
    const FREE_GENERATION_LIMIT = (Number.isFinite(user.freeLimit) && user.freeLimit > 0) ? Math.floor(user.freeLimit) : 30;
    
    if (limitEnabled && totalCount >= FREE_GENERATION_LIMIT && user.apiKeyEncrypted) {
      const hadApiKey = user.apiKeyEncrypted !== "";
      user.apiKeyEncrypted = "";
      user.showApiConfig = true;  // 🔑 关键改动：达到额度后自动开放自助配置
      
      if (hadApiKey) {
        console.log(`🔒 用户 ${userId} (${user.username}) 已生成 ${totalCount} 张图片，已自动清空API Key`);
        console.log(`✨ 已开放自助配置权限，用户可自行配置 API Key 继续使用`);
      }
    }
    
    if (isSuperAdmin) {
      console.log(`👑 超级管理员不受额度限制`);
    }

    // 保存用户数据
    saveUsers();
    console.log(`✅ 统计已更新 - 今日: ${todayCount}, 本月: ${thisMonthCount}, 总计: ${totalCount}`);
    
    if (limitEnabled && totalCount >= FREE_GENERATION_LIMIT) {
      console.log(`⚠️ 用户已达到免费额度限制 (${totalCount}/${FREE_GENERATION_LIMIT})`);
    }
    
    return { apiKeyCleared: limitEnabled && totalCount >= FREE_GENERATION_LIMIT && user.apiKeyEncrypted === "" , limitEnabled, limit: FREE_GENERATION_LIMIT };
  } catch (error) {
    console.error(`❌ 更新用户统计失败:`, error);
    return { apiKeyCleared: false };
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

// 用户活动跟踪中间件
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    updateUserActivity(req.session.user.username, req.sessionID);
  }
  next();
});

// 服务静态文件
// HTML 文件不缓存，JS/CSS 文件长期缓存（因为有哈希名）
app.use(express.static("build", {
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // HTML 不缓存，每次都检查最新版本
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$/)) {
      // 静态资源长期缓存（1年）
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

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
    // 免费额度控制（管理员可配置）
    freeLimitEnabled: typeof rest?.freeLimitEnabled === 'boolean' ? rest.freeLimitEnabled : true,
    freeLimit: Number.isFinite(rest?.freeLimit) && rest.freeLimit > 0 ? Math.floor(rest.freeLimit) : 30,
    // 显示名称
    displayName: rest?.displayName || rest?.username || '',
    // 待验证邮箱
    pendingEmail: rest?.pendingEmail || null,
  };

  return safe;
};

// 返回前端会话所需的用户信息
// 注意：API Key 安全策略
// - 管理员分配的Key（showApiConfig=false）：不传回前端
// - 用户自配的Key（showApiConfig=true）：传回加密值，前端用密码框显示
const toSessionUser = (user) => {
  const safe = toSafeUser(user);
  if (!safe) return null;
  
  const sessionUser = {
    ...safe,
    isSuperAdmin: Boolean(safe.isSuperAdmin),
    isActive: Boolean(safe.isActive),
    hasApiKey: safe.hasApiKey,
  };
  
  // 只有用户自己配置的API Key才传回前端（加密传输）
  if (safe.showApiConfig && (user.apiKeyEncrypted || user.apiKey)) {
    const decryptedKey = decryptSensitiveValue(user.apiKeyEncrypted || user.apiKey || "");
    // 前端接收后立即用密码框显示，禁止复制
    sessionUser.apiKey = decryptedKey;
  }
  
  return sessionUser;
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
      apiKeyEncrypted: "",
      isActive: true,
      isSuperAdmin: true,
      showApiConfig: false, // 管理员不需要自配置
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
// 用户注册
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: "用户名、邮箱和密码均为必填" });
    }
    
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim();
    
    if (users.some((u) => u.email === normalizedEmail)) {
      return res.status(409).json({ error: "邮箱已被注册" });
    }
    
    if (users.some((u) => u.username && u.username.toLowerCase() === normalizedUsername.toLowerCase())) {
      return res.status(409).json({ error: "用户名已存在" });
    }
    
    // 生成激活令牌（24小时有效）
    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
    
    const newUser = {
      id: `user_${Date.now()}`,
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashPassword(password),
      apiKeyEncrypted: "",
      isActive: false, // 需要邮件激活
      isSuperAdmin: false,
      showApiConfig: true, // 自注册用户可以自己配置API Key
      createdAt: new Date().toISOString(),
      activationToken,
      activationExpires: activationExpires.toISOString()
    };
    
    users.push(newUser);
    saveUsers();
    
    // 发送激活邮件
    try {
      await sendActivationEmail(normalizedEmail, normalizedUsername, activationToken);
      console.log(`✅ 用户注册成功: ${normalizedUsername} (${normalizedEmail})`);
      res.status(201).json({ 
        success: true,
        message: "注册成功！请检查您的邮箱并点击激活链接。" 
      });
    } catch (emailError) {
      console.error('❌ 发送激活邮件失败:', emailError);
      // 如果邮件发送失败，删除用户并返回错误
      users = users.filter(u => u.id !== newUser.id);
      saveUsers();
      return res.status(500).json({ 
        error: "注册失败：无法发送激活邮件。请稍后重试或联系管理员。",
        details: emailError.message
      });
    }
  } catch (error) {
    console.error('❌ 注册失败:', error);
    res.status(500).json({ error: "注册失败", details: error.message });
  }
});

// 激活账户
app.get("/api/auth/activate/:token", async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = users.find(u => u.activationToken === token);
    
    if (!user) {
      // 检查是否用户已经激活（通过 isActive 字段）
      const alreadyActivated = users.find(u => u.isActive && !u.activationToken);
      if (alreadyActivated) {
        return res.json({ 
          success: true,
          message: "账户已经激活！您可以直接登录。" 
        });
      }
      return res.status(404).json({ error: "无效的激活链接" });
    }
    
    // 检查令牌是否过期
    if (new Date() > new Date(user.activationExpires)) {
      return res.status(410).json({ error: "激活链接已过期，请重新注册" });
    }
    
    // 检查用户是否已经激活
    if (user.isActive) {
      console.log(`ℹ️ 用户 ${user.username} 尝试重复激活`);
      // 清除激活令牌（防止重复激活）
      user.activationToken = undefined;
      user.activationExpires = undefined;
      saveUsers();
      
      return res.json({ 
        success: true,
        message: "账户已经激活！您可以直接登录。" 
      });
    }
    
    // 激活用户
    user.isActive = true;
    user.activationToken = undefined;
    user.activationExpires = undefined;
    
    // 🎁 新用户激活福利：自动分配体验额度
    // 1. 复制管理员的 API Key 给新用户
    const adminId = getFirstSuperAdminId();
    const admin = adminId ? users.find(u => u.id === adminId) : null;
    
    if (admin && (admin.apiKeyEncrypted || admin.apiKey)) {
      // 复制管理员的 API Key
      user.apiKeyEncrypted = admin.apiKeyEncrypted || admin.apiKey;
      
      // 2. 设置体验额度配置
      user.freeLimitEnabled = true;  // 启用额度限制
      user.freeLimit = 30;           // 30张免费体验
      user.showApiConfig = false;    // 初始不允许自己配置（用完后自动开放）
      
      console.log(`🎁 新用户 ${user.username} 获得30张免费体验额度（使用管理员 API Key）`);
    } else {
      console.warn(`⚠️ 管理员未配置 API Key，新用户 ${user.username} 无法获得体验额度`);
    }
    
    saveUsers();
    
    console.log(`✅ 用户激活成功: ${user.username} (${user.email})`);
    res.json({ 
      success: true,
      message: "账户激活成功！\n\n🎁 您已获得30张免费图片生成额度，立即登录开始创作吧！" 
    });
  } catch (error) {
    console.error('❌ 激活失败:', error);
    res.status(500).json({ error: "激活失败", details: error.message });
  }
});

// 忘记密码 - 请求重置
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { username } = req.body || {};
    
    if (!username) {
      return res.status(400).json({ error: "请输入用户名" });
    }
    
    const normalizedUsername = String(username).trim();
    const user = users.find(u => u.username && u.username.toLowerCase() === normalizedUsername.toLowerCase());
    
    if (!user) {
      // 为了安全，不透露用户是否存在
      return res.json({ 
        success: true,
        message: "如果该用户名存在，重置密码邮件已发送。" 
      });
    }
    
    // 生成重置令牌（24小时有效）
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
    
    user.resetToken = resetToken;
    user.resetExpires = resetExpires.toISOString();
    saveUsers();
    
    // 发送重置邮件（不显示完整邮箱地址）
    try {
      await sendPasswordResetEmail(user.email, user.username, resetToken);
      
      // 返回时隐藏邮箱地址
      const maskedEmail = user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      
      console.log(`✅ 密码重置请求: ${user.username} (${maskedEmail})`);
      res.json({ 
        success: true,
        message: `重置密码邮件已发送到 ${maskedEmail}` 
      });
    } catch (emailError) {
      console.error('❌ 发送重置邮件失败:', emailError);
      return res.status(500).json({ 
        error: "发送重置邮件失败，请稍后重试",
        details: emailError.message
      });
    }
  } catch (error) {
    console.error('❌ 密码重置请求失败:', error);
    res.status(500).json({ error: "操作失败", details: error.message });
  }
});

// 重置密码
app.post("/api/auth/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body || {};
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "密码至少需要 6 个字符" });
    }
    
    const user = users.find(u => u.resetToken === token);
    
    if (!user) {
      return res.status(404).json({ error: "无效的重置链接" });
    }
    
    // 检查令牌是否过期
    if (new Date() > new Date(user.resetExpires)) {
      return res.status(410).json({ error: "重置链接已过期，请重新申请" });
    }
    
    // 重置密码
    user.password = hashPassword(newPassword);
    user.resetToken = undefined;
    user.resetExpires = undefined;
    saveUsers();
    
    console.log(`✅ 密码重置成功: ${user.username}`);
    res.json({ 
      success: true,
      message: "密码重置成功！请使用新密码登录。" 
    });
  } catch (error) {
    console.error('❌ 密码重置失败:', error);
    res.status(500).json({ error: "密码重置失败", details: error.message });
  }
});

// 修改密码（已登录用户）
app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  try {
    const user = users.find(u => u.id === req.session.user.id);
    
    if (!user) {
      return res.status(404).json({ error: "用户不存在" });
    }
    
    // 生成重置令牌
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    user.resetToken = resetToken;
    user.resetExpires = resetExpires.toISOString();
    saveUsers();
    
    // 发送重置邮件
    try {
      await sendPasswordResetEmail(user.email, user.username, resetToken);
      
      const maskedEmail = user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      
      console.log(`✅ 修改密码请求: ${user.username} (${maskedEmail})`);
      res.json({ 
        success: true,
        message: `验证邮件已发送到 ${maskedEmail}，请查收` 
      });
    } catch (emailError) {
      console.error('❌ 发送验证邮件失败:', emailError);
      return res.status(500).json({ 
        error: "发送验证邮件失败，请稍后重试"
      });
    }
  } catch (error) {
    console.error('❌ 修改密码请求失败:', error);
    res.status(500).json({ error: "操作失败", details: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
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

  // 检查账户是否被锁定
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remainingMinutes = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
    console.warn(`🔒 用户 ${user.username} 账户已锁定，剩余 ${remainingMinutes} 分钟`);
    return res.status(401).json({ 
      error: `账户已被锁定，请 ${remainingMinutes} 分钟后再试，或通过邮件重置密码`,
      locked: true,
      remainingMinutes
    });
  }

  // 如果锁定时间已过，清除锁定状态
  if (user.lockedUntil && new Date(user.lockedUntil) <= new Date()) {
    user.lockedUntil = null;
    user.loginAttempts = 0;
    saveUsers();
  }

  if (!user.isActive && !user.isSuperAdmin) {
    return res.status(401).json({ error: "账户尚未激活" });
  }

  // 验证密码
  if (user.password !== hashPassword(password)) {
    // 登录失败：递增尝试次数
    user.loginAttempts = (user.loginAttempts || 0) + 1;
    
    console.warn(`❌ 用户 ${user.username} 登录失败 (尝试 ${user.loginAttempts}/5)`);
    
    // 达到5次失败，锁定账户
    if (user.loginAttempts >= 5) {
      const lockDuration = 30 * 60 * 1000; // 30分钟
      user.lockedUntil = new Date(Date.now() + lockDuration).toISOString();
      
      console.error(`🔒 用户 ${user.username} 账户已锁定30分钟（5次登录失败）`);
      
      // 生成密码重置令牌
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetToken = resetToken;
      user.resetTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24小时
      
      saveUsers();
      
      // 发送密码重置邮件
      try {
        await sendPasswordResetEmail(user.email, user.username, resetToken);
        console.log(`📧 已向 ${user.username} 发送密码重置邮件`);
      } catch (emailError) {
        console.error(`📧 发送密码重置邮件失败:`, emailError.message);
        // 即使邮件发送失败，也继续锁定账户
      }
      
      return res.status(401).json({ 
        error: "登录失败次数过多，账户已被锁定30分钟。密码重置邮件已发送到您的邮箱。",
        locked: true,
        attemptsExceeded: true
      });
    }
    
    saveUsers();
    
    const remainingAttempts = 5 - user.loginAttempts;
    return res.status(401).json({ 
      error: `密码错误，还剩 ${remainingAttempts} 次尝试机会`,
      remainingAttempts
    });
  }

  // 登录成功：重置尝试次数
  user.loginAttempts = 0;
  user.lockedUntil = null;
  saveUsers();

  // 创建session
  req.session.user = toSessionUser(user);

  // 更新在线状态
  updateUserActivity(user.username, req.sessionID);
  console.log(`✅ 用户 ${user.username} 登录成功 [在线用户: ${activeUsers.size}]`);
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
    const username = req.session.user.username;
    activeUsers.delete(username);
    console.log(`🚪 用户 ${username} 退出登录 [在线用户: ${activeUsers.size}]`);
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

// ===== 搜索用户（通过用户名或邮箱精确查找）=====
app.post('/api/users/search', requireAuth, (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: '请输入用户名或邮箱' });
    }
    
    const searchTerm = query.trim().toLowerCase();
    const found = users.find(u => 
      u.isActive && 
      u.id !== req.session.user.id && 
      (u.username?.toLowerCase() === searchTerm || u.email?.toLowerCase() === searchTerm)
    );
    
    if (!found) {
      return res.json({ found: false, message: '未找到该用户' });
    }
    
    res.json({
      found: true,
      user: {
        id: found.id,
        username: found.username,
        displayName: found.displayName || found.username,
        email: found.email,
        isSuperAdmin: !!found.isSuperAdmin
      }
    });
  } catch (error) {
    console.error('搜索用户失败:', error);
    res.status(500).json({ error: 'Failed to search user' });
  }
});

// ===== 更新个人资料 =====
app.post('/api/profile/update', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { displayName, email } = req.body;
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    
    let emailChanged = false;
    
    // 更新显示名称
    if (displayName !== undefined && displayName.trim()) {
      user.displayName = displayName.trim();
    }
    
    // 如果邮箱改变，需要验证
    if (email && email.trim() && email.trim().toLowerCase() !== user.email.toLowerCase()) {
      // TODO: 发送验证邮件，这里先标记为待验证
      user.pendingEmail = email.trim().toLowerCase();
      emailChanged = true;
      // 实际应用中应该发送验证邮件
    }
    
    saveUsers();
    req.session.user = toSessionUser(user);
    
    res.json({ 
      success: true, 
      message: emailChanged ? '显示名称已更新，邮箱验证邮件已发送' : '个人资料已更新',
      emailChanged
    });
  } catch (error) {
    console.error('更新个人资料失败:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ===== 消息通知系统 =====
app.get('/api/notifications', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    
    const notifications = Array.isArray(user.notifications) ? user.notifications : [];
    res.json({ notifications });
  } catch (error) {
    console.error('获取通知失败:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { id } = req.params;
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    
    if (!Array.isArray(user.notifications)) user.notifications = [];
    const notification = user.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      saveUsers();
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('标记通知已读失败:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// 添加通知的辅助函数
const addNotification = (userId, notification) => {
  const user = users.find(u => u.id === userId);
  if (!user) return;
  
  if (!Array.isArray(user.notifications)) user.notifications = [];
  
  user.notifications.unshift({
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    ...notification,
    createdAt: new Date().toISOString(),
    read: false
  });
  
  // 只保留最近50条通知
  if (user.notifications.length > 50) {
    user.notifications = user.notifications.slice(0, 50);
  }
  
  saveUsers();
};

// ===== 好友关系 API =====
app.get('/api/friends', requireAuth, (req, res) => {
  try {
    const me = users.find(u => u.id === req.session.user.id);
    if (!me) return res.status(404).json({ error: '用户不存在' });
    const friendIds = computeFriends(me);
    const friendSummaries = friendIds
      .map(id => users.find(u => u.id === id))
      .filter(Boolean)
      .map(u => ({ 
        id: u.id, 
        username: u.username, 
        displayName: u.displayName || u.username,
        email: u.email, 
        isSuperAdmin: !!u.isSuperAdmin 
      }));
    res.json({ friends: friendSummaries });
  } catch (error) {
    console.error('获取好友列表失败:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

app.post('/api/friends/:friendId', requireAuth, (req, res) => {
  try {
    const meId = req.session.user.id;
    const { friendId } = req.params;
    const me = users.find(u => u.id === meId);
    const target = users.find(u => u.id === friendId);
    if (!target) return res.status(404).json({ error: '好友不存在' });
    if (!me) return res.status(404).json({ error: '用户不存在' });
    
    addFriendship(meId, friendId);
    
    // 发送通知给对方
    addNotification(friendId, {
      type: 'friend_request',
      title: '新的好友',
      message: `${me.displayName || me.username} 已将您添加为好友`,
      from: {
        id: me.id,
        username: me.username,
        displayName: me.displayName || me.username
      }
    });
    
    // 发送通知给自己
    addNotification(meId, {
      type: 'friend_added',
      title: '添加好友成功',
      message: `您已成功添加 ${target.displayName || target.username} 为好友`,
      from: {
        id: target.id,
        username: target.username,
        displayName: target.displayName || target.username
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('添加好友失败:', error);
    res.status(500).json({ error: 'Failed to add friend' });
  }
});

app.delete('/api/friends/:friendId', requireAuth, (req, res) => {
  try {
    const meId = req.session.user.id;
    const { friendId } = req.params;
    const adminId = getFirstSuperAdminId();
    if (friendId === adminId || meId === adminId) {
      return res.status(400).json({ error: '无法移除与管理员的默认好友关系' });
    }
    removeFriendship(meId, friendId);
    res.json({ success: true });
  } catch (error) {
    console.error('移除好友失败:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// 推荐好友给其他好友
app.post('/api/friends/recommend', requireAuth, (req, res) => {
  try {
    const meId = req.session.user.id;
    const { recommendedUserId, targetUserIds } = req.body;
    
    if (!recommendedUserId || !Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return res.status(400).json({ error: '参数错误' });
    }
    
    const me = users.find(u => u.id === meId);
    const recommended = users.find(u => u.id === recommendedUserId);
    
    if (!me || !recommended) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 发送通知给每个目标用户
    targetUserIds.forEach(targetId => {
      const target = users.find(u => u.id === targetId);
      if (target) {
        addNotification(targetId, {
          type: 'friend_recommendation',
          title: '好友推荐',
          message: `${me.displayName || me.username} 向您推荐了好友：${recommended.displayName || recommended.username}（@${recommended.username}）`,
          from: {
            id: me.id,
            username: me.username,
            displayName: me.displayName || me.username
          },
          recommendedUser: {
            id: recommended.id,
            username: recommended.username,
            displayName: recommended.displayName || recommended.username,
            email: recommended.email
          }
        });
      }
    });
    
    res.json({ success: true, notifiedCount: targetUserIds.length });
  } catch (error) {
    console.error('推荐好友失败:', error);
    res.status(500).json({ error: 'Failed to recommend friend' });
  }
});

// ===== 分享 API =====
// 设置（替换）某条历史记录的分享目标用户列表
app.post('/api/share/:ownerId/:imageId', requireAuth, async (req, res) => {
  try {
    const { ownerId, imageId } = req.params;
    const { targets } = req.body || {};
    const actorId = req.session.user.id;
    if (!Array.isArray(targets)) return res.status(400).json({ error: 'targets 必须为数组' });
    const owner = users.find(u => u.id === ownerId);
    if (!owner) return res.status(404).json({ error: '所有者不存在' });
    const isAdmin = !!req.session.user.isSuperAdmin;
    if (actorId !== ownerId && !isAdmin) return res.status(403).json({ error: '无权限修改分享' });

    const filePath = path.join(HISTORY_DIR, `history-${ownerId}.json`);
    let history = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      history = JSON.parse(data);
    } catch (e) {
      // ignore if not exists
      history = [];
    }
    let found = false;
    history = history.map(item => {
      if (String(item.id) === String(imageId)) {
        found = true;
        return { ...item, shareTargets: targets.filter(Boolean) };
      }
      return item;
    });
    if (!found) return res.status(404).json({ error: '记录不存在' });
    await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf8');
    res.json({ success: true });
  } catch (error) {
    console.error('设置分享失败:', error);
    res.status(500).json({ error: 'Failed to set share' });
  }
});

// 获取分享给我的记录
app.get('/api/shares/incoming', requireAuth, async (req, res) => {
  try {
    const meId = req.session.user.id;
    const results = [];
    for (const u of users) {
      const filePath = path.join(HISTORY_DIR, `history-${u.id}.json`);
      try {
        const data = await fs.readFile(filePath, 'utf8');
        const history = JSON.parse(data);
        for (const item of history) {
          if (item && item.shareTargets && Array.isArray(item.shareTargets) && item.shareTargets.includes(meId)) {
            if (item.deleted) continue;
            results.push({
              owner: { id: u.id, username: u.username },
              id: item.id,
              imageUrl: item.imageUrl,
              fileName: item.fileName,
              prompt: item.prompt,
              createdAt: item.createdAt,
              mode: item.mode,
              duration: item.duration || null,
            });
          }
        }
      } catch (e) {
        // skip if file not found
      }
    }
    // 按时间倒序
    results.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json({ items: results, total: results.length });
  } catch (error) {
    console.error('获取共享给我的记录失败:', error);
    res.status(500).json({ error: 'Failed to get incoming shares' });
  }
});

// 我分享出去的记录
app.get('/api/shares/mine', requireAuth, async (req, res) => {
  try {
    const meId = req.session.user.id;
    const filePath = path.join(HISTORY_DIR, `history-${meId}.json`);
    let results = [];
    let history = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      history = JSON.parse(data);
      results = history.filter(it => Array.isArray(it.shareTargets) && it.shareTargets.length > 0 && !it.deleted)
        .map(it => ({ id: it.id, imageUrl: it.imageUrl, fileName: it.fileName, prompt: it.prompt, createdAt: it.createdAt, mode: it.mode }));
    } catch (e) {
      results = [];
    }
    // 解析出目标用户明细
    const expandTargets = results.map(r => ({
      ...r,
      targets: (history || []).find(h => h.id === r.id)?.shareTargets || []
    }));
    res.json({ items: expandTargets, total: expandTargets.length });
  } catch (error) {
    console.error('获取我分享的记录失败:', error);
    res.status(500).json({ error: 'Failed to get my shares' });
  }
});

// 获取在线用户列表
app.get("/api/admin/online-users", requireAdmin, (req, res) => {
  try {
    const onlineUsers = getOnlineUsers();
    console.log(`👥 管理员查询在线用户: ${onlineUsers.length} 人在线`);
    res.json({ 
      onlineUsers,
      total: onlineUsers.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error("获取在线用户失败:", error);
    res.status(500).json({ error: "Failed to get online users" });
  }
});

// 创建用户
app.post("/api/admin/users", requireAdmin, (req, res) => {
  try {
    const {
      username,
      displayName,
      email,
      password,
      isActive = false,
      isSuperAdmin = false,
      showApiConfig = false,
      freeLimitEnabled = true,
      freeLimit = 30,
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
      displayName: displayName ? String(displayName).trim() : String(username).trim(),
      email: normalizedEmail,
      password: hashPassword(password),
      apiKeyEncrypted: "",
      isActive: Boolean(isActive),
      isSuperAdmin: Boolean(isSuperAdmin),
      showApiConfig: Boolean(showApiConfig),
      freeLimitEnabled: Boolean(freeLimitEnabled),
      freeLimit: Number.isFinite(freeLimit) && freeLimit > 0 ? Math.floor(freeLimit) : 30,
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
    const { username, displayName, email, isActive, isSuperAdmin, apiKey, showApiConfig, freeLimitEnabled, freeLimit } =
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
    if (typeof displayName !== "undefined")
      target.displayName = String(displayName).trim() || target.username;
    if (typeof isActive !== "undefined") target.isActive = Boolean(isActive);
    if (typeof isSuperAdmin !== "undefined")
      target.isSuperAdmin = Boolean(isSuperAdmin);
    if (typeof showApiConfig !== "undefined")
      target.showApiConfig = Boolean(showApiConfig);
    if (typeof freeLimitEnabled !== 'undefined')
      target.freeLimitEnabled = Boolean(freeLimitEnabled);
    if (typeof freeLimit !== 'undefined') {
      const lim = Number(freeLimit);
      if (Number.isFinite(lim) && lim > 0) target.freeLimit = Math.floor(lim);
    }
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
    
    // 🔑 超级管理员更新API Key时，批量更新所有使用相同旧Key的用户
    if (target.isSuperAdmin && typeof apiKey === "string" && apiKey.trim()) {
      const oldEncryptedKey = target.apiKeyEncrypted;
      const oldPlainKey = oldEncryptedKey ? decryptSensitiveValue(oldEncryptedKey) : "";
      const newEncryptedKey = encryptSensitiveValue(apiKey);
      
      if (oldPlainKey) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`🔄 超级管理员更新API Key，开始批量同步...`);
        console.log(`${"=".repeat(60)}\n`);
        
        let updatedCount = 0;
        users.forEach((user) => {
          if (user.id === target.id) {
            // 跳过自己，稍后单独更新
            return;
          }
          
          if (user.apiKeyEncrypted) {
            try {
              const userPlainKey = decryptSensitiveValue(user.apiKeyEncrypted);
              // 如果用户的Key与管理员旧Key相同，则更新
              if (userPlainKey === oldPlainKey) {
                user.apiKeyEncrypted = newEncryptedKey;
                delete user.apiKey;
                updatedCount++;
                console.log(`  ✅ 已更新用户: ${user.username} (${user.id})`);
              }
            } catch (decryptError) {
              console.warn(`  ⚠️ 跳过用户 ${user.username} (${user.id}): 解密失败`);
            }
          }
        });
        
        console.log(`\n${"=".repeat(60)}`);
        console.log(`✨ 批量同步完成！共更新 ${updatedCount} 个用户的API Key`);
        console.log(`${"=".repeat(60)}\n`);
        
        // 更新超级管理员自己的Key
        target.apiKeyEncrypted = newEncryptedKey;
        delete target.apiKey;
        req.session.user = toSessionUser(target);
        saveUsers();
        
        return res.json({ 
          success: true, 
          apiKeySet: true,
          batchUpdated: true,
          updatedUsersCount: updatedCount,
          message: `已更新您和其他 ${updatedCount} 个使用相同Key的用户`
        });
      }
    }
    
    // 普通用户或管理员首次设置Key
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

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatMonthKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

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
    deleted: 0, // 已删除的图片数量
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

  // 统计所有记录，包括已删除的（因为生成过就产生了成本）
  for (const item of history) {
    const createdAt = safeParseDate(item?.createdAt);
    if (!createdAt) continue;

    const dayKey = formatDateKey(createdAt);
    const monthKeyItem = formatMonthKey(createdAt);

    // 所有记录都计入统计（包括已删除）
    totals.total += 1;
    dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
    monthlyMap.set(monthKeyItem, (monthlyMap.get(monthKeyItem) || 0) + 1);
    
    // 调试日志：记录月度key
    console.log(`🔍 历史记录 [${item.id || 'unknown'}]: 日期=${createdAt.toISOString()} | 月度Key=${monthKeyItem}`);

    if (dayKey === todayKey) {
      totals.today += 1;
    }
    if (monthKeyItem === monthKey) {
      totals.thisMonth += 1;
    }

    // 统计已删除的数量
    if (item.deleted === true) {
      totals.deleted += 1;
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
    const count = monthlyMap.get(key) || 0;
    monthly.push({
      month: key,
      label: `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`,
      count: count,
    });
    // 调试日志：月度统计
    if (count > 0) {
      console.log(`📊 月度统计 [${key}]: ${count} 张 | 标签: ${monthly[monthly.length - 1].label}`);
    }
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

async function buildUserStatsPayload(user, startDate, endDate) {
  let history = await loadUserHistory(user.id);
  
  // 如果指定了日期范围，过滤历史记录
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // 包含结束日期的全天
    
    history = history.filter(item => {
      if (!item.createdAt) return false;
      const itemDate = new Date(item.createdAt);
      return itemDate >= start && itemDate <= end;
    });
  }
  
  const stats = computeStatsFromHistory(history);
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

async function buildSummaryStats(startDate, endDate) {
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
    dateRange: startDate && endDate ? { startDate, endDate } : null,
  };

  for (const user of users) {
    const userStats = await buildUserStatsPayload(user, startDate, endDate);
    summary.totals.today += userStats.totals.today;
    summary.totals.thisMonth += userStats.totals.thisMonth;
    summary.totals.total += userStats.totals.total;
    if (userStats.totals.total > 0) {
      summary.users.activeWithGenerations += 1;
    }
    // 计算剩余额度
    const isSuperAdmin = Boolean(user.isSuperAdmin);
    const limitEnabled = !isSuperAdmin && (typeof user.freeLimitEnabled === 'boolean' ? user.freeLimitEnabled : true);
    const limit = (Number.isFinite(user.freeLimit) && user.freeLimit > 0) ? Math.floor(user.freeLimit) : 30;
    const remaining = limitEnabled ? Math.max(0, limit - userStats.totals.total) : null;
    
    summary.perUser.push({
      ...userStats.user,
      displayName: user.displayName || user.username,  // 添加显示名
      totals: userStats.totals,
      lastGeneratedAt: userStats.lastGeneratedAt,
      historyCount: userStats.historyCount,
      // 额度信息
      limitEnabled: limitEnabled,
      limit: limitEnabled ? limit : null,
      remaining: remaining,
      unlimited: !limitEnabled || isSuperAdmin
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
    const statsResult = await updateUserStats(userId, historyData);
    
    console.log("=".repeat(60));
    const user = users.find(u => u.id === userId);
    const limitEnabled = typeof user?.freeLimitEnabled === 'boolean' ? user.freeLimitEnabled : true;
    const limit = (Number.isFinite(user?.freeLimit) && user.freeLimit > 0) ? Math.floor(user.freeLimit) : 30;
    res.json({ 
      message: "History saved successfully",
      recordCount: historyData.length,
      apiKeyCleared: statsResult?.apiKeyCleared || false,
      reachedLimit: limitEnabled && historyData.length >= limit,
      limitEnabled,
      limit
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

// 管理员恢复用户的已删除图片
app.post("/api/admin/history/:userId/:historyId/restore", requireAdmin, async (req, res) => {
  try {
    const { userId, historyId } = req.params;
    const filePath = path.join(HISTORY_DIR, `history-${userId}.json`);
    
    console.log(`🔄 管理员恢复用户 ${userId} 的图片 ${historyId}`);
    
    let history = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      history = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: '用户历史记录不存在' });
      }
      throw error;
    }
    
    const item = history.find(h => h.id === historyId);
    if (!item) {
      return res.status(404).json({ error: '历史记录不存在' });
    }
    
    if (!item.deleted) {
      return res.status(400).json({ error: '该记录未被删除' });
    }
    
    // 如果是归档的图片，需要从归档目录移回来
    if (item.archived && item.archivedPath) {
      try {
        const archivedFilePath = path.join(__dirname, item.archivedPath);
        
        // 检查归档文件是否存在
        try {
          await fs.access(archivedFilePath);
        } catch {
          console.warn(`⚠️ 归档文件不存在: ${archivedFilePath}`);
          return res.status(404).json({ error: '归档文件不存在，无法恢复' });
        }
        
        // 恢复文件到原位置
        const originalFileName = path.basename(item.archivedPath).split('_').slice(1).join('_'); // 去掉时间戳前缀
        const restorePath = path.join(__dirname, 'public', 'images', originalFileName);
        
        await fs.copyFile(archivedFilePath, restorePath);
        
        // 更新记录
        item.imageUrl = `/images/${originalFileName}`;
        item.archived = false;
        item.archivedPath = null;
        
        console.log(`📦 已从归档恢复文件: ${archivedFilePath} -> ${restorePath}`);
      } catch (restoreError) {
        console.error('❌ 从归档恢复文件失败:', restoreError);
        return res.status(500).json({ error: '从归档恢复文件失败: ' + restoreError.message });
      }
    } else if (item.archived && !item.archivedPath) {
      // 旧数据：标记为归档但没有归档路径
      console.warn(`⚠️ 图片 ${historyId} 标记为归档但缺少归档路径`);
      return res.status(400).json({ error: '此图片在归档功能实现前被删除，缺少归档路径，无法恢复' });
    }
    
    // 恢复记录
    item.deleted = false;
    item.restoredAt = new Date().toISOString();
    item.restoredBy = req.session.user.id;
    
    await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf8');
    console.log(`✅ 成功恢复用户 ${userId} 的图片 ${historyId}`);
    
    res.json({ success: true, message: '图片已恢复' });
  } catch (error) {
    console.error('❌ 恢复图片失败:', error);
    res.status(500).json({ error: '恢复图片失败' });
  }
});

// 管理员删除用户的图片（标记删除或归档文件）
app.delete("/api/admin/history/:userId/:historyId", requireAdmin, async (req, res) => {
  try {
    const { userId, historyId } = req.params;
    const { archiveFile } = req.query; // archiveFile=true 表示归档图片文件
    const filePath = path.join(HISTORY_DIR, `history-${userId}.json`);
    
    console.log(`🗑️ 管理员${archiveFile === 'true' ? '归档图片文件' : '标记删除'}用户 ${userId} 的图片 ${historyId}`);
    
    let history = [];
    try {
      const data = await fs.readFile(filePath, 'utf8');
      history = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: '用户历史记录不存在' });
      }
      throw error;
    }
    
    const itemIndex = history.findIndex(h => h.id === historyId);
    if (itemIndex === -1) {
      return res.status(404).json({ error: '历史记录不存在' });
    }
    
    const item = history[itemIndex];
    
    if (archiveFile === 'true') {
      // 归档图片文件到隐藏目录，但保留历史记录（用于统计和取证）
      if (item.imageUrl) {
        try {
          const imagePath = path.join(__dirname, 'public', item.imageUrl);
          
          // 创建归档目录（隐藏目录，不对外访问）
          const archiveDir = path.join(__dirname, 'data', 'archived-images', userId);
          await fs.mkdir(archiveDir, { recursive: true });
          
          // 归档文件名包含时间戳和原因
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const fileName = path.basename(item.imageUrl);
          const archivePath = path.join(archiveDir, `${timestamp}_${fileName}`);
          
          // 移动文件到归档目录（而不是删除）
          try {
            await fs.rename(imagePath, archivePath);
            console.log(`📦 已归档图片文件: ${imagePath} -> ${archivePath}`);
          } catch (renameError) {
            // 如果 rename 失败（可能跨文件系统），则复制后删除
            await fs.copyFile(imagePath, archivePath);
            await fs.unlink(imagePath);
            console.log(`📦 已复制并归档图片文件: ${imagePath} -> ${archivePath}`);
          }
          
          // 记录归档路径（用于后续取证）
          item.archivedPath = path.relative(__dirname, archivePath);
          
        } catch (archiveError) {
          if (archiveError.code !== 'ENOENT') {
            console.error(`⚠️ 归档图片文件失败: ${archiveError.message}`);
            throw new Error('归档文件失败: ' + archiveError.message);
          }
        }
      }
      
      // 标记为已归档
      item.deleted = true;
      item.archived = true; // 新增：标记文件已归档
      item.deletedAt = new Date().toISOString();
      item.deletedBy = req.session.user.id;
      item.imageUrl = null; // 清空公开访问的图片URL
      
      console.log(`✅ 已归档图片文件并标记记录 ${historyId}`);
    } else {
      // 仅标记删除（逻辑删除）
      item.deleted = true;
      item.deletedAt = new Date().toISOString();
      item.deletedBy = req.session.user.id;
      console.log(`✅ 已标记删除图片 ${historyId}`);
    }
    
    await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf8');
    
    res.json({ 
      success: true, 
      message: archiveFile === 'true' ? '图片已归档（记录保留，文件备份用于取证）' : '图片已标记删除' 
    });
  } catch (error) {
    console.error('❌ 删除图片失败:', error);
    res.status(500).json({ error: '删除图片失败' });
  }
});

// 管理员查看归档图片（需要权限）
app.get("/api/admin/archived-image/:userId/:filename", requireAdmin, async (req, res) => {
  try {
    const { userId, filename } = req.params;
    
    // 安全检查：防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: '非法文件名' });
    }
    
    const archiveDir = path.join(__dirname, 'data', 'archived-images', userId);
    const filePath = path.join(archiveDir, filename);
    
    // 确保文件在归档目录内
    if (!filePath.startsWith(archiveDir)) {
      return res.status(403).json({ error: '访问被拒绝' });
    }
    
    console.log(`👁️ 管理员 ${req.session.user.username} 查看归档图片: ${filePath}`);
    
    try {
      await fs.access(filePath);
      res.sendFile(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ error: '归档文件不存在' });
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ 查看归档图片失败:', error);
    res.status(500).json({ error: '查看归档图片失败' });
  }
});

// 管理员修复旧数据：清理错误的archived标记
app.post("/api/admin/fix-archived-data", requireAdmin, async (req, res) => {
  try {
    console.log(`🔧 开始修复旧的归档数据...`);
    
    let fixedCount = 0;
    const historyFiles = await fs.readdir(HISTORY_DIR);
    
    for (const fileName of historyFiles) {
      if (!fileName.startsWith('history-') || !fileName.endsWith('.json')) continue;
      
      const filePath = path.join(HISTORY_DIR, fileName);
      try {
        const data = await fs.readFile(filePath, 'utf8');
        let history = JSON.parse(data);
        let changed = false;
        
        for (const item of history) {
          // 如果标记为archived但没有archivedPath，说明是旧数据，需要修复
          if (item.archived && !item.archivedPath) {
            console.log(`  🔧 修复 ${fileName} 中的记录 ${item.id}`);
            item.archived = false; // 改回普通删除状态
            changed = true;
            fixedCount++;
          }
        }
        
        if (changed) {
          await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf8');
          console.log(`  ✅ 已更新 ${fileName}`);
        }
      } catch (error) {
        console.error(`  ❌ 处理 ${fileName} 失败:`, error);
      }
    }
    
    console.log(`✅ 数据修复完成！共修复 ${fixedCount} 条记录`);
    res.json({ success: true, fixedCount, message: `已修复 ${fixedCount} 条旧数据` });
  } catch (error) {
    console.error('❌ 修复数据失败:', error);
    res.status(500).json({ error: '修复数据失败' });
  }
});

// 统计 API
app.get("/api/stats", requireAuth, async (req, res) => {
  try {
    const { user: sessionUser } = req.session;
    const { scope = "self", userId, startDate, endDate } = req.query;

    if (scope === "summary") {
      if (!sessionUser.isSuperAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const summary = await buildSummaryStats(startDate, endDate);
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
  const startTime = Date.now();
  const timestamp = formatLogTime();
  const user = req.session.user;
  const userId = user?.id || 'unknown';
  const username = user?.username || 'unknown';
  
  try {
    const { requestBody, apiKey } = req.body;
    
    // 确定要使用的 API Key
    // 优先使用前端传来的 apiKey（用户自己配置的情况）
    // 如果前端没有 apiKey，则从用户的 session 中获取（管理员配置的情况）
    let effectiveApiKey = apiKey;
    
    if (!effectiveApiKey) {
      // 尝试从数据库获取用户的实际 API Key
      const dbUser = users.find(u => u.id === userId);
      console.log(`[${timestamp}] 🔍 调试信息 | 用户: ${username}(${userId})`);
      console.log(`  - isSuperAdmin: ${dbUser?.isSuperAdmin}`);
      console.log(`  - hasApiKeyEncrypted: ${!!dbUser?.apiKeyEncrypted}`);
      console.log(`  - apiKeyEncrypted前16字符: ${dbUser?.apiKeyEncrypted?.substring(0, 16) || 'null'}`);
      
      if (dbUser && (dbUser.apiKeyEncrypted || dbUser.apiKey)) {
        try {
          effectiveApiKey = decryptSensitiveValue(dbUser.apiKeyEncrypted || dbUser.apiKey || "");
          console.log(`[${timestamp}] 📝 使用管理员配置的 API Key | 用户: ${username}(${userId})`);
          console.log(`  - 解密成功: ${!!effectiveApiKey}`);
          console.log(`  - API Key长度: ${effectiveApiKey?.length || 0}`);
          // 🔒 安全：不再显示API Key的任何部分，防止泄露
        } catch (decryptError) {
          console.error(`[${timestamp}] ❌ API Key解密失败 | 用户: ${username}(${userId})`, decryptError);
          return res.status(500).json({ error: "API密钥解密失败，请联系管理员重新配置" });
        }
      }
    }
    
    if (!effectiveApiKey) {
      console.log(`[${timestamp}] ❌ API代理请求失败 | 用户: ${username}(${userId}) | 原因: API密钥为空`);
      return res.status(400).json({ error: "API 密钥不能为空" });
    }
    
    if (!requestBody) {
      console.log(`[${timestamp}] ❌ API代理请求失败 | 用户: ${username}(${userId}) | 原因: 请求体为空`);
      return res.status(400).json({ error: "请求体不能为空" });
    }
    
    // 将前端传来的服务器图片引用转换为 inlineData，避免前端下载图片浪费带宽
    // 允许的字段：part.serverImagePath 或 part.imageUrl（以 /images/ 开头）
    try {
      const contents = Array.isArray(requestBody.contents) ? requestBody.contents : [];
      for (const content of contents) {
        const parts = Array.isArray(content.parts) ? content.parts : [];
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          const refPath = part?.serverImagePath || part?.imageUrl;
          if (typeof refPath === 'string' && refPath.startsWith('/images/')) {
            const rel = refPath.replace(/^\/images\//, '');
            const abs = path.join(IMAGES_DIR, rel);
            const normalized = path.normalize(abs);
            if (!normalized.startsWith(IMAGES_DIR)) {
              throw new Error('非法图片路径');
            }
            let mime = 'image/png';
            const ext = path.extname(normalized).toLowerCase();
            if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
            else if (ext === '.png') mime = 'image/png';
            else if (ext === '.webp') mime = 'image/webp';
            else if (ext === '.gif') mime = 'image/gif';
            const buf = await fs.readFile(normalized);
            const b64 = buf.toString('base64');
            parts[i] = {
              inlineData: {
                mimeType: mime,
                data: b64,
              }
            };
          }
        }
      }
    } catch (e) {
      console.error(`[${timestamp}] ❌ 处理服务器图片引用失败 | 用户: ${username}(${userId}) | 错误: ${e.message}`);
      return res.status(400).json({ error: '无法处理服务器图片引用', details: e.message });
    }
    
    // 提取请求模式（文本生图/图像编辑/图像合成）
    const hasImages = requestBody.contents?.[0]?.parts?.some(part => part.inlineData);
    const imageCount = requestBody.contents?.[0]?.parts?.filter(part => part.inlineData).length || 0;
    const mode = !hasImages ? '文本生图' : imageCount === 1 ? '图像编辑' : '图像合成';
    
    console.log(`[${timestamp}] 🌐 开始代理 Google Gemini API | 用户: ${username}(${userId}) | 模式: ${mode} | 图片数: ${imageCount}`);
    
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
          "x-goog-api-key": effectiveApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    const data = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (!response.ok) {
      console.error(`[${timestamp}] ❌ Google API返回错误 | 用户: ${username}(${userId}) | 状态码: ${response.status} | 耗时: ${duration}s`);
      return res.status(response.status).json(data);
    }
    
    console.log(`[${timestamp}] ✅ API代理成功 | 用户: ${username}(${userId}) | 模式: ${mode} | 耗时: ${duration}s`);
    res.json(data);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[${timestamp}] ❌ API代理异常 | 用户: ${username}(${userId}) | 错误: ${error.message} | 耗时: ${duration}s`);
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
    version: require('./package.json').version,
  });
});

// 所有其他路由返回React应用
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// 启动服务器
async function startServer() {
  await initLogSystem(); // 初始化日志系统
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
