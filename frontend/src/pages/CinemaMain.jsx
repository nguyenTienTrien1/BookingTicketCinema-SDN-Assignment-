import {api} from '../services/api';
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import '../index.css';
import Header from '../components/Header';
import Home from './Home/Home';
import Movies from './Home/Movies';
import Login from './Login/Login';
import Booking from './Booking/Booking';
import Payment from './Payment/Payment';
import Account from './Account/Account';
import MovieDetail from './MovieDetail/MovieDetail';
import CreateAccount from './Admin/CreateAccount';
import UpdateAccount from './Admin/UpdateAccount';
import AdjustPoints from './Admin/AdjustPoints';
import { getMovies, getShowtimes } from '../services/movieService';
import { getFoods } from '../services/foodService';
import { useAuth } from '../context/AuthContext';
import { canOpenTab } from '../utils/permissions';

export default function CinemaMain() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user: authUser, setUser: setAuthUser } = useAuth();
    const [movies, setMovies] = useState([]);
    const [showtimes, setShowtimes] = useState([]);
    const [foods, setFoods] = useState([]);
    const [pointsPolicy,setPointsPolicy]=useState({pointRedeemStep:100,pointValue:1000});
    const [dataLoading, setDataLoading] = useState(true);
    const [dataError, setDataError] = useState('');
    const [dataRetry, setDataRetry] = useState(0);
    const user = authUser;
    const [selected, setSelected] = useState(null);
    const [pending, setPending] = useState(null);
    const [tab, setTab] = useState(location.pathname === '/account' ? 'account' : 'home');
    useEffect(() => {
        if (location.pathname === '/account') setTab('account');
    }, [location.key, location.pathname]);
    const [loginReturnTab, setLoginReturnTab] = useState('home');
    const [msg, setMsg] = useState('');
    const [searchQuery, setSearchQuery] = useState('');


    const handleSetUser = useCallback((newUser) => {
        setAuthUser(newUser);
    }, [setAuthUser]);

    useEffect(() => {
        if (tab !== 'booking') return;
        let active = true;
        const refresh = () => Promise.all([getShowtimes(), getFoods()]).then(([data, foodList]) => { if (active) { setShowtimes(data); setFoods(foodList); } }).catch((error) => { if (active) setMsg(error.message); });
        refresh();
        const timer = window.setInterval(refresh, 15000);
        window.addEventListener('focus', refresh);
        return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
    }, [tab]);

    useEffect(() => {
        let active = true;
        setDataLoading(true);
        setDataError('');
        Promise.all([getMovies(), getShowtimes(), getFoods(), api('/config')])
            .then(([movieList, showtimeList, foodList, policy]) => {
                if (!active) return;
                setMovies(movieList);
                setShowtimes(showtimeList);
                setFoods(foodList);
                setPointsPolicy(policy);
            })
            .catch((error) => { if (active) setDataError(error.message); })
            .finally(() => { if (active) setDataLoading(false); });

        const handleShowtimeSelection = (event) => setSelected(event.detail);
        window.addEventListener('select-showtime', handleShowtimeSelection);
        return () => { active = false; window.removeEventListener('select-showtime', handleShowtimeSelection); };
    }, [dataRetry]);

    useEffect(() => {
        if (!msg) return undefined;
        const timeout = setTimeout(() => setMsg(''), 3500);
        return () => clearTimeout(timeout);
    }, [msg]);

    const requireBookingLogin = () => {
        setLoginReturnTab('booking');
        setMsg('Vui lòng đăng nhập để tiếp tục đặt vé.');
        setTab('login');
    };

    const props = {
        movies,
        dataLoading,
        dataError,
        onRetryData: () => setDataRetry((value) => value + 1),
        showtimes,
        foods,
        pointsPolicy,
        user,
        setUser: handleSetUser,
        selected,
        setSelected,
        setTab,
        setMsg,
        setPending,
        pending,
        searchFilter: searchQuery,
        onRequireBookingLogin: requireBookingLogin
    };

    let page;
    switch (tab) {
        case 'home':
            page = <Home {...props} />;
            break;
        case 'movies':
            page = <Movies {...props} />;
            break;
        case 'login':
            page = (
                <Login
                    {...props}
                    onCancelLogin={() => {
                        setLoginReturnTab('home');
                        setTab('home');
                    }}
                    onLoginSuccess={() => {
                        setTab(loginReturnTab);
                        setLoginReturnTab('home');
                    }}
                />
            );
            break;
        case 'booking':
            page = <Booking {...props} />;
            break;
        case 'movie-detail':
            page = <MovieDetail {...props} setSelected={setSelected} setTab={setTab} />;
            break;
        case 'payment':
            page = <Payment {...props} onDone={() => setTab('home')} />;
            break;
        case 'account':
            page = <Account {...props} initialSection={new URLSearchParams(location.search).get('section')} />;
            break;
        case 'create-account':
            page = <CreateAccount {...props} />;
            break;
        case 'update-status':
            page = <UpdateAccount {...props} />;
            break;
        case 'adjust-points':
            page = <AdjustPoints {...props} />;
            break;
        default:
            page = <Home {...props} />;
    }

    if (!canOpenTab(user?.role, tab)) {
        page = (
            <section className="page" role="alert">
                <h2>Bạn không có quyền sử dụng chức năng này</h2>
                <button type="button" className="primary" onClick={() => setTab('home')}>Về trang chủ</button>
            </section>
        );
    }

    return (
        <div className="app">
            <div className="app-shell">
                <Header tab={tab} setTab={setTab} user={user} onSearch={setSearchQuery} />
                <main className={`main-content ${tab !== 'home' ? 'subpage' : ''}`}>
                    {page}
                    {['employee','admin'].includes(user?.role) && <a href="/staff/tools">Tiếp nhận đơn online / Thu tiền tại quầy</a>}
                    {user?.role === 'admin' && (
                        <div className="adminNav">
                            <button onClick={() => navigate('/admin/showtimes')}>Quản lý suất chiếu</button>
                            <button onClick={() => setTab('create-account')}>Tạo tài khoản</button>
                            <button onClick={() => setTab('update-status')}>Trạng thái tài khoản</button>
                            <button onClick={() => setTab('adjust-points')}>Điều chỉnh điểm</button>
                        </div>
                    )}
                    {msg && <div className="toast">{msg}</div>}
                </main>
            </div>
        </div>
    );
}

