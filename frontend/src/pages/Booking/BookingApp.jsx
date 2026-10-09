import { useMemo, useState } from 'react';
import { createBooking } from '../../services/bookingService';

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

const flowSteps = ['Chọn rạp', 'Chọn suất chiếu', 'Chọn ghế', 'Thông tin', 'Thanh toán'];

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

export default function BookingApp({ user, selected, showtimes, foods, movies, setTab, setMsg, setPending }) {
    const [seat, setSeat] = useState([]);
    const [food, setFood] = useState([]);
    const [step, setStep] = useState(0);
    const [cinema, setCinema] = useState('');
    const [movieId, setMovieId] = useState(selected?.movie?._id || selected?._id || '');
    const [showtimeId, setShowtimeId] = useState(selected?._id || '');
    const [coupon, setCoupon] = useState('');
    const [customerInfo, setCustomerInfo] = useState({
        fullName: user?.fullName || '',
        email: user?.email || '',
        phone: user?.phone || ''
    });

    const cinemaOptions = useMemo(() => [...new Set(showtimes.map((s) => s.cinema).filter(Boolean))], [showtimes]);

    const moviesForCinema = useMemo(() => {
        if (!cinema) return [];
        const ids = new Set(
            showtimes
                .filter((s) => s.cinema === cinema)
                .map((s) => String(s.movie?._id || s.movie))
                .filter(Boolean)
        );

        return movies.filter((movie) => ids.has(String(movie._id)));
    }, [cinema, movies, showtimes]);

    const currentMovie = useMemo(() => {
        if (!movieId) return null;
        return movies.find((movie) => String(movie._id) === String(movieId)) || null;
    }, [movieId, movies]);

    const currentShowtime = useMemo(() => {
        if (!showtimeId) return null;
        return showtimes.find((s) => s._id === showtimeId) || null;
    }, [showtimeId, showtimes]);

    const subtotal = (currentShowtime?.price || 0) * seat.length + food.reduce((sum, item) => sum + (item.price || 0), 0);
    const totalAfterCoupon = coupon === 'CINEMA10' ? Math.max(0, subtotal - 50000) : subtotal;

    function getMovieShowtimes(movie) {
        if (!cinema) return [];
        return showtimes.filter((s) => {
            const movieIdValue = s.movie?._id || s.movie;
            return s.cinema === cinema && String(movieIdValue) === String(movie._id);
        });
    }

    function isSeatInvalid(seatNumber) {
        const allSeats = currentShowtime?.seats || [];
        const usableSeats = allSeats
            .filter((s) => s.status === 'available' || s.status === 'vip')
            .map((s) => s.number)
            .sort((a, b) => a - b);

        const selectedSeats = [...seat, seatNumber].sort((a, b) => a - b);
        const remainingSeats = usableSeats.filter((number) => !selectedSeats.includes(number));

        for (const number of remainingSeats) {
            const index = usableSeats.indexOf(number);
            const left = usableSeats[index - 1];
            const right = usableSeats[index + 1];

            if (index === 0 || index === usableSeats.length - 1) {
                const hasOtherSeat = index === 0 ? selectedSeats.includes(right) : selectedSeats.includes(left);
                if (hasOtherSeat) return true;
            }

            if (left !== undefined && right !== undefined && selectedSeats.includes(left) && selectedSeats.includes(right)) {
                return true;
            }
        }

        return false;
    }

    function handleSeatClick(s) {
        if (s.status !== 'available' && s.status !== 'vip') return;

        if (seat.includes(s.number)) {
            setSeat((prev) => prev.filter((x) => x !== s.number));
            return;
        }

        if (isSeatInvalid(s.number)) {
            setMsg('Không thể chừa một ghế ở giữa hoặc ở đầu hàng.');
            return;
        }

        setSeat((prev) => [...prev, s.number]);
    }

    function goNext() {
        if (step === 0 && !cinema) {
            setMsg('Vui lòng chọn rạp chiếu.');
            return;
        }
        if (step === 1 && !showtimeId) {
            setMsg('Vui lòng chọn suất chiếu.');
            return;
        }
        if (step === 2 && !seat.length) {
            setMsg('Vui lòng chọn ít nhất một ghế.');
            return;
        }
        if (step === 3 && (!customerInfo.fullName || !customerInfo.phone)) {
            setMsg('Vui lòng nhập tên và số điện thoại khách hàng.');
            return;
        }

        setStep((prev) => Math.min(prev + 1, flowSteps.length - 1));
    }

    function goBack() {
        setStep((prev) => Math.max(prev - 1, 0));
    }

    async function book() {
        if (!user || !currentShowtime || !seat.length) {
            setMsg('Vui lòng đăng nhập, chọn suất chiếu và ít nhất một ghế.');
            return;
        }

        try {
            const booking = await createBooking({
                userId: user._id,
                showtimeId: currentShowtime._id,
                seats: seat,
                foodItems: food.map((x) => ({ food: x._id, quantity: 1 }))
            });

            setPending(booking);
            setMsg(`Đặt vé thành công: ${booking._id}. Ghế được giữ trong 10 phút.`);
            setTab('payment');
        } catch (error) {
            setMsg(error.message);
        }
    }

    return (
        <section className="page">
            <h2>Đặt vé trên app</h2>
            <div className="booking">
                <div className="bookingFlow">
                    {flowSteps.map((label, index) => (
                        <button
                            key={label}
                            type="button"
                            className={step === index ? 'activeStep' : index < step ? 'doneStep' : ''}
                            onClick={() => setStep(index)}
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
                                        setStep(1);
                                    }}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
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
                                                    {movie.ageLimit || 18}+ • {movie.genre?.join(', ') || 'Phim'} • {movie.duration || 120} phút
                                                </p>
                                                <button
                                                    type="button"
                                                    className="detailBtn"
                                                    onClick={() => {
                                                        setMovieId(movie._id);
                                                        setTab('movie-detail');
                                                    }}
                                                >
                                                    Chi tiết phim
                                                </button>
                                            </div>
                                        </div>

                                        <div className="showtimeGrid">
                                            {movieShowtimes.map((showtime) => (
                                                <button
                                                    key={showtime._id}
                                                    type="button"
                                                    className={showtimeId === showtime._id ? 'showtimeBtn selected' : 'showtimeBtn'}
                                                    onClick={() => {
                                                        setMovieId(movie._id);
                                                        setShowtimeId(showtime._id);
                                                        setStep(2);
                                                    }}
                                                >
                                                    <span>{new Date(showtime.startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    <small>{showtime.room}</small>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {step === 2 && currentShowtime && (
                    <div className="checkoutSection">
                        <h3>3. Chọn ghế ngồi</h3>
                        <div className="seatLegend">
                            <div><span className="legendSeat available"></span>Ghế trống</div>
                            <div><span className="legendSeat booked"></span>Ghế đã đặt</div>
                            <div><span className="legendSeat broken"></span>Ghế hỏng</div>
                            <div><span className="legendSeat vip"></span>Ghế VIP</div>
                            <div><span className="legendSeat chosen"></span>Đang chọn</div>
                        </div>
                        <div className="screen">SCREEN</div>
                        <div className="seats">
                            {currentShowtime.seats?.map((s) => {
                                let seatClass = 'seat';
                                if (s.status === 'booked') seatClass += ' booked';
                                else if (s.status === 'broken') seatClass += ' broken';
                                else if (s.status === 'vip') seatClass += ' vip';
                                else seatClass += ' available';

                                if (seat.includes(s.number)) seatClass += ' chosen';

                                return (
                                    <button
                                        key={s.number}
                                        type="button"
                                        disabled={s.status !== 'available' && s.status !== 'vip'}
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

                {step === 3 && (
                    <div className="checkoutSection">
                        <h3>4. Kiểm tra thông tin khách hàng</h3>
                        <div className="checkoutForm">
                            <input
                                value={customerInfo.fullName}
                                onChange={(e) => setCustomerInfo((prev) => ({ ...prev, fullName: e.target.value }))}
                                placeholder="Họ tên khách hàng"
                            />
                            <input
                                value={customerInfo.phone}
                                onChange={(e) => setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))}
                                placeholder="Số điện thoại"
                            />
                            <input
                                value={customerInfo.email}
                                onChange={(e) => setCustomerInfo((prev) => ({ ...prev, email: e.target.value }))}
                                placeholder="Email"
                            />
                        </div>
                        <div className="couponBox">
                            <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Mã giảm giá (nếu có)" />
                            <button type="button" onClick={() => setCoupon('CINEMA10')}>Áp dụng</button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="checkoutSection">
                        <h3>5. Thanh toán</h3>
                        <div className="summaryCard">
                            <p><strong>Phim:</strong> {currentMovie?.title || 'Chưa chọn phim'}</p>
                            <p><strong>Rạp:</strong> {currentShowtime?.cinema || cinema}</p>
                            <p><strong>Suất chiếu:</strong> {currentShowtime ? new Date(currentShowtime.startTime).toLocaleString('vi-VN') : 'Chưa chọn'}</p>
                            <p><strong>Ghế:</strong> {seat.join(', ') || 'Chưa chọn'}</p>
                            <p><strong>Bắp nước:</strong> {food.length ? food.map((f) => f.name).join(', ') : 'Không có'}</p>
                            <p><strong>Tổng tạm tính:</strong> {subtotal.toLocaleString()}₫</p>
                            <p><strong>Giảm giá:</strong> {coupon === 'CINEMA10' ? '50.000₫' : '0₫'}</p>
                            <p><strong>Thành tiền:</strong> {totalAfterCoupon.toLocaleString()}₫</p>
                        </div>

                        <div className="food">
                            {foods.map((f) => {
                                const isChosen = food.some((x) => x._id === f._id);
                                return (
                                    <button
                                        key={f._id}
                                        type="button"
                                        className={isChosen ? 'foodItem chosen' : 'foodItem'}
                                        onClick={() =>
                                            setFood((x) =>
                                                x.some((a) => a._id === f._id)
                                                    ? x.filter((a) => a._id !== f._id)
                                                    : [...x, f]
                                            )
                                        }
                                    >
                                        {foodImages[f.name] && <img src={foodImages[f.name]} alt={f.name} />}
                                        <span>{f.name}</span>
                                        <b>{f.price?.toLocaleString()}₫</b>
                                    </button>
                                );
                            })}
                        </div>

                        <button type="button" className="primary full" onClick={book}>Thanh toán ngay</button>
                    </div>
                )}

                <div className="bookingActions">
                    {step > 0 && (
                        <button type="button" className="ghost" onClick={goBack}>Quay lại</button>
                    )}
                    {step < flowSteps.length - 1 && (
                        <button type="button" className="primary" onClick={goNext}>Tiếp tục</button>
                    )}
                </div>
            </div>
        </section>
    );
}
