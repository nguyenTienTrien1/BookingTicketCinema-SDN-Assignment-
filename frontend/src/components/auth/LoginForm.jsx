import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoginInput from "./LoginInput";
import "../../styles/auth/login.css";
import { loginDestination } from '../../utils/permissions';

export default function LoginForm({ onLoginSuccess, onCancelLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading: sessionLoading, error: sessionError } = useAuth();

  // Form inputs initialized empty (no pre-filled credentials)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoToast, setInfoToast] = useState("");

  const cardTitle = "Đăng nhập tài khoản";

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || sessionLoading) return;
    setErrorMessage("");
    setInfoToast("");

    if (!password || password.length < 6) {
      setErrorMessage("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setLoading(true);

    try {
      const user = await login(email, password);

      if (onLoginSuccess && user.role === 'member') {
        onLoginSuccess(user);
        return;
      }

      navigate(loginDestination(user.role, location.state), { replace: true });
    } catch (err) {
      setErrorMessage(err.message || "Email hoặc mật khẩu không chính xác.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    setInfoToast(
      "Tính năng đăng nhập bằng Google hiện chưa khả dụng trong phạm vi đồ án.",
    );
    setTimeout(() => setInfoToast(""), 4000);
  }

  function handleSignUp(e) {
    e.preventDefault();
    navigate('/register');
  }

  return (
    <div className="cinemaSplitPage">
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

        {/* Multi-layer cinematic vignette & gradient overlay */}
        <div className="cinemaVisualGradientOverlay" />
      </div>

      <div className="cinemaFormSide">
        <div className="cinemaFormCard">
          {/* Brand Logo & Heading */}
          <div className="cinemaCardHeader">
            <div className="cinemaCardLogo">
              CINEMA<span>+</span>
            </div>
            <h2 className="cinemaCardHeading">{cardTitle}</h2>
          </div>

          {(errorMessage || sessionError) && (
            <div className="cinemaAlert cinemaAlertError" role="alert">
              <span>{errorMessage || sessionError}</span>
            </div>
          )}

          {infoToast && (
            <div className="cinemaAlert cinemaAlertInfo" role="status">
              <span>{infoToast}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="cinemaAuthForm" autoComplete="on">
            {/* Email Address Input */}
            <LoginInput
              id="cinema-email"
              label="Địa chỉ email"
              type="email"
              placeholder="ví dụ: email@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
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

            {/* Password Input with Show/Hide Eye Toggle */}
            <LoginInput
              id="cinema-password"
              label="Mật khẩu"
              type={showPassword ? "text" : "password"}
              placeholder="Nhập mật khẩu của bạn..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
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

            {/* Quên mật khẩu? (Right-aligned link) */}
            <div className="forgotPasswordRow">
              <Link
                to="/forgot-password"
                className="forgotPasswordLink"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {/* Primary Submit Button: Bold Netflix Red Rounded Rectangle */}
            <button
              type="submit"
              className="cinemaBtnSubmit"
              disabled={loading || sessionLoading}
            >
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </button>

            {/* Divider: ──── hoặc ──── */}
            <div className="cinemaDivider">
              <span className="dividerLine" />
              <span className="dividerText">hoặc</span>
              <span className="dividerLine" />
            </div>

            {/* Secondary Google Button */}
            <button
              type="button"
              className="cinemaBtnGoogle"
              onClick={handleGoogleLogin}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                className="googleSvgIcon"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.13C3.27 21.36 7.35 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.58H1.26C.46 8.17 0 9.97 0 12s.46 3.83 1.26 5.42l4.02-3.13z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.27 2.64 1.26 6.58l4.02 3.13c.95-2.83 3.6-4.96 6.72-4.96z"
                />
              </svg>
              <span>Tiếp tục với Google</span>
            </button>
          </form>

          {/* Footer: Sign up prompt */}
          <div className="cinemaCardFooter">
            <span className="footerPromptText">Bạn chưa có tài khoản? </span>
            <a
              href="#signup"
              onClick={handleSignUp}
              className="footerSignUpLink"
            >
              Đăng ký ngay
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
