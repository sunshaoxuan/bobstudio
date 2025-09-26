import EMAIL_CONFIG from '../config/email';

// 邮件发送状态跟踪
const emailStats = {
  sent: 0,
  failed: 0,
  lastReset: Date.now()
};

// 邮件模板
const emailTemplates = {
  activation: (username, activationLink) => ({
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #8B5CF6, #3B82F6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; background: linear-gradient(135deg, #8B5CF6, #3B82F6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎨 BOB Studio</h1>
                  <p>欢迎加入我们的创作平台！</p>
              </div>
              <div class="content">
                  <h2>你好，${username}！</h2>
                  <p>感谢您注册BOB Studio账户。请点击下面的按钮激活您的账户：</p>
                  <div style="text-align: center;">
                      <a href="${activationLink}" class="button">激活我的账户</a>
                  </div>
                  <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
                  <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">${activationLink}</p>
                  <p><strong>注意：</strong>此链接24小时内有效，请尽快完成激活。</p>
                  <p>如果您没有注册BOB Studio账户，请忽略此邮件。</p>
              </div>
              <div class="footer">
                  <p>© 2024 BOB Studio. 专业AI图像生成与编辑工具.</p>
              </div>
          </div>
      </body>
      </html>
    `,
    text: `
欢迎使用BOB Studio！

你好，${username}！

感谢您注册BOB Studio账户。请访问以下链接激活您的账户：
${activationLink}

注意：此链接24小时内有效，请尽快完成激活。

如果您没有注册BOB Studio账户，请忽略此邮件。

© 2024 BOB Studio
    `
  }),

  passwordReset: (username, resetLink) => ({
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #8B5CF6, #3B82F6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { display: inline-block; background: linear-gradient(135deg, #8B5CF6, #3B82F6); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
              .warning { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 5px; margin: 15px 0; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🎨 BOB Studio</h1>
                  <p>密码重置请求</p>
              </div>
              <div class="content">
                  <h2>你好，${username}！</h2>
                  <p>我们收到了您的密码重置请求。点击下面的按钮重置您的密码：</p>
                  <div style="text-align: center;">
                      <a href="${resetLink}" class="button">重置我的密码</a>
                  </div>
                  <p>如果按钮无法点击，请复制以下链接到浏览器地址栏：</p>
                  <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 5px;">${resetLink}</p>
                  <div class="warning">
                      <strong>⚠️ 安全提醒：</strong>
                      <ul>
                          <li>此链接1小时内有效</li>
                          <li>如果您没有请求重置密码，请忽略此邮件</li>
                          <li>请勿将此链接分享给他人</li>
                      </ul>
                  </div>
              </div>
              <div class="footer">
                  <p>© 2024 BOB Studio. 专业AI图像生成与编辑工具.</p>
              </div>
          </div>
      </body>
      </html>
    `,
    text: `
BOB Studio - 密码重置请求

你好，${username}！

我们收到了您的密码重置请求。请访问以下链接重置您的密码：
${resetLink}

安全提醒：
- 此链接1小时内有效
- 如果您没有请求重置密码，请忽略此邮件
- 请勿将此链接分享给他人

© 2024 BOB Studio
    `
  }),

  adminNotification: (username, message, type = 'info') => ({
    html: `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="utf-8">
          <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #8B5CF6, #3B82F6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .notification { padding: 15px; border-radius: 5px; margin: 15px 0; }
              .info { background: #dbeafe; border: 1px solid #93c5fd; }
              .success { background: #dcfce7; border: 1px solid #86efac; }
              .warning { background: #fef3c7; border: 1px solid #fcd34d; }
              .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="header">
                  <h1>🛡️ BOB Studio 管理通知</h1>
              </div>
              <div class="content">
                  <h2>你好，${username}！</h2>
                  <div class="notification ${type}">
                      ${message}
                  </div>
                  <p>此邮件由BOB Studio管理员发送。如有疑问，请联系管理员。</p>
              </div>
              <div class="footer">
                  <p>© 2024 BOB Studio. 专业AI图像生成与编辑工具.</p>
              </div>
          </div>
      </body>
      </html>
    `,
    text: `
BOB Studio - 管理通知

你好，${username}！

${message}

此邮件由BOB Studio管理员发送。如有疑问，请联系管理员。

© 2024 BOB Studio
    `
  })
};

// 检查发送限制
const checkRateLimit = () => {
  const now = Date.now();
  const timeDiff = now - emailStats.lastReset;
  
  // 如果超过1小时，重置计数
  if (timeDiff > EMAIL_CONFIG.options.rateLimit.windowMs) {
    emailStats.sent = 0;
    emailStats.failed = 0;
    emailStats.lastReset = now;
  }
  
  return emailStats.sent < EMAIL_CONFIG.options.rateLimit.maxEmails;
};

