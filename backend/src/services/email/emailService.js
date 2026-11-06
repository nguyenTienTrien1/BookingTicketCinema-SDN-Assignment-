import nodemailer from 'nodemailer';

let testAccount = null;

/**
 * Create or reuse nodemailer transport
 */
async function getTransporter(requireConfigured = false) {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const rawPass = (process.env.GMAIL_APP_PASS || process.env.SMTP_PASS || '').trim();
  const pass = rawPass.replace(/\s+/g, ''); // Tự động loại bỏ khoảng trắng trong mã App Password
  const timeouts = requireConfigured
    ? { connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 }
    : {};

  // 1. If Gmail service is detected (Tự động nhận diện Gmail để gửi thư vào hộp thư thật)
  if (user && pass && (user.toLowerCase().includes('@gmail.com') || host.toLowerCase().includes('gmail'))) {
    return nodemailer.createTransport({
      ...timeouts,
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
      ...timeouts,
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass }
    });
  }

  // Password recovery must never silently fall back to a sandbox/JSON email.
  if (requireConfigured) throw new Error('SMTP must be configured for password recovery.');

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

/** UC-19 uses the configured SMTP transport only, with no preview/token logs. */
export async function sendPasswordResetEmail({ to, resetUrl, expiresInMinutes }) {
  const senderUser = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
  const from = process.env.EMAIL_FROM || `"CINEMA+ Rạp Phim" <${senderUser}>`;
  // Escape the configured URL before putting it into an HTML attribute.
  const htmlUrl = resetUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const transporter = await getTransporter(true);

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>[CINEMA+] Đặt lại mật khẩu</title>
      <style>
        body { margin: 0; padding: 0; background-color: #0b0c10; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        a { text-decoration: none; }
        @media only screen and (max-width: 640px) {
          .email-card { width: 100% !important; border-radius: 0 !important; }
          .email-content { padding: 28px 20px !important; }
          .btn-action { width: 100% !important; box-sizing: border-box !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0c10; font-family: Arial, Helvetica, sans-serif;">
      <!-- OUTER WRAPPER TABLE -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0b0c10; padding: 36px 12px; margin: 0; width: 100%;">
        <tr>
          <td align="center" style="padding: 0;">
            <!-- MAIN EMAIL CARD (Standard 620px Desktop Width) -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-card" style="max-width: 620px; width: 100%; background-color: #141722; border-radius: 12px; border: 1px solid #232838; overflow: hidden; margin: 0 auto; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65);">
              
              <!-- TOP ACCENT BAR -->
              <tr>
                <td style="height: 4px; background-color: #e50914; font-size: 0; line-height: 0;">&nbsp;</td>
              </tr>

              <!-- HEADER BRANDING -->
              <tr>
                <td align="center" style="padding: 34px 40px 10px 40px; text-align: center;">
                  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1;">
                    CINEMA<span style="color: #e50914;">+</span>
                  </div>
                  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #71717a; letter-spacing: 2.5px; text-transform: uppercase; margin-top: 6px; font-weight: 600;">
                    HỆ THỐNG ĐẶT VÉ RẠP PHIM
                  </div>
                </td>
              </tr>

              <!-- CENTER SECURITY EMBLEM (Pure HTML/CSS - 100% Email Client Compatible) -->
              <tr>
                <td align="center" style="padding: 16px 40px 12px 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                    <tr>
                      <td align="center" style="width: 64px; height: 64px; background-color: #241317; border: 1.5px solid #e50914; border-radius: 50%; vertical-align: middle; text-align: center;">
                        <!-- Padlock Shackle -->
                        <div style="width: 14px; height: 11px; border: 2.5px solid #ff3b30; border-bottom: none; border-radius: 7px 7px 0 0; margin: 0 auto; font-size: 0; line-height: 0;"></div>
                        <!-- Padlock Body -->
                        <div style="width: 24px; height: 17px; background-color: #e50914; border-radius: 3px; margin: 0 auto; font-size: 0; line-height: 0; text-align: center;">
                          <div style="width: 4px; height: 4px; background-color: #241317; border-radius: 50%; margin: 3px auto 0 auto; display: block; font-size: 0; line-height: 0;"></div>
                          <div style="width: 2px; height: 5px; background-color: #241317; margin: 0 auto; display: block; font-size: 0; line-height: 0;"></div>
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <div style="margin-top: 14px;">
                    <span style="display: inline-block; background-color: #201317; border: 1px solid #7f1d1d; border-radius: 14px; padding: 4px 14px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #ff4d4f; letter-spacing: 0.8px; text-transform: uppercase;">
                      BẢO MẬT TÀI KHOẢN
                    </span>
                  </div>
                </td>
              </tr>

              <!-- MAIN CONTENT BODY -->
              <tr>
                <td class="email-content" style="padding: 10px 44px 34px 44px; text-align: center;">
                  <h1 style="margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 23px; font-weight: 700; color: #ffffff; text-align: center; line-height: 1.35;">
                    Yêu cầu đặt lại mật khẩu
                  </h1>

                  <p style="margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.65; color: #cbd5e1; text-align: center;">
                    Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản đăng ký với địa chỉ email:
                  </p>

                  <div style="margin: 0 0 20px 0; text-align: center;">
                    <span style="display: inline-block; background-color: #1d212d; border: 1px solid #333a4d; border-radius: 6px; padding: 6px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 14.5px; font-weight: 600; color: #ffffff;">
                      ${to}
                    </span>
                  </div>

                  <p style="margin: 0 0 28px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14.5px; line-height: 1.6; color: #94a3b8; text-align: center;">
                    Vui lòng bấm vào nút bên dưới để tiến hành thiết lập mật khẩu mới cho tài khoản của bạn:
                  </p>

                  <!-- CTA BUTTON -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 30px auto;">
                    <tr>
                      <td align="center" style="border-radius: 8px; background-color: #e50914;">
                        <a href="${htmlUrl}" target="_blank" rel="noopener noreferrer" class="btn-action" style="display: inline-block; background-color: #e50914; color: #ffffff !important; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; padding: 15px 42px; border-radius: 8px; letter-spacing: 0.3px; border: 1px solid #ff2e3b; text-align: center;">
                          Đặt lại mật khẩu ngay →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- SECURITY NOTICE CARD -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #171a25; border: 1px solid #262c3d; border-left: 4px solid #e50914; border-radius: 0 8px 8px 0; margin: 0 0 24px 0;">
                    <tr>
                      <td style="padding: 16px 20px; text-align: left;">
                        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                          LƯU Ý BẢO MẬT QUAN TRỌNG:
                        </div>
                        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #a1a1aa; margin-bottom: 5px;">
                          • <strong style="color: #ffffff;">Thời hạn hiệu lực:</strong> Liên kết có hiệu lực trong vòng <strong style="color: #ffffff;">${expiresInMinutes} phút</strong> và chỉ sử dụng được <strong style="color: #ffffff;">1 lần duy nhất</strong>.
                        </div>
                        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #a1a1aa; margin-bottom: 5px;">
                          • <strong style="color: #ffffff;">Bảo vệ tài khoản:</strong> Tuyệt đối <strong style="color: #ffffff;">không chia sẻ</strong> liên kết này hoặc chuyển tiếp email cho người khác.
                        </div>
                        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #a1a1aa;">
                          • <strong style="color: #ffffff;">Không phải bạn yêu cầu?</strong> Hãy yên tâm bỏ qua email này — mật khẩu hiện tại của bạn vẫn an toàn.
                        </div>
                      </td>
                    </tr>
                  </table>

                  <!-- FALLBACK LINK -->
                  <div style="padding-top: 18px; border-top: 1px solid #232838; text-align: left;">
                    <p style="margin: 0 0 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #71717a; line-height: 1.5;">
                      Nếu nút bấm phía trên không phản hồi, bạn có thể sao chép liên kết dưới đây dán vào thanh địa chỉ trình duyệt:
                    </p>
                    <a href="${htmlUrl}" target="_blank" rel="noopener noreferrer" style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #38bdf8; text-decoration: none; word-break: break-all; line-height: 1.5;">
                      ${htmlUrl}
                    </a>
                  </div>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #0c0e14; padding: 22px 30px; text-align: center; border-top: 1px solid #1f2330;">
                  <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; color: #71717a; text-align: center;">
                    Email này được gửi tự động từ hệ thống rạp phim CINEMA+. Vui lòng không trả lời thư này.<br>
                    © 2026 CINEMA+ Rạp Phim. Mọi quyền được bảo lưu.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject: '[CINEMA+] Đặt lại mật khẩu',
      text: `Bạn đã yêu cầu đặt lại mật khẩu CINEMA+.\nMở liên kết sau trong ${expiresInMinutes} phút (chỉ dùng một lần):\n${resetUrl}\nNếu không yêu cầu thay đổi này, hãy bỏ qua email. Không chia sẻ liên kết này với người khác.`,
      html: htmlContent
    });
    if (!info.accepted || info.accepted.length === 0 || (info.rejected && info.rejected.length > 0)) {
      throw new Error('SMTP did not accept the password reset email.');
    }
  } finally {
    transporter.close();
  }
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
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>[CINEMA+] Xác thực tài khoản thành viên</title>
      <style>
        body { margin: 0; padding: 0; background-color: #0b0c10; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        a { text-decoration: none; }
        @media only screen and (max-width: 640px) {
          .email-card { width: 100% !important; border-radius: 0 !important; }
          .email-content { padding: 28px 20px !important; }
          .btn-action { width: 100% !important; box-sizing: border-box !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0c10; font-family: Arial, Helvetica, sans-serif;">
      <!-- OUTER WRAPPER TABLE -->
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0b0c10; padding: 36px 12px; margin: 0; width: 100%;">
        <tr>
          <td align="center" style="padding: 0;">
            <!-- MAIN EMAIL CARD (Standard 620px Desktop Width) -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="email-card" style="max-width: 620px; width: 100%; background-color: #141722; border-radius: 12px; border: 1px solid #232838; overflow: hidden; margin: 0 auto; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65);">
              
              <!-- TOP ACCENT BAR -->
              <tr>
                <td style="height: 4px; background-color: #e50914; font-size: 0; line-height: 0;">&nbsp;</td>
              </tr>

              <!-- HEADER BRANDING -->
              <tr>
                <td align="center" style="padding: 34px 40px 10px 40px; text-align: center;">
                  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px; line-height: 1;">
                    CINEMA<span style="color: #e50914;">+</span>
                  </div>
                  <div style="font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #71717a; letter-spacing: 2.5px; text-transform: uppercase; margin-top: 6px; font-weight: 600;">
                    HỆ THỐNG ĐẶT VÉ RẠP PHIM
                  </div>
                </td>
              </tr>

              <!-- CENTER MEMBER TICKET EMBLEM (Pure HTML/CSS - 100% Email Client Compatible) -->
              <tr>
                <td align="center" style="padding: 16px 40px 12px 40px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                    <tr>
                      <td align="center" style="width: 64px; height: 64px; background-color: #241317; border: 1.5px solid #e50914; border-radius: 50%; vertical-align: middle; text-align: center;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto;">
                          <tr>
                            <td align="center" style="width: 28px; height: 20px; background-color: #e50914; border-radius: 3px; vertical-align: middle; text-align: center; line-height: 20px;">
                              <span style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: 900; color: #ffffff; line-height: 1;">★</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                  
                  <div style="margin-top: 14px;">
                    <span style="display: inline-block; background-color: #201317; border: 1px solid #7f1d1d; border-radius: 14px; padding: 4px 14px; font-family: Arial, Helvetica, sans-serif; font-size: 11px; font-weight: 700; color: #ff4d4f; letter-spacing: 0.8px; text-transform: uppercase;">
                      KÍCH HOẠT THÀNH VIÊN
                    </span>
                  </div>
                </td>
              </tr>

              <!-- MAIN CONTENT BODY -->
              <tr>
                <td class="email-content" style="padding: 10px 44px 34px 44px; text-align: center;">
                  <h1 style="margin: 0 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 23px; font-weight: 700; color: #ffffff; text-align: center; line-height: 1.35;">
                    Xác thực tài khoản thành viên
                  </h1>

                  <p style="margin: 0 0 12px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15.5px; line-height: 1.6; color: #ffffff; text-align: center;">
                    Xin chào <strong style="color: #ffffff;">${fullName}</strong>,
                  </p>

                  <p style="margin: 0 0 18px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.65; color: #cbd5e1; text-align: center;">
                    Cảm ơn bạn đã đăng ký tài khoản thành viên tại hệ thống rạp phim <strong style="color: #ffffff;">CINEMA+</strong>. Để hoàn tất kích hoạt tài khoản và bắt đầu đặt vé trực tuyến, vui lòng xác thực địa chỉ email:
                  </p>

                  <div style="margin: 0 0 24px 0; text-align: center;">
                    <span style="display: inline-block; background-color: #1d212d; border: 1px solid #333a4d; border-radius: 6px; padding: 6px 16px; font-family: Arial, Helvetica, sans-serif; font-size: 14.5px; font-weight: 600; color: #ffffff;">
                      ${to}
                    </span>
                  </div>

                  <!-- CTA BUTTON -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 30px auto;">
                    <tr>
                      <td align="center" style="border-radius: 8px; background-color: #e50914;">
                        <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" class="btn-action" style="display: inline-block; background-color: #e50914; color: #ffffff !important; font-family: Arial, Helvetica, sans-serif; font-size: 15px; font-weight: 700; text-decoration: none; padding: 15px 44px; border-radius: 8px; letter-spacing: 0.3px; border: 1px solid #ff2e3b; text-align: center;">
                          Kích hoạt tài khoản ngay →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- SECURITY & BENEFIT NOTICE CARD -->
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #171a25; border: 1px solid #262c3d; border-left: 4px solid #e50914; border-radius: 0 8px 8px 0; margin: 0 0 24px 0;">
                    <tr>
                      <td style="padding: 16px 20px; text-align: left;">
                        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                          LƯU Ý KÍCH HOẠT QUAN TRỌNG:
                        </div>
                        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #a1a1aa; margin-bottom: 5px;">
                          • <strong style="color: #ffffff;">Thời hạn liên kết:</strong> Liên kết có hiệu lực trong vòng <strong style="color: #ffffff;">24 giờ</strong> và chỉ sử dụng được <strong style="color: #ffffff;">1 lần duy nhất</strong>.
                        </div>
                        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #a1a1aa; margin-bottom: 5px;">
                          • <strong style="color: #ffffff;">Đặc quyền thành viên:</strong> Tích điểm đổi quà sau mỗi lần đặt vé và nhận ưu đãi độc quyền từ CINEMA+.
                        </div>
                        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #a1a1aa;">
                          • <strong style="color: #ffffff;">Không phải bạn đăng ký?</strong> Nếu bạn không thực hiện đăng ký tài khoản này, vui lòng bỏ qua email.
                        </div>
                      </td>
                    </tr>
                  </table>

                  <!-- FALLBACK LINK -->
                  <div style="padding-top: 18px; border-top: 1px solid #232838; text-align: left;">
                    <p style="margin: 0 0 6px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #71717a; line-height: 1.5;">
                      Nếu nút bấm phía trên không phản hồi, bạn có thể sao chép liên kết dưới đây dán vào thanh địa chỉ trình duyệt:
                    </p>
                    <a href="${verificationUrl}" target="_blank" rel="noopener noreferrer" style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #38bdf8; text-decoration: none; word-break: break-all; line-height: 1.5;">
                      ${verificationUrl}
                    </a>
                  </div>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #0c0e14; padding: 22px 30px; text-align: center; border-top: 1px solid #1f2330;">
                  <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.6; color: #71717a; text-align: center;">
                    Email này được gửi tự động từ hệ thống rạp phim CINEMA+. Vui lòng không trả lời thư này.<br>
                    © 2026 CINEMA+ Rạp Phim. Mọi quyền được bảo lưu.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
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


export async function sendStaffInvitation({to,fullName,token}) {
 if(!process.env.SMTP_HOST&&!process.env.GMAIL_USER)return {emailSent:false};
 const transport=await getTransporter();
 const link=new URL('/activate-staff',process.env.CLIENT_URL||'http://localhost:5173');link.searchParams.set('token',token);
 const info=await transport.sendMail({from:process.env.EMAIL_FROM||process.env.SMTP_USER,to,subject:'CINEMA+ — Kích hoạt tài khoản nhân sự',text:'Xin chào '+fullName+'. Tự đặt mật khẩu qua liên kết có hiệu lực 24 giờ: '+link.toString()});
 return {emailSent:!!info.messageId};
}
