import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerUser, resendVerification } from "../../services/auth/authService";
import LoginInput from "./LoginInput";
import "../../styles/auth/login.css";

export default function RegisterForm() {
  const navigate = useNavigate();

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successData, setSuccessData] = useState(null);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  async function handleResendEmail() {
    if (resending || resendCooldown > 0 || !email) return;
    setResending(true);
    setResendMessage("");
    try {
      const res = await resendVerification(email);
      setResendMessage(res.message || "Đã gửi lại email xác thực thành công. Vui lòng kiểm tra hộp thư.");
      setResendCooldown(60);
    } catch (err) {
      setResendMessage(err.message || "Không thể gửi lại email lúc này. Vui lòng thử lại sau.");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    // Client-side validation
    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp. Vui lòng nhập lại.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Mật khẩu phải có tối thiểu 6 ký tự.");
      return;
    }

    setLoading(true);

    try {
      const data = await registerUser({
        fullName,
        email,
        phone,
        password,
      });

      setSuccessData(data);
    } catch (err) {
      setErrorMessage(
        err.message ||
          "Đăng ký không thành công. Vui lòng kiểm tra lại thông tin.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cinemaSplitPage">
      {/* =========================================================================
          LEFT 55%: MOVIE WEBSITE CINEMATIC POSTER MOSAIC (NO SCROLL, FIXED)
          ========================================================================= */}
      <div className="cinemaVisualSide">
        <div className="cinemaBrandHeader">
          CINEMA<span>+</span>
        </div>

        {/* Netflix-style Cinema Poster Mosaic Wall */}
        <div className="cinemaPosterWall" aria-hidden="true">
          <div className="posterColumn col1">
            <img src="/images/posters/dune.jpg" alt="" loading="lazy" />
            <img src="/images/posters/the_batman.jpg" alt="" loading="lazy" />
            <img src="/images/posters/joker.jpg" alt="" loading="lazy" />
            <img src="/images/posters/venom.jpg" alt="" loading="lazy" />
          </div>
          <div className="posterColumn col2">
            <img
              src="/images/posters/stranger_things.jpg"
              alt=""
              loading="lazy"
            />
            <img
              src="/images/posters/avatar_fire_and_ash.jpg"
              alt=""
              loading="lazy"
            />
            <img
              src="/images/posters/all_of_us_are_dead.jpg"
              alt=""
              loading="lazy"
            />
            <img src="/images/posters/wednesday.jpg" alt="" loading="lazy" />
          </div>
          <div className="posterColumn col3">
            <img
              src="/images/posters/alice_in_borderland.jpg"
              alt=""
              loading="lazy"
            />
            <img
              src="/images/posters/attack_on_titan.jpg"
              alt=""
              loading="lazy"
            />
            <img src="/images/posters/harry_potter.jpg" alt="" loading="lazy" />
            <img
              src="/images/posters/the_maze_runner.jpg"
              alt=""
              loading="lazy"
            />
          </div>
        </div>

        <div className="cinemaVisualGradientOverlay" />
      </div>

      {/* =========================================================================
          RIGHT 45%: REGISTER FORM COLUMN (NO SCROLL, EXPANDED NETFLIX FORMAT)
          ========================================================================= */}
      <div className="cinemaFormSide">
        <div className="cinemaFormCard">
          <div className="cinemaCardHeader">
            <div className="cinemaCardLogo">
              CINEMA<span>+</span>
            </div>
            <h2 className="cinemaCardHeading">Đăng ký tài khoản thành viên</h2>
          </div>

          {errorMessage && (
            <div className="cinemaAlert cinemaAlertError" role="alert">
              <span>{errorMessage}</span>
            </div>
          )}

          {successData ? (
            /* Success State & Email Verification Notice (BR-8) */
            <div className="registerSuccessCard" role="status">
              <div className="successBadgeIcon">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3 className="successTitle">Đăng ký thành công!</h3>
              <p className="successDesc">
                Chúng tôi đã gửi email xác thực đến địa chỉ:
              </p>
              <div style={{ margin: "10px 0 18px" }}>
                <span style={{
                  display: "inline-block",
                  backgroundColor: "rgba(229, 9, 20, 0.08)",
                  border: "1px solid rgba(229, 9, 20, 0.25)",
                  borderRadius: "20px",
                  padding: "6px 16px",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "14px"
                }}>
                  {email}
                </span>
              </div>
              <div className="verifyActionBox">
                <p className="verifyNote" style={{ margin: 0, lineHeight: 1.6, textAlign: "left" }}>
                  Vui lòng mở hộp thư đến và nhấp vào liên kết xác thực để kích hoạt tài khoản của bạn (liên kết có hiệu lực trong <strong>24 giờ</strong>). Nếu chưa thấy thư, vui lòng kiểm tra thêm mục <strong>Thư rác (Spam)</strong>.
                </p>
              </div>

              {resendMessage && (
                <div style={{
                  backgroundColor: resendMessage.includes("thành công") ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                  border: resendMessage.includes("thành công") ? "1px solid rgba(16, 185, 129, 0.35)" : "1px solid rgba(239, 68, 68, 0.35)",
                  color: resendMessage.includes("thành công") ? "#34d399" : "#fca5a5",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "13px",
                  margin: "16px 0 8px",
                  textAlign: "center"
                }}>
                  {resendMessage}
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="cinemaBtnSubmit verifyNowBtn"
                  onClick={handleResendEmail}
                  disabled={resending || resendCooldown > 0}
                  style={{ width: "100%", cursor: resendCooldown > 0 ? "not-allowed" : "pointer" }}
                >
                  {resending
                    ? "Đang gửi lại..."
                    : resendCooldown > 0
                      ? `Gửi lại email xác thực (${resendCooldown}s)`
                      : "Gửi lại email xác thực"}
                </button>
              </div>

              <div style={{ marginTop: '18px' }}>
                <Link to="/login" className="footerSignUpLink">
                  ← Quay lại trang Đăng nhập
                </Link>
              </div>
            </div>
          ) : (
            /* Registration Form */
            <form
              onSubmit={handleSubmit}
              className="cinemaAuthForm"
              autoComplete="off"
            >
              {/* Full Name Input */}
              <LoginInput
                id="reg-fullname"
                label="Họ và tên"
                type="text"
                placeholder="ví dụ: Nguyễn Văn A"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="off"
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                }
              />

              {/* Email Address Input */}
              <LoginInput
                id="reg-email"
                label="Địa chỉ email"
                type="email"
                placeholder="ví dụ: email@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                }
              />

              {/* Phone Number Input */}
              <LoginInput
                id="reg-phone"
                label="Số điện thoại"
                type="tel"
                placeholder="ví dụ: 0912345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="off"
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                }
              />

              {/* Password Input */}
              <LoginInput
                id="reg-password"
                label="Mật khẩu"
                type={showPassword ? "text" : "password"}
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
                rightElement={
                  <button
                    type="button"
                    className="passwordEyeToggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                }
              />

              {/* Confirm Password Input */}
              <LoginInput
                id="reg-confirm-password"
                label="Xác nhận mật khẩu"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Nhập lại mật khẩu"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                icon={
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
                rightElement={
                  <button
                    type="button"
                    className="passwordEyeToggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={
                      showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                    }
                  >
                    {showConfirmPassword ? (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                      </svg>
                    ) : (
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                }
              />

              {/* Submit Button */}
              <button
                type="submit"
                className="cinemaBtnSubmit"
                style={{ marginTop: "8px" }}
                disabled={loading}
              >
                {loading ? "Đang tạo tài khoản..." : "Đăng ký thành viên"}
              </button>

              {/* Footer: Link to login */}
              <div className="cinemaCardFooter">
                <span className="footerPromptText">Bạn đã có tài khoản? </span>
                <Link to="/login" className="footerSignUpLink">
                  Đăng nhập ngay
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
