import FoodPicker from '../../components/FoodPicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createCounterBooking, searchMembers } from '../../services/counterService';
import { translateFoodName, translateGenre } from '../../utils/uiText';
import { isAvailableSeat, orphanSeatMessage } from '../../../../shared/seatSelection.mjs';

import alice from '../../assets/posters/alice_in_borderland.jpg';
import usDead from '../../assets/posters/all_of_us_are_dead.jpg';
import attack from '../../assets/posters/attack_on_titan.jpg';
import avatar from '../../assets/posters/avatar_fire_and_ash.jpg';
import dune from '../../assets/posters/dune.jpg';
import fourHands from '../../assets/posters/four_hands.jpg';
import harry from '../../assets/posters/harry_potter.jpg';
import wishes from '../../assets/posters/if_wishes_could_kill.jpg';
import joker from '../../assets/posters/joker.jpg';
import stranger from '../../assets/posters/stranger_things.jpg';
import batman from '../../assets/posters/the_batman.jpg';
import narnia from '../../assets/posters/the_chronicles_of_narnia.jpg';
import flood from '../../assets/posters/the_great_flood.jpg';
import kitchen from '../../assets/posters/the_legend_of_kitchen_soldier.jpg';
import maze from '../../assets/posters/the_maze_runner.jpg';
import venom from '../../assets/posters/venom.jpg';
import wednesday from '../../assets/posters/wednesday.jpg';

import cocaCola from '../../assets/foods/coca_cola.png';
import comboCouple from '../../assets/foods/combo_couple.png';
import comboFamily from '../../assets/foods/combo_family.png';
import comboFriends from '../../assets/foods/combo_friends.png';
import comboMini from '../../assets/foods/combo_mini.png';
import comboVip from '../../assets/foods/combo_vip.png';
import dasani from '../../assets/foods/dasani.png';
import fanta from '../../assets/foods/fanta.png';
import pepsi from '../../assets/foods/pepsi.png';
import popcornCaramel from '../../assets/foods/popcorn_caramel.png';
import popcornCheese from '../../assets/foods/popcorn_cheese.png';
import popcornLarge from '../../assets/foods/popcorn_large.png';
import popcornMedium from '../../assets/foods/popcorn_medium.png';
import popcornMix from '../../assets/foods/popcorn_mix.png';
import popcornSmall from '../../assets/foods/popcorn_small.png';
import sprite from '../../assets/foods/sprite.png';

const foodImages = {
    'Coca Cola': cocaCola,
    'Combo Couple': comboCouple,
    'Combo Family': comboFamily,
    'Combo Friends': comboFriends,
    'Combo Mini': comboMini,
    'Combo VIP': comboVip,
    'Dasani': dasani,
    'Fanta': fanta,
    'Pepsi': pepsi,
    'Popcorn Caramel': popcornCaramel,
    'Popcorn Cheese': popcornCheese,
    'Popcorn Large': popcornLarge,
    'Popcorn Medium': popcornMedium,
    'Popcorn Mix': popcornMix,
    'Popcorn Small': popcornSmall,
    'Sprite': sprite
};

const flowSteps = ['Chọn rạp', 'Chọn suất chiếu', 'Chọn ghế', 'Thông tin', 'Xác nhận đơn'];

const posterMap = {
    'if wishes could kill': wishes,
    'four hands': fourHands,
    'the legend of kitchen soldier': kitchen,
    'the great flood': flood,
    'alice in borderland': alice,
    'all of us are dead': usDead,
    'stranger things': stranger,
    'wednesday': wednesday,
    'the chronicles of narnia': narnia,
    'the maze runner': maze,
    'venom': venom,
    'dune': dune,
    'joker': joker,
    'the batman': batman,
    'attack on titan': attack,
    'harry potter': harry,
    'avatar fire and ash': avatar
};

