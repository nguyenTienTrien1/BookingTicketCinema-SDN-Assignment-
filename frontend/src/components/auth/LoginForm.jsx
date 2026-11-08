import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoginInput from "./LoginInput";
import GoogleSignIn from "./GoogleSignIn";
import "../../styles/auth/login.css";
import { roleHome } from '../../utils/permissions';

export default function LoginForm({ onLoginSuccess, onCancelLogin, portal = 'member' }) {
  const navigate = useNavigate();
  const { login, googleLogin, loading: sessionLoading, error: sessionError, setError: setSessionError } = useAuth();
  useEffect(() => { setSessionError(''); }, [portal, setSessionError]);

  // Form inputs initialized empty (no pre-filled credentials)
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoToast, setInfoToast] = useState("");

  const isStaff = portal === 'staff';
  const cardTitle = isStaff ? "Đăng nhập nhân sự" : "Đăng nhập thành viên";

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
      const user = await login(email, password, portal);

      if (onLoginSuccess && user.role === 'member') {
        onLoginSuccess(user);
      }

      navigate(roleHome(user.role), { replace: true });
    } catch (err) {
      setErrorMessage(err.message || "Email hoặc mật khẩu không chính xác.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin(credential) {
    setErrorMessage("");
    setLoading(true);
    try {
      const user = await googleLogin(credential);
      if (onLoginSuccess && user.role === 'member') {
        onLoginSuccess(user);
      }
      navigate(roleHome(user.role), { replace: true });
    } finally {
      setLoading(false);
    }
  }
  function handleSignUp(e) {
    e.preventDefault();
    navigate('/register');
  }

  return (
    <div className="cinemaSplitPage">
      <div className="cinemaVisualSide">
        <div
          className="cinemaBrandHeader"
          onClick={onCancelLogin || (() => navigate('/'))}
          style={{ cursor: 'pointer' }}
        >
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

            {!isStaff && (
              <>
                <div className="cinemaDivider">
                  <span className="dividerLine" />
                  <span className="dividerText">hoặc</span>
                  <span className="dividerLine" />
                </div>
                <GoogleSignIn onCredential={handleGoogleLogin} disabled={loading || sessionLoading} />
              </>
            )}
          </form>

          {/* Footer: Sign up prompt */}
          {!isStaff && <div className="cinemaCardFooter">
            <span className="footerPromptText">Bạn chưa có tài khoản? </span>
            <a
              href="#signup"
              onClick={handleSignUp}
              className="footerSignUpLink"
            >
              Đăng ký ngay
            </a>
          </div>}
        </div>
      </div>
    </div>
  );
}
