import { api } from "../services/api";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import "../index.css";
import Header from "../components/Header";
import StaffHeader from '../components/StaffHeader';
import Home from "./Home/Home";
import Movies from "./Home/Movies";
import Showtimes from "./Home/Showtimes";
import Cinemas from "./Home/Cinemas";
import Login from "./Login/Login";
import Booking from "./Booking/Booking";
import Payment from "./Payment/Payment";
import Account from "./Account/Account";
import MovieDetail from "./MovieDetail/MovieDetail";
import AdminPortal from "./Admin/AdminPortal";
import { getMovies, getShowtimes } from "../services/movieService";
import { getFoods } from "../services/foodService";
import { useAuth } from "../context/AuthContext";
import { canOpenTab } from "../utils/permissions";

export default function CinemaMain({ workspace = 'customer' }) {
  const location = useLocation();
  const { user: authUser, setUser: setAuthUser } = useAuth();
  const [movies, setMovies] = useState([]);
  const [showtimes, setShowtimes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [pointsPolicy, setPointsPolicy] = useState({
    pointRedeemStep: 1,
    pointValue: 1000,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [dataRetry, setDataRetry] = useState(0);
  const user = authUser;
  const [selected, setSelected] = useState(null);
  const [pending, setPending] = useState(null);
  const isCounterStaff = ['employee', 'admin'].includes(user?.role);
  const counterStorageKey = 'cinema-counter-booking-' + user?._id;
  const [counterRecovery, setCounterRecovery] = useState(null);
  const [recoveryRetry, setRecoveryRetry] = useState(0);
  const [tab, setActiveTab] = useState(
    workspace === 'staff' || location.pathname === "/account" ? "account" : "home",
  );
  const setTab = useCallback(next => {
    const target = isCounterStaff ? ({ booking: 'counter-booking', payment: 'counter-payment' }[next] || next) : next;
    setActiveTab(canOpenTab(user?.role, target) ? target : isCounterStaff ? 'account' : 'home');
  }, [user?.role, isCounterStaff]);
  useEffect(() => {
    if (workspace === 'staff' || location.pathname === "/account") {
      const task = new URLSearchParams(location.search).get('task');
      setTab(isCounterStaff && ['booking', 'payment'].includes(task) ? task : 'account');
    }
  }, [workspace, location.key, location.pathname, location.search, setTab, isCounterStaff]);
  const [msg, setMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCinemaFilter, setSelectedCinemaFilter] = useState("");

  const rememberPending = useCallback((booking) => {
    setPending(booking);
    if (!isCounterStaff) return;
    const needsFollowUp = booking?.status === 'pending' || booking?.activePayment;
    setCounterRecovery(needsFollowUp ? { id: booking._id } : null);
    try {
      if (needsFollowUp) sessionStorage.setItem(counterStorageKey, booking._id);
      else sessionStorage.removeItem(counterStorageKey);
    } catch { /* Booking remains usable when browser storage is unavailable. */ }
  }, [isCounterStaff, counterStorageKey]);

  useEffect(() => {
    let active = true;
    setPending(null); setCounterRecovery(null);
    if (!isCounterStaff) return;
    let id;
    try { id = sessionStorage.getItem(counterStorageKey); } catch { return; }
    if (!id) return;
    setCounterRecovery({ id, loading: true });
    api('/payments/bookings/' + encodeURIComponent(id))
      .then(booking => {
        if (!active) return;
        const liveHold = booking.status === 'pending' && new Date(booking.expiresAt) > new Date();
        if (liveHold || booking.activePayment) {
          setPending(booking); setCounterRecovery({ id });
        } else {
          setCounterRecovery(null);
          try { sessionStorage.removeItem(counterStorageKey); } catch { /* No storage available. */ }
        }
      })
      .catch(error => {
        if (!active) return;
        if ([400, 404].includes(error.status)) {
          setCounterRecovery(null);
          try { sessionStorage.removeItem(counterStorageKey); } catch { /* No storage available. */ }
        } else setCounterRecovery({ id, error: error.message });
      });
    return () => { active = false; };
  }, [user?._id, isCounterStaff, counterStorageKey, recoveryRetry]);

  const handleSetUser = useCallback(
    (newUser) => {
      setAuthUser(newUser);
    },
    [setAuthUser],
  );

  useEffect(() => {
    if (!['booking', 'counter-booking'].includes(tab)) return;
    let active = true;
    const refresh = () =>
      Promise.all([getShowtimes(), getFoods()])
        .then(([data, foodList]) => {
          if (active) {
            setShowtimes(data);
            setFoods(foodList);
          }
        })
        .catch((error) => {
          if (active) setMsg(error.message);
        });
    refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [tab]);

  useEffect(() => {
    if (isCounterStaff && !['counter-booking', 'counter-payment'].includes(tab)) return;
    let active = true;
    setDataLoading(true);
    setDataError("");
    Promise.all([getMovies(), getShowtimes(), getFoods(), api("/config")])
      .then(([movieList, showtimeList, foodList, policy]) => {
        if (!active) return;
        setMovies(movieList);
        setShowtimes(showtimeList);
        setFoods(foodList);
        setPointsPolicy(policy);
      })
      .catch((error) => {
        if (active) setDataError(error.message);
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });

    const handleShowtimeSelection = (event) => setSelected(event.detail);
    window.addEventListener("select-showtime", handleShowtimeSelection);
    return () => {
      active = false;
      window.removeEventListener("select-showtime", handleShowtimeSelection);
    };
  }, [dataRetry, isCounterStaff, isCounterStaff ? tab : null]);

  useEffect(() => {
    if (!msg) return undefined;
    const timeout = setTimeout(() => setMsg(""), 3500);
    return () => clearTimeout(timeout);
  }, [msg]);

  const requireBookingLogin = () => {
    setMsg("Vui lòng đăng nhập để tiếp tục đặt vé.");
    setTab("login");
  };

  const props = {
    movies,
    dataLoading,
    dataError,
    onRetryData: () => setDataRetry((value) => value + 1),
    showtimes,
    onRefreshShowtimes: async () => {
      const latest = await getShowtimes();
      if (!Array.isArray(latest)) throw new Error('Không thể đọc danh sách suất chiếu.');
      setShowtimes(latest);
      return latest;
    },
    foods,
    pointsPolicy,
    user,
    setUser: handleSetUser,
    selected,
    setSelected,
    setTab,
    setMsg,
    setPending: rememberPending,
    pending,
    searchFilter: searchQuery,
    onRequireBookingLogin: requireBookingLogin,
  };

  const accountSection = new URLSearchParams(location.search).get("section");
  let page;
  switch (tab) {
    case "home":
      page = <Home {...props} />;
      break;
    case "movies":
      page = <Movies {...props} />;
      break;
    case "showtimes":
      page = <Showtimes {...props} initialCinema={selectedCinemaFilter} />;
      break;
    case "cinemas":
      page = (
        <Cinemas
          {...props}
          onSelectCinemaForSchedule={(cinemaName) => {
            setSelectedCinemaFilter(cinemaName);
          }}
        />
      );
      break;
    case "login":
      page = (
        <Login
          {...props}
          onCancelLogin={() => {
            setTab("home");
          }}
          onLoginSuccess={() => {
            setTab("home");
          }}
        />
      );
      break;
    case "booking":
    case "counter-booking":
      page = <Booking {...props} />;
      break;
    case "movie-detail":
      page = (
        <MovieDetail {...props} setSelected={setSelected} setTab={setTab} />
      );
      break;
    case "payment":
    case "counter-payment":
      page = <Payment {...props} onDone={() => setTab("home")} />;
      break;
    case "account":
    case "create-account":
    case "update-status":
    case "adjust-points":
      page =
        user?.role === "admin" ? (
          <AdminPortal
            {...props}
            initialTab={tab === "account" ? (["profile", "members"].includes(accountSection) ? accountSection : "movies") : tab}
          />
        ) : (
          <Account
            {...props}
            initialSection={accountSection}
          />
        );
      break;
    default:
      page = <Home {...props} />;
  }

  if (!canOpenTab(user?.role, tab)) {
    page = (
      <section className="page" role="alert">
        <h2>Bạn không có quyền sử dụng chức năng này</h2>
        <button
          type="button"
          className="primary"
          onClick={() => setTab("home")}
        >
          Về trang chủ
        </button>
      </section>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isAdminDashboard =
    isAdmin &&
    [
      'account',
      'create-account',
      'update-status',
      'adjust-points',
    ].includes(tab);
  const hideHeader = isAdminDashboard || tab === 'login';

  return (
    <div className="app">
      <div className={`app-shell ${isAdminDashboard ? 'adminShell' : ''}`}>
        {isCounterStaff && !isAdminDashboard && <StaffHeader activeTab={tab} onAccount={() => setTab('account')} onBookTickets={() => setTab('booking')} />}
        {!isCounterStaff && !hideHeader && (
          <Header tab={tab} setTab={setTab} user={user} onSearch={setSearchQuery} />
        )}
        <main
          className={`main-content ${
            tab !== 'home' && tab !== 'login' ? 'subpage' : ''
          } ${isAdminDashboard ? 'adminMainContentWrapper' : ''} ${isCounterStaff ? 'staffMainContent' : ''}`}
        >
          {isCounterStaff && counterRecovery && tab !== 'counter-payment' && <aside className="paymentNotice counterResume" aria-label="Đơn đang xử lý">
            <div>
            <p><strong>Đơn đang xử lý: {counterRecovery.id}</strong></p>
            <p>{counterRecovery.loading ? 'Đang kiểm tra trạng thái mới nhất…' : counterRecovery.error || 'Bạn có thể tiếp tục đơn này; thời hạn giữ ghế không được kéo dài.'}</p>
            </div>
            <button type="button" className="ghost" disabled={counterRecovery.loading} onClick={() => pending ? setTab('payment') : setRecoveryRetry(value => value + 1)}>
              {pending ? 'Tiếp tục xử lý đơn' : 'Kiểm tra lại đơn'}
            </button>
          </aside>}
          {page}
          {msg && <div className="toast">{msg}</div>}
        </main>
      </div>
    </div>
  );
}
