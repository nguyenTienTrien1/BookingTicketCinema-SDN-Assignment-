import nodemailer from 'nodemailer';

let testAccount = null;

/**
 * Create or reuse nodemailer transport
 */
async function getTransporter() {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const rawPass = (process.env.GMAIL_APP_PASS || process.env.SMTP_PASS || '').trim();
  const pass = rawPass.replace(/\s+/g, ''); // Tự động loại bỏ khoảng trắng trong mã App Password

  // 1. If Gmail service is detected (Tự động nhận diện Gmail để gửi thư vào hộp thư thật)
  if (user && pass && (user.toLowerCase().includes('@gmail.com') || host.toLowerCase().includes('gmail'))) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass
      }
    });
  }

  // 2. If standard custom SMTP credentials are provided (e.g. Mailtrap, SendGrid, etc.)
  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass }
    });
  }

  // 3. Otherwise in development fallback to Ethereal Email sandbox
  console.warn('[EMAIL SERVICE] CHƯA CẤU HÌNH GMAIL / SMTP THẬT TRONG BACKEND/.ENV! Đang dùng hộp thư ảo Ethereal Sandbox để test nội bộ.');

  if (!testAccount) {
    try {
      testAccount = await nodemailer.createTestAccount();
      console.log(`[EMAIL SERVICE] Initialized development Ethereal test inbox: ${testAccount.user}`);
    } catch (err) {
      console.warn('[EMAIL SERVICE] Could not create Ethereal test account, using stream transport fallback:', err.message);
      return nodemailer.createTransport({
        jsonTransport: true
      });
    }
  }

  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass
    }
  });
}

/**
 * Send Account Verification Email (UC-1, BR-8)
 * @param {{ to: string, fullName: string, token: string }} params
 */
export async function sendVerificationEmail({ to, fullName, token }) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verificationUrl = `${clientUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const senderUser = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const from = senderUser
    ? `"CINEMA+ Rạp Phim" <${senderUser}>`
    : (process.env.EMAIL_FROM || '"CINEMA+ Rạp Phim" <noreply@cinema.com>');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0d0f15; color: #e2e8f0; margin: 0; padding: 24px; }
        .container { max-width: 580px; margin: 0 auto; background-color: #161922; border-radius: 12px; border: 1px solid #2d3343; padding: 36px 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.6); }
        .logo { font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.04em; margin-bottom: 24px; text-align: center; }
        .logo span { color: #e50914; }
        h2 { color: #ffffff; font-size: 22px; margin-top: 0; }
        p { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin: 16px 0; }
        .btn-wrapper { text-align: center; margin: 32px 0; }
        .btn { display: inline-block; background-color: #e50914; color: #ffffff !important; font-weight: 700; font-size: 16px; padding: 14px 32px; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 14px rgba(229,9,20,0.35); }
        .notice { font-size: 13.5px; color: #94a3b8; background-color: #1a1e27; border-left: 3px solid #e50914; padding: 12px 14px; border-radius: 0 6px 6px 0; margin-top: 24px; }
        .footer { font-size: 12.5px; color: #64748b; margin-top: 32px; text-align: center; border-top: 1px solid #242938; padding-top: 20px; }
        .link-alt { word-break: break-all; color: #38bdf8; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">CINEMA<span>+</span></div>
        <h2>Xác thực tài khoản thành viên</h2>
        <p>Xin chào <strong>${fullName}</strong>,</p>
        <p>Cảm ơn bạn đã đăng ký tài khoản thành viên tại rạp phim <strong>CINEMA+</strong>. Để hoàn tất kích hoạt tài khoản và bắt đầu đặt vé trực tuyến, vui lòng nhấp vào nút bên dưới:</p>
        <div class="btn-wrapper">
          <a href="${verificationUrl}" class="btn" target="_blank">Kích hoạt tài khoản ngay</a>
        </div>
        <div class="notice">
          <strong>Lưu ý:</strong> Liên kết này chỉ có hiệu lực trong vòng <strong>24 giờ</strong> và chỉ sử dụng được <strong>1 lần duy nhất</strong>.
        </div>
        <p style="margin-top: 24px; font-size: 13.5px;">Hoặc bạn có thể sao chép liên kết sau dán vào trình duyệt:</p>
        <p><a href="${verificationUrl}" class="link-alt">${verificationUrl}</a></p>
        <div class="footer">
          Đây là email tự động từ hệ thống rạp phim CINEMA+. Vui lòng không trả lời thư này.<br>
          Nếu bạn không thực hiện đăng ký tài khoản, bạn có thể yên tâm bỏ qua email này.
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
CINEMA+ - Xác thực tài khoản thành viên
Xin chào ${fullName},
Cảm ơn bạn đã đăng ký tài khoản thành viên tại CINEMA+.
Vui lòng truy cập liên kết sau để kích hoạt tài khoản của bạn (hiệu lực trong 24 giờ):
${verificationUrl}
  `;

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from,
      to,
      subject: '[CINEMA+] Xác thực và kích hoạt tài khoản thành viên',
      text: textContent,
      html: htmlContent
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log(`[EMAIL SERVICE] Verification email sent to: ${to} (MessageId: ${info.messageId})`);
    if (previewUrl) {
      console.log(`[EMAIL SERVICE] Ethereal Preview URL: ${previewUrl}`);
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || null
    };
  } catch (error) {
    console.error(`[EMAIL SERVICE] Error sending email to ${to}:`, error.message);
    throw error;
  }
}

