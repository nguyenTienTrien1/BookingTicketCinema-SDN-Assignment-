import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  verifyEmail,
  resendVerification,
} from "../../services/auth/authService";
import "../../styles/auth/login.css";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("pending"); // 'pending' | 'success' | 'error'
  const [message, setMessage] = useState("");
  const verificationRequestedRef = useRef(false);

  // Resend state
  const [resendEmail, setResendEmail] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [newVerificationLink, setNewVerificationLink] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Không tìm thấy mã xác thực trong đường dẫn URL.");
      setLoading(false);
      return;
    }

    // Guard against React 18 StrictMode double-invoking
    if (verificationRequestedRef.current) return;
    verificationRequestedRef.current = true;

    async function performVerification() {
      try {
        const res = await verifyEmail(token);
        setStatus("success");
        setMessage(res.message || "Kích hoạt tài khoản thành viên thành công!");
      } catch (err) {
        setStatus("error");
        setMessage(
          err.message ||
            "Xác thực email không thành công. Mã có thể đã hết hạn hoặc đã được sử dụng.",
        );
      } finally {
        setLoading(false);
      }
    }

    performVerification();
  }, [token]);

  async function handleResend(e) {
    e.preventDefault();
    setResendLoading(true);
    setResendMessage("");
    setNewVerificationLink("");

    try {
      const res = await resendVerification(resendEmail);
      setResendMessage(
        res.message || "Đã tạo liên kết xác thực mới thành công.",
      );
      if (res.verificationLink) {
        setNewVerificationLink(res.verificationLink);
      }
    } catch (err) {
      setResendMessage(err.message || "Không thể gửi lại liên kết xác thực.");
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <div className="cinemaSplitPage">
      <div className="cinemaVisualSide">
        <div className="cinemaBrandHeader">
          CINEMA<span>+</span>
        </div>
        <div className="cinemaPosterWall" aria-hidden="true">
          <div className="posterColumn col1">
            <img src="/images/posters/dune.jpg" alt="" loading="lazy" />
            <img src="/images/posters/the_batman.jpg" alt="" loading="lazy" />
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
          </div>
        </div>
        <div className="cinemaVisualGradientOverlay" />
      </div>

      <div className="cinemaFormSide">
        <div className="cinemaFormCard">
          <div className="cinemaCardHeader">
            <div className="cinemaCardLogo">
              CINEMA<span>+</span>
            </div>
            <h2 className="cinemaCardHeading">Xác thực tài khoản</h2>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <p style={{ color: "#94a3b8", fontSize: "15px" }}>
                Đang xác thực liên kết...
              </p>
            </div>
          ) : status === "success" ? (
            <div className="registerSuccessCard">
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
              <h3 className="successTitle">Kích hoạt thành công!</h3>
              <p className="successDesc">{message}</p>
              <Link to="/login" className="cinemaBtnSubmit verifyNowBtn">
                Đăng nhập ngay
              </Link>
            </div>
          ) : (
            <div>
              <div className="cinemaAlert cinemaAlertError" role="alert">
                <span>{message}</span>
              </div>

              {/* Form to resend verification link per BR-8 */}
              <div style={{ marginTop: "20px" }}>
                <h4
                  style={{
                    color: "#fff",
                    fontSize: "14.5px",
                    marginBottom: "8px",
                  }}
                >
                  Yêu cầu gửi lại liên kết xác thực mới:
                </h4>
                <form
                  onSubmit={handleResend}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <input
                    type="email"
                    placeholder="Nhập email của bạn"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    required
                    className="loginInputField"
                    style={{
                      background: "#1a1e27",
                      border: "1px solid #2d3343",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      color: "#fff",
                    }}
                  />
                  <button
                    type="submit"
                    className="cinemaBtnSubmit"
                    disabled={resendLoading}
                    style={{ height: "44px" }}
                  >
                    {resendLoading
                      ? "Đang xử lý..."
                      : "Tạo liên kết xác thực mới"}
                  </button>
                </form>

                {resendMessage && (
                  <p
                    style={{
                      color: "#7dd3fc",
                      fontSize: "13px",
                      marginTop: "10px",
                      textAlign: "center",
                    }}
                  >
                    {resendMessage}
                  </p>
                )}

                {newVerificationLink && (
                  <div style={{ marginTop: "12px", textAlign: "center" }}>
                    <Link
                      to={newVerificationLink}
                      style={{
                        color: "#22c55e",
                        fontWeight: 600,
                        textDecoration: "underline",
                        fontSize: "13.5px",
                      }}
                    >
                      Bấm vào đây để kích hoạt bằng mã mới
                    </Link>
                  </div>
                )}
              </div>

              <div className="cinemaCardFooter" style={{ marginTop: "24px" }}>
                <Link to="/login" className="footerSignUpLink">
                  ← Quay lại trang Đăng nhập
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