// 模拟SMTP发送（在真实环境中会使用nodemailer等库）
const sendViaSMTP = async (mailOptions) => {
  // 这里模拟SMTP发送过程
  // 在真实的Node.js后端环境中，您会使用如下代码：
  /*
  const nodemailer = require('nodemailer');
  
  const config = EMAIL_CONFIG.providers[EMAIL_CONFIG.currentProvider];
  const transporter = nodemailer.createTransporter(config);
  
  return await transporter.sendMail(mailOptions);
  */
  
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 模拟网络延迟
      const success = Math.random() > 0.1; // 90%成功率
      
      if (success) {
        console.log('📧 SMTP邮件发送成功:', {
          to: mailOptions.to,
          subject: mailOptions.subject,
          provider: EMAIL_CONFIG.currentProvider,
          timestamp: new Date().toISOString()
        });
        resolve({
          messageId: `mock-${Date.now()}@${EMAIL_CONFIG.currentProvider}`,
          response: '250 Message accepted'
        });
      } else {
        reject(new Error('SMTP发送失败：连接超时'));
      }
    }, 1000 + Math.random() * 2000); // 1-3秒随机延迟
  });
};

// 主邮件发送函数
export const sendEmail = async (to, subject, templateName, templateData = {}) => {
  try {
    // 检查是否启用邮件发送
    if (!EMAIL_CONFIG.options.enabled) {
      console.log('📧 邮件发送已禁用，使用控制台输出:', {
        to,
        subject,
        template: templateName,
        data: templateData
      });
      return { success: true, mode: 'console' };
    }

    // 检查发送限制
    if (!checkRateLimit()) {
      throw new Error(`发送限制：每小时最多发送${EMAIL_CONFIG.options.rateLimit.maxEmails}封邮件`);
    }

    // 生成邮件内容
    const template = emailTemplates[templateName];
    if (!template) {
      throw new Error(`未找到邮件模板: ${templateName}`);
    }

    const emailContent = template(...Object.values(templateData));
    
    // 准备邮件选项
    const mailOptions = {
      from: `"${EMAIL_CONFIG.from.name}" <${EMAIL_CONFIG.from.email}>`,
      to: to,
      subject: subject,
      html: emailContent.html,
      text: emailContent.text
    };

    // 重试发送
    let lastError;
    for (let attempt = 1; attempt <= EMAIL_CONFIG.options.retry.attempts; attempt++) {
      try {
        const result = await sendViaSMTP(mailOptions);
        emailStats.sent++;
        
        return {
          success: true,
          messageId: result.messageId,
          response: result.response,
          attempt: attempt,
          provider: EMAIL_CONFIG.currentProvider
        };
      } catch (error) {
        lastError = error;
        console.warn(`📧 邮件发送失败 (尝试 ${attempt}/${EMAIL_CONFIG.options.retry.attempts}):`, error.message);
        
        if (attempt < EMAIL_CONFIG.options.retry.attempts) {
          await new Promise(resolve => setTimeout(resolve, EMAIL_CONFIG.options.retry.delay));
        }
      }
    }

    // 所有重试都失败
    emailStats.failed++;
    throw lastError;

  } catch (error) {
    console.error('📧 邮件发送服务错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 发送激活邮件
export const sendActivationEmail = async (email, username, activationToken) => {
  const activationLink = `${window.location.origin}/activate/${activationToken}`;
  return await sendEmail(
    email,
    EMAIL_CONFIG.templates.activation.subject,
    'activation',
    { username, activationLink }
  );
};

// 发送密码重置邮件
export const sendPasswordResetEmail = async (email, username, resetToken) => {
  const resetLink = `${window.location.origin}/reset-password/${resetToken}`;
  return await sendEmail(
    email,
    EMAIL_CONFIG.templates.passwordReset.subject,
    'passwordReset',
    { username, resetLink }
  );
};

// 发送管理员通知邮件
export const sendAdminNotificationEmail = async (email, username, message, type = 'info') => {
  return await sendEmail(
    email,
    EMAIL_CONFIG.templates.adminNotification.subject,
    'adminNotification',
    { username, message, type }
  );
};

// 获取邮件发送统计
export const getEmailStats = () => ({
  ...emailStats,
  rateLimit: EMAIL_CONFIG.options.rateLimit,
  currentProvider: EMAIL_CONFIG.currentProvider,
  enabled: EMAIL_CONFIG.options.enabled
});

// 测试邮件配置
export const testEmailConfig = async (testEmail) => {
  return await sendEmail(
    testEmail,
    'BOB Studio - 邮件配置测试',
    'adminNotification',
    {
      username: '测试用户',
      message: '这是一封测试邮件，用于验证邮件服务配置是否正确。如果您收到此邮件，说明配置成功！',
      type: 'success'
    }
  );
};