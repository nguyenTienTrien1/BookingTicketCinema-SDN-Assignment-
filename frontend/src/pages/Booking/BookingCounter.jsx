import FoodPicker from '../../components/FoodPicker';
import { useEffect, useMemo, useState } from 'react';
import { createCounterBooking, searchMembers } from '../../services/counterService';
import { translateFoodName, translateGenre } from '../../utils/uiText';

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

export default function BookingCounter({ user, selected, showtimes, foods, movies, pointsPolicy, setTab, setMsg, setPending }) {
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
    const [memberSearch, setMemberSearch] = useState('');
    const [selectedMember, setSelectedMember] = useState(null);
    const [customerType, setCustomerType] = useState('guest');
    const [customerInfo, setCustomerInfo] = useState({
        fullName: '',
        email: '',
        phone: ''
    });

    const pointsBalance = Number(selectedMember?.memberPoints || 0);
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

    useEffect(() => {
        if (!currentShowtime) return;
        setSeat(current => current.filter(number => currentShowtime.seats.some(item => item.number === number && item.status === 'available' && (!item.condition || item.condition === 'Active'))));
    }, [currentShowtime]);

    const subtotal = (currentShowtime?.price || 0) * seat.length + food.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
    const pointStep = pointsPolicy?.pointRedeemStep || 100;
    const maxPoints = Math.floor(Math.min(pointsBalance, Math.floor(subtotal / 1000)) / pointStep) * pointStep;
    const pointsDiscount = Number(pointsToUse || 0) * 1000;
    const finalTotal = Math.max(0, subtotal - pointsDiscount);

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
        return showtimes.filter((s) => {
            const movieIdValue = s.movie?._id || s.movie;
            return s.cinema === cinema && String(movieIdValue) === String(movie._id);
        });
    }

    function isSeatInvalid(seatNumber) {
        const allSeats = currentShowtime?.seats || [];
        const usableSeats = allSeats
            .filter((s) => s.status === 'available' && (!s.condition || s.condition === 'Active'))
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
        if (s.status !== 'available' || (s.condition && s.condition !== 'Active')) return;

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
        if (step === 3) {
            if (customerType === 'member' && !selectedMember) {
                setMsg('Vui lòng nhập tên và số điện thoại khách hàng.');
                return;
            }
            if (!Number.isSafeInteger(Number(pointsToUse)) || Number(pointsToUse) < 0 || Number(pointsToUse) % pointStep !== 0 || Number(pointsToUse) > maxPoints) {
                setMsg('Số điểm thưởng không được vượt quá điểm hiện có của khách hàng.');
                return;
            }
        }

        setStep((prev) => Math.min(prev + 1, flowSteps.length - 1));
    }

    function goBack() {
        setStep((prev) => Math.max(prev - 1, 0));
    }

    async function book() {
        if (bookingBusy) return;
        if (!currentShowtime || !seat.length) {
            setMsg('Vui lòng chọn suất chiếu và ít nhất một ghế.');
            return;
        }

        if (customerType === 'member' && !selectedMember) {
            setMsg('Vui lòng nhập đầy đủ thông tin khách hàng khi đặt vé tại quầy.');
            return;
        }

        if (!Number.isSafeInteger(Number(pointsToUse)) || Number(pointsToUse) < 0 || Number(pointsToUse) > maxPoints) {
            setMsg('Điểm sử dụng phải là số nguyên không âm, không vượt số dư khách hàng hoặc giá trị đơn.');
            return;
        }
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
            setMsg(error.message);
        } finally {
            setBookingBusy(false);
        }
    }

    return (
        <section className="page">
            <h2>Đặt vé tại quầy</h2>
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
                                                    {movie.ageLimit || 18}+ • {movie.genre?.map(translateGenre).join(', ') || 'Phim'} • {movie.duration || 120} phút
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
                        <div className="screen">MÀN HÌNH</div>
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
                                        disabled={s.status !== 'available' || (s.condition && s.condition !== 'Active')}
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

                {step === 3 && (
                    <div className="checkoutSection">
                        <h3>4. Chọn loại khách hàng</h3>
                        <fieldset disabled={bookingBusy}>
                            <legend>Thông tin Member là tùy chọn</legend>
                            {['guest', 'member'].map((type) => <label key={type} style={{ marginRight: '20px' }}>
                                <input type="radio" name="counterCustomerType" value={type} checked={customerType === type}
                                    onChange={() => { setCustomerType(type); setSelectedMember(null); setMemberSearch(''); setCustomerInfo({ fullName: '', email: '', phone: '' }); setPointsToUse(0); }} />
                                {type === 'guest' ? 'Khách vãng lai — không cung cấp thông tin' : 'Member — có sử dụng điểm'}
                            </label>)}
                        </fieldset>
                        {customerType === 'guest' && <p>Không cần tên, email, số điện thoại hoặc tài khoản. Khách không sử dụng điểm Member; nhận vé ngay tại quầy sau khi thanh toán.</p>}
                        {customerType === 'member' && (
                        <div className="checkoutForm">
                            <input
                                aria-label="Email hoặc số điện thoại thành viên"
                                value={memberSearch}
                                onChange={(event) => { setMemberSearch(event.target.value); setSelectedMember(null); setCustomerInfo({ fullName: '', email: '', phone: '' }); setPointsToUse(0); }}
                                placeholder="Email hoặc số điện thoại thành viên"
                            />
                            <button type="button" onClick={async () => {
                                try {
                                    const results = await searchMembers(memberSearch);
                                    const member = results.find((item) => item.status === 'Active' || item.status === 'active');
                                    if (!member) { setMsg('Không tìm thấy thành viên đang hoạt động.'); return; }
                                    setSelectedMember(member);
                                    setCustomerInfo(member);
                                } catch (error) { setMsg(error.message); }
                            }}>Tìm thành viên</button>
                            <input
                                value={customerInfo.fullName}
                                readOnly
                                onChange={(e) => setCustomerInfo((prev) => ({ ...prev, fullName: e.target.value }))}
                                placeholder="Họ tên khách hàng"
                            />
                            <input
                                value={customerInfo.phone}
                                readOnly
                                onChange={(e) => setCustomerInfo((prev) => ({ ...prev, phone: e.target.value }))}
                                placeholder="Số điện thoại"
                            />
                            <input
                                value={customerInfo.email}
                                readOnly
                                onChange={(e) => setCustomerInfo((prev) => ({ ...prev, email: e.target.value }))}
                                placeholder="Địa chỉ email"
                            />
                            <div className="pointBox">
                                <input
                                    type="number"
                                    min="0"
                                    max={maxPoints}
                                    step={pointStep}
                                    value={pointsToUse}
                                    onChange={(e) => setPointsToUse(Math.max(0, Number(e.target.value) || 0))}
                                    placeholder="Điểm thưởng"
                                />
                                <button type="button" onClick={() => setPointsToUse(maxPoints)}>
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
                        <h3>5. Thanh toán</h3>
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

                        <label style={{display:'block',margin:'18px 0'}}><input type="checkbox" checked={guardianConfirmed} onChange={event=>setGuardianConfirmed(event.target.checked)} /> Tôi đã kiểm tra tuổi khách và điều kiện người giám hộ theo phân loại phim.</label>
                        <button type="button" className="primary full" onClick={book} disabled={bookingBusy}>Thanh toán ngay</button>
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
