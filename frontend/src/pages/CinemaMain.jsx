import { useEffect, useState } from 'react';
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

export default function CinemaMain() {
    const { user: authUser, setUser: setAuthUser } = useAuth();
    const [movies, setMovies] = useState([]);
    const [showtimes, setShowtimes] = useState([]);
    const [foods, setFoods] = useState([]);
    const [user, setUser] = useState(authUser);
    const [selected, setSelected] = useState(null);
    const [pending, setPending] = useState(null);
    const [tab, setTab] = useState('home');
    const [loginReturnTab, setLoginReturnTab] = useState('home');
    const [msg, setMsg] = useState('');

    // Keep auth state synced with AuthContext
    useEffect(() => {
        setUser(authUser);
    }, [authUser]);

    const handleSetUser = (newUser) => {
        setUser(newUser);
        setAuthUser(newUser);
    };

    useEffect(() => {
        Promise.all([getMovies(), getShowtimes(), getFoods()])
            .then(([movieList, showtimeList, foodList]) => {
                setMovies(movieList);
                setShowtimes(showtimeList);
                setFoods(foodList);
            })
            .catch((error) => setMsg(error.message));

        const handleShowtimeSelection = (event) => setSelected(event.detail);
        window.addEventListener('select-showtime', handleShowtimeSelection);
        return () => window.removeEventListener('select-showtime', handleShowtimeSelection);
    }, []);

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
        showtimes,
        foods,
        user,
        setUser: handleSetUser,
        selected,
        setSelected,
        setTab,
        setMsg,
        setPending,
        pending,
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
            page = <Account {...props} />;
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

    return (
        <div className="app">
            <div className="app-shell">
                <Header tab={tab} setTab={setTab} user={user} />
                <main className="main-content">
                    {page}
                    {user?.role === 'admin' && (
                        <div className="adminNav">
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