function getPoster(movie) {
    if (!movie) return '';
    if (typeof movie.poster === 'string' && movie.poster.startsWith('http')) return movie.poster;

    const title = String(movie.title || '').trim().toLowerCase();
    const source = posterMap[title] || posterMap[title.replace(/[^a-z0-9\s]/g, '').trim()] || movie.poster;
    return source || '';
}

function classificationLabel(movie) {
    if (movie?.classification) return movie.classification;
    if (Number(movie?.ageLimit) > 0) return `${movie.ageLimit}+`;
    return 'Chưa có phân loại';
}

function isSaleableShowtime(showtime, movie, now) {
    const publishedMovie = typeof showtime.movie === 'object' ? showtime.movie : null;
    return movie && !movie.deletedAt && movie.classification !== 'C' &&
        !publishedMovie?.deletedAt && publishedMovie?.classification !== 'C' &&
        new Date(showtime.startTime).getTime() > now &&
        Number.isSafeInteger(showtime.price) && showtime.price > 0;
}

export default function BookingCounter({ user, selected, showtimes, foods, movies, pointsPolicy, setSelected, setTab, setMsg, setPending, onRefreshShowtimes }) {
    const normalizedRole = String(user?.role || '').toLowerCase();
    const [seat, setSeat] = useState([]);
    const [food, setFood] = useState([]);
    const [guardianConfirmed, setGuardianConfirmed] = useState(false);
    const [step, setStep] = useState(selected?.startTime ? 2 : 0);
    const [cinema, setCinema] = useState(selected?.cinema || '');
    const [movieId, setMovieId] = useState(selected?.movie?._id || selected?._id || '');
    const [showtimeId, setShowtimeId] = useState(selected?._id || '');
    const [pointsToUse, setPointsToUse] = useState(0);
    const [bookingBusy, setBookingBusy] = useState(false);
    const [clock, setClock] = useState(Date.now());
    const [availabilityError, setAvailabilityError] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [memberResults, setMemberResults] = useState(null);
    const [memberSearchBusy, setMemberSearchBusy] = useState(false);
    const [memberError, setMemberError] = useState('');
    const memberRequest = useRef(null);
    const [customerType, setCustomerType] = useState('guest');
    const [customerInfo, setCustomerInfo] = useState({
        fullName: '',
        email: '',
        phone: ''
    });

    const pointsBalance = Number(selectedMember?.memberPoints || 0);
    useEffect(() => () => memberRequest.current?.abort(), []);
    useEffect(() => {
        const timer = window.setInterval(() => setClock(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const saleableShowtimes = useMemo(() => showtimes.filter(showtime => {
        const movieId = String(showtime.movie?._id || showtime.movie);
        const movie = movies.find(item => String(item._id) === movieId);
        return isSaleableShowtime(showtime, movie, clock);
    }).sort((left, right) => new Date(left.startTime) - new Date(right.startTime)), [showtimes, movies, clock]);
    const cinemaOptions = useMemo(() => [...new Set(saleableShowtimes.map(s => s.cinema).filter(Boolean))], [saleableShowtimes]);

    const moviesForCinema = useMemo(() => {
        if (!cinema) return [];
        const ids = new Set(
            saleableShowtimes
                .filter((s) => s.cinema === cinema)
                .map((s) => String(s.movie?._id || s.movie))
                .filter(Boolean)
        );

        return movies.filter((movie) => ids.has(String(movie._id)));
    }, [cinema, movies, saleableShowtimes]);

    const currentShowtime = useMemo(() => {
        if (!showtimeId) return null;
        return showtimes.find((s) => String(s._id) === String(showtimeId)) || null;
    }, [showtimeId, showtimes]);

    const currentMovie = useMemo(() => {
        const movie = movies.find(item => String(item._id) === String(movieId));
        if (!movie) return null;
        const latestMovie = currentShowtime?.movie;
        return latestMovie && typeof latestMovie === 'object' && String(latestMovie._id) === String(movieId)
            ? { ...movie, ...latestMovie } : movie;
    }, [movieId, movies, currentShowtime]);

    useEffect(() => {
        setSeat(current => current.filter(number => currentShowtime?.seats?.some(item => item.number === number && isAvailableSeat(item))));
    }, [currentShowtime]);

    const subtotal = (currentShowtime?.price || 0) * seat.length + food.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const pointStep = pointsPolicy?.pointRedeemStep || 100;
    const maxPoints = Math.floor(Math.min(pointsBalance, Math.floor(subtotal / 1000)) / pointStep) * pointStep;
    const pointsDiscount = Number(pointsToUse || 0) * 1000;
    const finalTotal = Math.max(0, subtotal - pointsDiscount);

    function clearMemberSelection(query = '') {
        memberRequest.current?.abort();
        setMemberSearch(query); setSelectedMember(null); setMemberResults(null);
        setMemberError(''); setMemberSearchBusy(false); setPointsToUse(0);
        setCustomerInfo({ fullName: '', email: '', phone: '' });
    }

    async function findMember() {
        memberRequest.current?.abort();
        const controller = new AbortController(); memberRequest.current = controller;
        setMemberSearchBusy(true); setMemberError(''); setMemberResults(null);
        setSelectedMember(null); setPointsToUse(0); setCustomerInfo({ fullName: '', email: '', phone: '' });
        try {
            const results = await searchMembers(memberSearch.trim(), controller.signal);
            if (!Array.isArray(results)) throw new Error('Không thể đọc kết quả tra cứu. Vui lòng thử lại.');
            if (!controller.signal.aborted) setMemberResults(results);
        } catch (error) {
            if (!controller.signal.aborted) setMemberError(error.message);
        } finally { if (!controller.signal.aborted) setMemberSearchBusy(false); }
    }

    if (!user || !['admin', 'employee'].includes(normalizedRole)) {
        return (
            <section className="page">
                <h2>Không có quyền đặt vé tại quầy</h2>
                <p>Chỉ Admin và Employee được phép bán vé trực tiếp tại quầy.</p>
                <button type="button" className="primary" onClick={() => setTab('booking')}>
                    Về đặt vé trên app
                </button>
            </section>
        );
    }

    function getMovieShowtimes(movie) {
        if (!cinema) return [];
        return saleableShowtimes.filter((s) => {
            const movieIdValue = s.movie?._id || s.movie;
            return s.cinema === cinema && String(movieIdValue) === String(movie._id);
        });
    }

    function handleSeatClick(s) {
        if (bookingBusy || availabilityError || !currentShowtime || !isSaleableShowtime(currentShowtime, currentMovie, Date.now())) return;
        if (s.status !== 'available' || (s.condition && s.condition !== 'Active')) return;
        setSeat(current => current.includes(s.number)
            ? current.filter(number => number !== s.number)
            : [...current, s.number]);
    }

    function validateBefore(targetStep) {
        if (targetStep > 0 && !cinema) {
            setMsg('Vui lòng chọn rạp chiếu.');
            setStep(0);
            return false;
        }
        if (targetStep > 1 && (!currentShowtime || !currentMovie ||
            currentShowtime.cinema !== cinema || String(currentShowtime.movie?._id || currentShowtime.movie) !== String(movieId) ||
            !isSaleableShowtime(currentShowtime, currentMovie, Date.now()))) {
            setMsg('Vui lòng chọn phim và suất chiếu còn mở bán.');
            setStep(1);
            return false;
        }
        if (targetStep > 2 && (availabilityError || !seat.length ||
            !seat.every(number => currentShowtime.seats?.some(item => item.number === number && isAvailableSeat(item))))) {
            setMsg(availabilityError || 'Vui lòng chọn ít nhất một ghế còn khả dụng.');
            setStep(2);
            return false;
        }
        if (targetStep > 2) {
            const seatError = orphanSeatMessage(currentShowtime.seats, seat);
            if (seatError) {
                setMsg(seatError);
                setStep(2);
                return false;
            }
        }
        if (targetStep > 3) {
            if (customerType === 'member' && !selectedMember) {
                setMsg('Vui lòng tìm và chọn thành viên đang hoạt động.');
                setStep(3);
                return false;
            }
            if (!Number.isSafeInteger(Number(pointsToUse)) || Number(pointsToUse) < 0 || Number(pointsToUse) % pointStep !== 0 || Number(pointsToUse) > maxPoints) {
                setMsg('Số điểm thưởng không được vượt quá điểm hiện có của khách hàng.');
                setStep(3);
                return false;
            }
        }
        return true;
    }

    function goToStep(targetStep) {
        if (bookingBusy) return;
        if (targetStep > step && !validateBefore(targetStep)) return;
        setStep(targetStep);
    }

    async function refreshAvailability(message) {
        try {
            const latest = await onRefreshShowtimes();
            if (!Array.isArray(latest)) throw new Error('Invalid showtime response');
            const updated = latest.find(item => String(item._id) === String(showtimeId));
            if (!updated || updated.cinema !== cinema ||
                String(updated.movie?._id || updated.movie) !== String(movieId) ||
                !isSaleableShowtime(updated, currentMovie, Date.now())) {
                setSeat([]);
                setShowtimeId('');
                setStep(1);
                setMsg(`${message} Vui lòng chọn suất chiếu khác.`);
            } else {
                setSeat(current => current.filter(number => updated.seats?.some(item => item.number === number && isAvailableSeat(item))));
                setStep(2);
                setMsg(`${message} Đã tải lại ghế và giá mới nhất; vui lòng kiểm tra lựa chọn.`);
            }
            setAvailabilityError('');
        } catch {
            setStep(2);
            setAvailabilityError('Chưa tải lại được sơ đồ ghế. Vui lòng thử lại trước khi tiếp tục.');
            setMsg(message);
        }
    }

    async function retryAvailability() {
        if (bookingBusy) return;
        setBookingBusy(true);
        try { await refreshAvailability('Đang kiểm tra lại ghế.'); }
        finally { setBookingBusy(false); }
    }

    async function book() {
        if (bookingBusy) return;
        if (!validateBefore(4)) return;
        setBookingBusy(true);
        try {
            const booking = await createCounterBooking({
                customerType,
                memberId: customerType === 'member' ? selectedMember?._id : null,
                points: Number(pointsToUse),
                guardianConfirmed,
                showtimeId: currentShowtime._id,
                seats: seat,
                foodItems: food.map((x) => ({ food: x._id, quantity: x.quantity || 1 }))
            });

            setPending(booking);
            setMsg(`Đặt vé tại quầy thành công: ${booking._id}.`);
            setTab('payment');
        } catch (error) {
            if ([404, 409, 410].includes(error.status)) await refreshAvailability(error.message);
            else setMsg(error.message);
        } finally {
            setBookingBusy(false);
        }
    }

    return (
        <section className="page counterBooking">
            <button type="button" className="ghost staffBackButton" disabled={bookingBusy} onClick={() => setTab('account')}>← Về hồ sơ & tác vụ</button>
            <h2>Đặt vé tại quầy</h2>
            <p className="helperText">Bạn có thể áp dụng mã khuyến mãi ở bước thanh toán, sau khi tạo đơn giữ ghế.</p>
            {availabilityError && <div role="alert"><p>{availabilityError}</p><button type="button" className="ghost" disabled={bookingBusy} onClick={retryAvailability}>Tải lại sơ đồ ghế</button></div>}
            <div className="booking">
                <div className="bookingFlow">
                    {flowSteps.map((label, index) => (
                        <button
                            key={label}
                            type="button"
                            className={step === index ? 'activeStep' : index < step ? 'doneStep' : ''}
                            disabled={bookingBusy}
                            aria-current={step === index ? 'step' : undefined}
                            onClick={() => goToStep(index)}
                        >
                            {index + 1}. {label}
                        </button>
                    ))}
                </div>

                {step === 0 && (
                    <div className="checkoutSection">
                        <h3>1. Chọn rạp chiếu</h3>
                        <div className="selectorGrid cinemaGrid">
                            {cinemaOptions.map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={cinema === option ? 'selector selected' : 'selector'}
                                    onClick={() => {
                                        setCinema(option);
                                        setMovieId('');
                                        setShowtimeId('');
                                        setSeat([]);
                                        setAvailabilityError('');
                                        setStep(1);
                                    }}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                        {cinemaOptions.length === 0 && <p role="status">Chưa có suất chiếu còn mở bán.</p>}
                    </div>
                )}

                {step === 1 && cinema && (
                    <div className="checkoutSection">
                        <h3>2. Danh sách phim tại {cinema}</h3>
                        <div className="cinemaMovieList">
                            {moviesForCinema.map((movie) => {
                                const movieShowtimes = getMovieShowtimes(movie);
                                return (
                                    <div key={movie._id} className="movieScheduleCard">
                                        <div className="movieScheduleHeader">
                                            <img src={getPoster(movie)} alt={movie.title} className="moviePoster" />
                                            <div className="movieScheduleInfo">
                                                <h4>{movie.title}</h4>
                                                <p className="movieMeta">
                                                    <strong className="counterClassification" aria-label={`Phân loại ${classificationLabel(movie)}`}>{classificationLabel(movie)}</strong> • {movie.genre?.map(translateGenre).join(', ') || 'Phim'} • {movie.duration || 120} phút
                                                </p>
                                                <button
                                                    type="button"
                                                    className="detailBtn"
                                                    onClick={() => {
                                                        setMovieId(movie._id);
                                                        setSelected(movie);
                                                        setTab('movie-detail');
                                                    }}
                                                >
                                                    Chi tiết phim
                                                </button>
                                            </div>
                                        </div>

                                        <div className="showtimeGrid">
                                            {movieShowtimes.map((showtime) => {
                                                const freeSeats = (showtime.seats || []).filter(isAvailableSeat).length;
                                                return (
                                                <button
                                                    key={showtime._id}
                                                    type="button"
                                                    className={showtimeId === showtime._id ? 'showtimeBtn selected' : 'showtimeBtn'}
                                                    disabled={bookingBusy || freeSeats === 0}
                                                    onClick={() => {
                                                        setMovieId(movie._id);
                                                        setShowtimeId(showtime._id);
                                                        setSeat([]);
                                                        setGuardianConfirmed(false);
                                                        setAvailabilityError('');
                                                        setStep(2);
                                                    }}
                                                >
                                                    <span>{new Date(showtime.startTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })}</span>
                                                    <small>{showtime.room}</small>
                                                    <small>{freeSeats ? `Còn ${freeSeats} ghế` : 'Hết ghế'}</small>
                                                    <small>{showtime.price.toLocaleString('vi-VN')}₫ / vé</small>
                                                </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {moviesForCinema.length === 0 && <p role="status">Rạp này chưa có suất chiếu còn mở bán. Vui lòng chọn rạp khác.</p>}
                    </div>
                )}

                {step === 2 && currentShowtime && (
                    <div className="checkoutSection">
                        <h3>3. Chọn ghế ngồi</h3>
                        <p className="helperText"><strong className="counterClassification">{classificationLabel(currentMovie)}</strong> {currentMovie?.title} · {currentShowtime.room} · {new Date(currentShowtime.startTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {Number(currentShowtime.price || 0).toLocaleString('vi-VN')}₫ / vé</p>
                        {!isSaleableShowtime(currentShowtime, currentMovie, clock) && <p role="alert">Suất chiếu không còn mở bán. Vui lòng quay lại chọn suất khác.</p>}
                        <div className="seatLegend">
                            <div><span className="legendSeat available"></span>Ghế trống</div>
                            <div><span className="legendSeat booked"></span>Ghế đã đặt</div>
                            <div><span className="legendSeat broken"></span>Ghế hỏng</div>
                            <div><span className="legendSeat vip"></span>Ghế VIP</div>
                            <div><span className="legendSeat chosen"></span>Đang chọn</div>
                        </div>
                        <div className="screen">MÀN HÌNH</div>
                        <p className="helperText">Không tạo ghế trống lẻ giữa hàng. Được phép chừa một ghế ở đầu/cuối hàng.</p>
                        <div className="seats">
                            {currentShowtime.seats?.map((s) => {
                                let seatClass = 'seat';
                                if (s.status === 'booked') seatClass += ' booked';
                                else if (s.condition && s.condition !== 'Active') seatClass += ' broken';
                                else if (s.type === 'VIP') seatClass += ' vip';
                                else seatClass += ' available';

                                if (seat.includes(s.number)) seatClass += ' chosen';

                                return (
                                    <button
                                        key={s.number}
                                        type="button"
                                        disabled={bookingBusy || !!availabilityError || !isSaleableShowtime(currentShowtime, currentMovie, clock) || !isAvailableSeat(s)}
                                        aria-label={`${s.number}, ${s.type || 'Standard'}, ${s.condition || 'Active'}, ${s.status}`}
                                        className={seatClass}
                                        onClick={() => handleSeatClick(s)}
                                    >
                                        {s.number}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {step === 2 && !currentShowtime && <p role="alert">Suất chiếu không còn trong danh sách. Vui lòng quay lại chọn suất khác.</p>}

                {step === 3 && (
                    <div className="checkoutSection">
                        <h3>4. Chọn loại khách hàng</h3>
                        <fieldset disabled={bookingBusy}>
                            <legend>Thông tin Member là tùy chọn</legend>
                            {['guest', 'member'].map((type) => <label key={type} style={{ marginRight: '20px' }}>
                                <input type="radio" name="counterCustomerType" value={type} checked={customerType === type}
                                    onChange={() => { setCustomerType(type); clearMemberSelection(); }} />
                                {type === 'guest' ? 'Khách vãng lai — không cung cấp thông tin' : 'Member — có sử dụng điểm'}
                            </label>)}
                        </fieldset>
                        {customerType === 'guest' && <p>Không cần tên, email, số điện thoại hoặc tài khoản. Khách không sử dụng điểm Member; nhận vé ngay tại quầy sau khi thanh toán.</p>}
                        {customerType === 'member' && (
                        <div className="checkoutForm">
                            <input
                                aria-label="Email hoặc số điện thoại thành viên"
                                value={memberSearch}
                                onChange={(event) => clearMemberSelection(event.target.value)}
                                placeholder="Email hoặc số điện thoại thành viên"
                            />
                            <button type="button" className="ghost" disabled={memberSearchBusy || !memberSearch.trim()} onClick={findMember}>{memberSearchBusy ? 'Đang tìm…' : 'Tìm thành viên'}</button>
                            {memberError && <p className="paymentError" role="alert">{memberError}</p>}
                            {memberResults && <div aria-label="Chọn thành viên">
                                <p className="helperText" role="status">{memberResults.length ? 'Chọn đúng tài khoản của khách. Nếu trùng số điện thoại, đối chiếu email trước khi dùng điểm.' : 'Không tìm thấy thành viên phù hợp.'}</p>
                                <div className="selectorGrid">{memberResults.map(member => <button key={member._id} type="button"
                                    className={selectedMember?._id === member._id ? 'selector selected' : 'selector'}
                                    aria-pressed={selectedMember?._id === member._id}
                                    disabled={!['Active', 'active'].includes(member.status)}
                                    onClick={() => { setSelectedMember(member); setCustomerInfo(member); setPointsToUse(0); }}>
                                    {member.fullName} · {member.email} · {member.phone || 'Chưa có số điện thoại'}
                                    {!['Active', 'active'].includes(member.status) && ' · Tài khoản không hoạt động'}
                                </button>)}</div>
                            </div>}
                            <input
                                value={customerInfo.fullName || ''}
                                readOnly
                                placeholder="Họ tên khách hàng"
                            />
                            <input
                                value={customerInfo.phone || ''}
                                readOnly
                                placeholder="Số điện thoại"
                            />
                            <input
                                value={customerInfo.email || ''}
                                readOnly
                                placeholder="Địa chỉ email"
                            />
                            <div className="pointBox">
                                <input
                                    type="number"
                                    min="0"
                                    max={maxPoints}
                                    step={pointStep}
                                    disabled={!selectedMember}
                                    value={pointsToUse}
                                    onChange={(e) => setPointsToUse(Math.max(0, Number(e.target.value) || 0))}
                                    placeholder="Điểm thưởng"
                                />
                                <button type="button" disabled={!selectedMember} onClick={() => setPointsToUse(maxPoints)}>
                                    Dùng tối đa ({maxPoints})
                                </button>
                            </div>
                            <p className="helperText">Điểm hiện có: <strong>{pointsBalance}</strong> điểm • 1 điểm = 1.000₫</p>
                        </div>

                        )}
                    </div>
                )}

                {step === 4 && (
                    <div className="checkoutSection">
                        <h3>5. Xác nhận đơn trước khi giữ ghế</h3>
                        <div className="summaryCard">
                            <p><strong>Khách hàng:</strong> {customerType === 'guest' ? 'Khách vãng lai' : customerInfo.fullName || 'Chưa chọn Member'}</p>
                            {customerType === 'member' && <p><strong>Số điện thoại:</strong> {customerInfo.phone || 'Không có'}</p>}
                            <p><strong>Phim:</strong> {currentMovie?.title || 'Chưa chọn phim'}</p>
                            <p><strong>Rạp:</strong> {currentShowtime?.cinema || cinema}</p>
                            <p><strong>Suất chiếu:</strong> {currentShowtime ? new Date(currentShowtime.startTime).toLocaleString('vi-VN') : 'Chưa chọn'}</p>
                            <p><strong>Ghế:</strong> {seat.join(', ') || 'Chưa chọn'}</p>
                            <p><strong>Bắp nước:</strong> {food.length ? food.map((f) => translateFoodName(f.name)).join(', ') : 'Không gọi thêm'}</p>
                            <p><strong>Điểm thưởng:</strong> {pointsToUse.toLocaleString()} điểm (-{pointsDiscount.toLocaleString()}₫)</p>
                            <p><strong>Tổng tạm tính:</strong> {subtotal.toLocaleString()}₫</p>
                            <p><strong>Thành tiền:</strong> {finalTotal.toLocaleString()}₫</p>
                        </div>

                        <FoodPicker foods={foods} items={food} onChange={setFood} />

                        {(['K', 'T13', 'T16', 'T18'].includes(currentMovie?.classification) || currentMovie?.ageLimit > 0) && <label style={{display:'block',margin:'18px 0'}}><input type="checkbox" checked={guardianConfirmed} onChange={event=>setGuardianConfirmed(event.target.checked)} /> Tôi đã kiểm tra tuổi khách và điều kiện người giám hộ theo phân loại phim.</label>}
                        <button type="button" className="primary full" onClick={book} disabled={bookingBusy}>{bookingBusy ? 'Đang giữ ghế…' : 'Giữ ghế & tiếp tục thanh toán'}</button>
                    </div>
                )}

                <div className="bookingActions">
                    {step > 0 && (
                        <button type="button" className="ghost" disabled={bookingBusy} onClick={() => goToStep(Math.max(0, step - 1))}>Quay lại</button>
                    )}
                    {step < flowSteps.length - 1 && (
                        <button type="button" className="primary" disabled={bookingBusy} onClick={() => goToStep(step + 1)}>Tiếp tục</button>
                    )}
                </div>
            </div>
        </section>
    );
}
