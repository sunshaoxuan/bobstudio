// 邮件发送测试脚本
const nodemailer = require('nodemailer');

// 尝试多个配置
const CONFIGS = [
  {
    name: 'SSL/TLS (465) - 推荐',
    host: 'mail.briconbric.com',
    port: 465,
    secure: true,
    auth: {
      user: 'postmaster@briconbric.com',
      pass: 'BtZhY1^3'
    },
    connectionTimeout: 30000, // 30秒超时
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1'
    }
  },
  {
    name: 'STARTTLS (587)',
    host: 'mail.briconbric.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: 'postmaster@briconbric.com',
      pass: 'BtZhY1^3'
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: {
      rejectUnauthorized: false,
      minVersion: 'TLSv1'
    }
  },
  {
    name: 'SSL (465) - 直接IP',
    host: '104.21.58.143',
    port: 465,
    secure: true,
    auth: {
      user: 'postmaster@briconbric.com',
      pass: 'BtZhY1^3'
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    tls: {
      rejectUnauthorized: false,
      servername: 'mail.briconbric.com',
      minVersion: 'TLSv1'
    }
  }
];

const EMAIL_CONFIG = CONFIGS[0];

const SITE_URL = 'https://studio.briconbric.com';
const testToken = 'test-activation-token-' + Date.now();

async function testEmail() {
  console.log('🔧 开始测试邮件发送功能...\n');
  
  let workingConfig = null;
  
  // 尝试所有配置
  for (const config of CONFIGS) {
    console.log(`🔍 测试配置: ${config.name}`);
    console.log(`   服务器: ${config.host}:${config.port}`);
    console.log(`   账户: ${config.auth.user}`);
    
    try {
      const transporter = nodemailer.createTransport(config);
      await transporter.verify();
      console.log(`   ✅ 连接成功！\n`);
      workingConfig = config;
      break;
    } catch (error) {
      console.log(`   ❌ 连接失败: ${error.message}\n`);
    }
  }
  
  if (!workingConfig) {
    console.error('❌ 所有配置都失败了！');
    console.error('\n可能的原因：');
    console.error('1. 本地网络限制了 SMTP 端口');
    console.error('2. 需要VPN或代理');
    console.error('3. 邮件服务器限制来源IP');
    console.error('\n💡 建议：在服务器上测试（服务器通常可以访问SMTP）');
    process.exit(1);
  }
  
  try {
    const transporter = nodemailer.createTransport(workingConfig);
    console.log(`📧 使用配置: ${workingConfig.name}`);
    
    const activationLink = `${SITE_URL}/activate/${testToken}`;
    
    const mailOptions = {
      from: 'BOB Studio <postmaster@briconbric.com>',
      to: 'sunsx@outlook.com',
      subject: '【测试】激活您的 BOB Studio 账户',
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
              <p>您好，</p>
              <p>这是一封<strong>测试邮件</strong>，用于验证邮件发送功能是否正常。</p>
              <p>请点击下面的按钮测试激活链接：</p>
              <p style="text-align: center;">
                <a href="${activationLink}" class="button">测试激活按钮</a>
              </p>
              <p>或复制以下链接到浏览器打开：</p>
              <p style="background: #fff; padding: 10px; border-radius: 5px; word-break: break-all; font-family: monospace; font-size: 12px;">
                ${activationLink}
              </p>
              <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
              <p style="color: #666; font-size: 14px;">
                <strong>测试信息：</strong><br>
                发送时间: ${new Date().toLocaleString('zh-CN')}<br>
                测试令牌: ${testToken}
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
    
    console.log('📧 正在发送测试邮件到: sunsx@outlook.com');
    const info = await transporter.sendMail(mailOptions);
    
    console.log('\n✅ 邮件发送成功！');
    console.log('📨 MessageID:', info.messageId);
    console.log('📬 收件人:', info.accepted);
    if (info.rejected && info.rejected.length > 0) {
      console.log('❌ 被拒绝:', info.rejected);
    }
    console.log('\n💡 请检查邮箱: sunsx@outlook.com');
    console.log('💡 如果收件箱没有，请检查垃圾邮件文件夹');
    
  } catch (error) {
    console.error('\n❌ 邮件发送失败！');
    console.error('错误类型:', error.name);
    console.error('错误消息:', error.message);
    if (error.code) {
      console.error('错误代码:', error.code);
    }
    if (error.response) {
      console.error('服务器响应:', error.response);
    }
    process.exit(1);
  }
}

testEmail();

