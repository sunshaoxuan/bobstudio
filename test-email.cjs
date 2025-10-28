// 邮件发送测试脚本
const nodemailer = require('nodemailer');

const EMAIL_CONFIG = {
  host: 'mail.briconbric.com',
  port: 587,
  secure: false,
  auth: {
    user: 'postmaster@briconbric.com',
    pass: 'BtZhY1^3'
  },
  tls: {
    rejectUnauthorized: false
  }
};

const SITE_URL = 'https://studio.briconbric.com';
const testToken = 'test-activation-token-' + Date.now();

async function testEmail() {
  console.log('🔧 正在配置邮件服务...');
  console.log('SMTP服务器:', EMAIL_CONFIG.host + ':' + EMAIL_CONFIG.port);
  console.log('发件账户:', EMAIL_CONFIG.auth.user);
  
  try {
    const transporter = nodemailer.createTransport(EMAIL_CONFIG);
    
    console.log('\n🔍 测试SMTP连接...');
    await transporter.verify();
    console.log('✅ SMTP连接成功！\n');
    
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

