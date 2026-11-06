import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import ManageMovies from "./ManageMovies";
import ManageShowtimes from "./ManageShowtimes";
import ManageRooms from "./ManageRooms";
import ManageCatalogue from "./ManageCatalogue";
import RevenueDashboard from "./RevenueDashboard";
import CreateAccount from "./CreateAccount";
import UpdateAccount from "./UpdateAccount";
import AdjustPoints from "./AdjustPoints";
import CounterTools from "./CounterTools";
import { ProfilePanel } from "../Account/Profile";
import "./adminPortal.css";

const TAB_TITLES = {
  movies: "Quản lý phim",
  showtimes: "Quản lý suất chiếu",
  rooms: "Quản lý phòng chiếu & sơ đồ ghế",
  foods: "Quản lý bắp nước (F&B)",
  promotions: "Chương trình khuyến mãi",
  revenue: "Báo cáo doanh thu",
  "create-account": "Tạo tài khoản nhân sự",
  "update-status": "Trạng thái tài khoản",
  "adjust-points": "Điều chỉnh điểm thưởng",
  counter: "Bán vé & Thu tiền tại quầy",
  profile: "Hồ sơ Quản trị viên",
};

export default function AdminPortal({
  user,
  setUser,
  setTab,
  setMsg,
  initialTab = "movies",
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // Resolve initial active tab: default to 'movies' if empty, 'account', or 'overview'
  const resolveTab = (tab) => {
    if (!tab || tab === "account" || tab === "overview") return "movies";
    return tab;
  };

  const [activeTab, setActiveTab] = useState(resolveTab(initialTab));

  useEffect(() => {
    if (initialTab && initialTab !== "account" && initialTab !== "overview") {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  function switchTab(tabKey) {
    setActiveTab(tabKey);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleViewClientSite() {
    sessionStorage.setItem("cinema_preview_customer", "1");
    if (setTab) setTab("home");
    navigate("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleLogout() {
    try {
      if (logout) await logout();
    } catch (e) {
      console.error("Logout error:", e);
    }
    if (setTab) setTab("home");
    navigate("/");
  }

  return (
    <div className="adminPortalLayout" aria-label="Trung tâm Quản trị CINEMA+">
      {/* =========================================================
          1. LEFT SIDEBAR (Sticky Navigation)
          ========================================================= */}
      <aside className="adminSidebar" aria-label="Thanh điều hướng quản trị">
        {/* Brand Header */}
        <div className="adminSidebarBrand">
          <div className="adminSidebarLogoRow">
            <span className="brandLogo">
              CINEMA<span>+</span>
            </span>
            <span className="adminSidebarBadge">ADMIN</span>
          </div>
          <span className="adminSidebarSubtitle">Hệ thống Quản trị Rạp</span>
        </div>

        {/* User Card */}
        <div className="adminSidebarUserCard">
          <div className="adminSidebarAvatar">
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : "A"}
          </div>
          <div className="adminSidebarUserInfo">
            <span
              className="adminSidebarUserName"
              title={user?.fullName || "Cinema Admin"}
            >
              {user?.fullName || "Cinema Admin"}
            </span>
            <span className="adminSidebarUserStatus">Đang hoạt động</span>
          </div>
        </div>

        {/* Navigation Items Grouped by Category */}
        <nav className="adminSidebarNav" aria-label="Danh mục quản trị">
          {/* GROUP 1: VẬN HÀNH RẠP CHIẾU */}
          <div className="adminSidebarGroupTitle">VẬN HÀNH RẠP CHIẾU</div>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "movies" ? "active" : ""}`}
            onClick={() => switchTab("movies")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Quản lý Phim</span>
          </button>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "showtimes" ? "active" : ""}`}
            onClick={() => switchTab("showtimes")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Suất chiếu</span>
          </button>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "rooms" ? "active" : ""}`}
            onClick={() => switchTab("rooms")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span>Phòng chiếu &amp; Ghế</span>
          </button>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "foods" ? "active" : ""}`}
            onClick={() => switchTab("foods")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span>Bắp nước (F&amp;B)</span>
          </button>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "promotions" ? "active" : ""}`}
            onClick={() => switchTab("promotions")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <circle cx="9.5" cy="14.5" r="1.5" />
              <circle cx="14.5" cy="9.5" r="1.5" />
            </svg>
            <span>Khuyến mãi</span>
          </button>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "revenue" ? "active" : ""}`}
            onClick={() => switchTab("revenue")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            <span>Báo cáo doanh thu</span>
          </button>

          {/* GROUP 2: NHÂN SỰ & NGHIỆP VỤ */}
          <div className="adminSidebarGroupTitle">NHÂN SỰ &amp; NGHIỆP VỤ</div>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "create-account" ? "active" : ""}`}
            onClick={() => switchTab("create-account")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            <span>Tạo tài khoản</span>
          </button>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "update-status" ? "active" : ""}`}
            onClick={() => switchTab("update-status")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Trạng thái tài khoản</span>
          </button>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "adjust-points" ? "active" : ""}`}
            onClick={() => switchTab("adjust-points")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span>Điều chỉnh điểm</span>
          </button>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "counter" ? "active" : ""}`}
            onClick={() => switchTab("counter")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <span>Bán vé &amp; Thu tiền tại quầy</span>
          </button>

          {/* GROUP 3: CÀI ĐẶT */}
          <div className="adminSidebarGroupTitle">CÀI ĐẶT HỆ THỐNG</div>

          <button
            type="button"
            className={`adminSidebarItem ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => switchTab("profile")}
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Hồ sơ Admin</span>
          </button>
        </nav>

        {/* Sidebar Footer Actions */}
        <div className="adminSidebarFooter">
          <button
            type="button"
            className="adminSidebarFooterBtn clientView"
            onClick={handleViewClientSite}
            title="Chuyển sang xem giao diện khách hàng"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>Xem trang khách</span>
          </button>

          <button
            type="button"
            className="adminSidebarFooterBtn logout"
            onClick={handleLogout}
            title="Đăng xuất khỏi hệ thống"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* =========================================================
          2. RIGHT MAIN CONTENT PANE (Dynamic Content by Tab)
          ========================================================= */}
      <main className="adminMainPane" aria-label="Nội dung quản trị">
        {/* Top Sticky Header */}
        <header className="adminMainTopBar">
          <div className="adminBreadcrumb">
            <span className="adminBreadcrumbRoot">Bảng điều khiển</span>
            <span className="adminBreadcrumbSeparator">/</span>
            <span className="adminBreadcrumbCurrent">
              {TAB_TITLES[activeTab] || "Quản trị"}
            </span>
          </div>

          <div className="adminTopBarActions">
            <div className="adminSystemPulse">
              <span className="pulseDot" />
              <span>Hệ thống bình thường</span>
            </div>

            <button
              type="button"
              className="moduleBtnSecondary"
              onClick={handleViewClientSite}
              title="Xem trang khách hàng"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginRight: "6px" }}
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>Xem trang khách</span>
            </button>
          </div>
        </header>

        {/* Dynamic Body Content */}
        <div className="adminMainBody">
          {/* TAB: QUẢN LÝ PHIM */}
          {activeTab === "movies" && <ManageMovies />}

          {/* TAB: SUẤT CHIẾU */}
          {activeTab === "showtimes" && <ManageShowtimes />}

          {/* TAB: PHÒNG CHIẾU */}
          {activeTab === "rooms" && <ManageRooms />}

          {/* TAB: BẮP NƯỚC (F&B) */}
          {activeTab === "foods" && <ManageCatalogue kind="foods" />}

          {/* TAB: KHUYẾN MÃI */}
          {activeTab === "promotions" && <ManageCatalogue kind="promotions" />}

          {/* TAB: DOANH THU */}
          {activeTab === "revenue" && <RevenueDashboard />}

          {/* TAB: TẠO TÀI KHOẢN */}
          {activeTab === "create-account" && (
            <div className="adminSubPanel">
              <CreateAccount />
            </div>
          )}

          {/* TAB: TRẠNG THÁI TÀI KHOẢN */}
          {activeTab === "update-status" && (
            <div className="adminSubPanel">
              <UpdateAccount setMsg={setMsg} />
            </div>
          )}

          {/* TAB: ĐIỀU CHỈNH ĐIỂM */}
          {activeTab === "adjust-points" && (
            <div className="adminSubPanel">
              <AdjustPoints setMsg={setMsg} />
            </div>
          )}

          {/* TAB: BÁN VÉ & THU TIỀN TẠI QUẦY */}
          {activeTab === "counter" && (
            <div className="adminSubPanel">
              <CounterTools />
            </div>
          )}

          {/* TAB: HỒ SƠ ADMIN */}
          {activeTab === "profile" && (
            <div className="adminSubPanel">
              <ProfilePanel
                user={user}
                onUserUpdated={setUser}
                onDone={() => switchTab("movies")}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
