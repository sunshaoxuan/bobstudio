// 邮件服务配置文件
const EMAIL_CONFIG = {
  // 邮件服务提供商配置
  providers: {
    // Gmail SMTP配置
    gmail: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: import.meta.env.VITE_EMAIL_USER || '', // Gmail邮箱
        pass: import.meta.env.VITE_EMAIL_PASS || ''  // Gmail应用密码
      },
      tls: {
        rejectUnauthorized: false
      }
    },

    // Outlook/Hotmail SMTP配置
    outlook: {
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      auth: {
        user: import.meta.env.VITE_EMAIL_USER || '',
        pass: import.meta.env.VITE_EMAIL_PASS || ''
      },
      tls: {
        rejectUnauthorized: false
      }
    },

    // QQ邮箱 SMTP配置
    qq: {
      host: 'smtp.qq.com',
      port: 587,
      secure: false,
      auth: {
        user: import.meta.env.VITE_EMAIL_USER || '',
        pass: import.meta.env.VITE_EMAIL_PASS || '' // QQ邮箱授权码
      }
    },

    // 163邮箱 SMTP配置
    netease163: {
      host: 'smtp.163.com',
      port: 587,
      secure: false,
      auth: {
        user: import.meta.env.VITE_EMAIL_USER || '',
        pass: import.meta.env.VITE_EMAIL_PASS || '' // 163邮箱授权码
      }
    },

    // 企业邮箱或自定义SMTP配置
    custom: {
      host: import.meta.env.VITE_SMTP_HOST || 'smtp.example.com',
      port: parseInt(import.meta.env.VITE_SMTP_PORT || '587'),
      secure: import.meta.env.VITE_SMTP_SECURE === 'true', // 是否使用SSL
      auth: {
        user: import.meta.env.VITE_EMAIL_USER || '',
        pass: import.meta.env.VITE_EMAIL_PASS || ''
      },
      tls: {
        rejectUnauthorized: import.meta.env.VITE_SMTP_TLS_REJECT === 'true'
      }
    }
  },

  // 当前使用的邮件服务提供商
  currentProvider: import.meta.env.VITE_EMAIL_PROVIDER || 'gmail',

  // 发件人信息
  from: {
    name: import.meta.env.VITE_EMAIL_FROM_NAME || 'BOB Studio',
    email: import.meta.env.VITE_EMAIL_FROM || import.meta.env.VITE_EMAIL_USER || ''
  },

  // 邮件模板配置
  templates: {
    activation: {
      subject: 'BOB Studio - 激活您的账户',
      template: 'activation'
    },
    passwordReset: {
      subject: 'BOB Studio - 重置您的密码',
      template: 'password-reset'
    },
    adminNotification: {
      subject: 'BOB Studio - 管理员通知',
      template: 'admin-notification'
    }
  },

  // 邮件发送选项
  options: {
    // 是否启用邮件发送（开发环境可设为false使用控制台输出）
    enabled: import.meta.env.VITE_EMAIL_ENABLED === 'true' || import.meta.env.PROD,
    
    // 重试配置
    retry: {
      attempts: parseInt(import.meta.env.VITE_EMAIL_RETRY_ATTEMPTS || '3'),
      delay: parseInt(import.meta.env.VITE_EMAIL_RETRY_DELAY || '1000') // 毫秒
    },

    // 发送限制
    rateLimit: {
      maxEmails: parseInt(import.meta.env.VITE_EMAIL_RATE_LIMIT || '100'), // 每小时最大发送数
      windowMs: 60 * 60 * 1000 // 1小时窗口
    }
  }
};

export default EMAIL_CONFIG;