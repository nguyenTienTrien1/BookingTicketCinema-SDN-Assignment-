import FoodPicker from '../../components/FoodPicker';
import CounterPromotion from '../../components/CounterPromotion';
import { api } from '../../services/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createBooking } from '../../services/bookingService';
import useMemberPoints from '../../hooks/useMemberPoints';
import MemberPointsPicker from '../../components/MemberPointsPicker';
import { memberPointsQuote } from '../../utils/memberPoints';
import { translateFoodName, translateGenre } from '../../utils/uiText';
import { orphanSeatMessage } from '../../../../shared/seatSelection.mjs';

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

const flowSteps = ['Chọn rạp', 'Phim & suất chiếu', 'Chọn ghế', 'Bắp nước', 'Xác nhận'];

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

export default function BookingApp({ user, setUser, selected, showtimes, foods, movies, setTab, setMsg, setPending, onRequireBookingLogin }) {
    const memberPoints = useMemberPoints(user, setUser);
    const [pointsToUse, setPointsToUse] = useState('0');
    const [bookingBusy, setBookingBusy] = useState(false);
    const [promotionQuote, setPromotionQuote] = useState(null);
    const [promotionDirty, setPromotionDirty] = useState(false);
    const [promotionBusy, setPromotionBusy] = useState(false);
    const [promotionError, setPromotionError] = useState('');
    const promotionRequest = useRef(0);
    const submitting = useRef(false);
    const [seat, setSeat] = useState([]);
    const [food, setFood] = useState([]);
    const [step, setStep] = useState(selected?.startTime ? 2 : 0);
    const [cinema, setCinema] = useState(selected?.cinema || '');
    const [movieId, setMovieId] = useState(selected?.movie?._id || selected?._id || '');
    const [showtimeId, setShowtimeId] = useState(selected?._id || '');
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

    const ticketPrice = Number(currentShowtime?.price || 0);
    const ticketSubtotal = ticketPrice * seat.length;
    // Tiền bắp nước xem trước = tổng đơn giá × số lượng; server sẽ tính lại khi tạo đơn.
    const foodSubtotal = food.reduce((sum, item) => sum + Number(item.price || 0) * (item.quantity || 1), 0);
    useEffect(() => {
        if (!currentShowtime) return;
        setSeat(current => current.filter(number => currentShowtime.seats.some(item => item.number === number && item.status === 'available' && (!item.condition || item.condition === 'Active'))));
    }, [currentShowtime]);

    const subtotal = ticketSubtotal + foodSubtotal;
    const cartKey = JSON.stringify([showtimeId, seat, food.map(item => [item._id, item.quantity, item.price]), ticketPrice]);
    const activeQuote = promotionQuote?.cartKey === cartKey ? promotionQuote : null;
    const promotionDiscount = activeQuote?.promotionDiscount || 0;
    const pointsAllowed = !activeQuote?.promotion || activeQuote.promotion.stackable;
    const pointsSubtotal = subtotal - promotionDiscount;
    const { selectedPoints, pointsValid, discount } = memberPointsQuote(pointsAllowed ? memberPoints.balance : 0, pointsSubtotal, pointsToUse, memberPoints.step);
    useEffect(() => {
        promotionRequest.current++;
        setPromotionQuote(null);
        setPromotionDirty(false);
        setPromotionBusy(false);
        setPromotionError('');
    }, [cartKey]);
    async function applyPromotion(code, replacePoints = false) {
        const request = ++promotionRequest.current;
        setPromotionBusy(true);
        setPromotionError('');
        try {
            const quote = await api('/bookings/promotion-preview', { method: 'POST', body: JSON.stringify({ code, showtimeId, seats: seat, foodItems: food.map(item => ({ food: item._id, quantity: item.quantity || 1 })) }) });
            if (request !== promotionRequest.current) return;
            if (quote.subtotal !== subtotal) throw new Error('Giá vé hoặc bắp nước đã thay đổi. Vui lòng tải lại trang để xác nhận giá mới.');
            if (selectedPoints > 0 && !quote.promotion.stackable && !replacePoints) throw new Error('Mã này không dùng cùng điểm. Chọn Không dùng điểm rồi áp dụng lại mã.');
            if (replacePoints) setPointsToUse('0');
            setPromotionQuote({ ...quote, cartKey });
            setPromotionDirty(false);
        } catch (error) {
            if (request === promotionRequest.current) setPromotionError(error.message);
        } finally {
            if (request === promotionRequest.current) setPromotionBusy(false);
        }
    }
    // Lọc suất chiếu của phim tại rạp khách đã chọn.
    function getMovieShowtimes(movie) {
        if (!cinema) return [];
        return showtimes.filter((s) => {
            const movieIdValue = s.movie?._id || s.movie;
            return s.cinema === cinema && String(movieIdValue) === String(movie._id);
        });
    }

    // Chọn/bỏ chọn ghế trên giao diện, chưa giữ trên server; chỉ chọn ghế trống đang hoạt động.
    function handleSeatClick(s) {
        if (s.status !== 'available' || (s.condition && s.condition !== 'Active')) return;

        if (seat.includes(s.number)) {
            setSeat((prev) => prev.filter((x) => x !== s.number));
            return;
        }

        setSeat((prev) => [...prev, s.number]);
    }

    // Kiểm tra đủ lựa chọn của bước hiện tại trước khi chuyển bước tiếp theo.
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
        if (step >= 2 && !validateSeats()) return;
        setStep((prev) => Math.min(prev + 1, flowSteps.length - 1));
    }

    // Chặn cách chọn tạo ghế trống lẻ; có lỗi thì quay về bước chọn ghế.
    function validateSeats() {
        const seatError = orphanSeatMessage(currentShowtime?.seats || [], seat);
        if (!seatError) return true;
        setMsg(seatError);
        setStep(2);
        return false;
    }

    // Quay lại bước trước để chỉnh lựa chọn.
    function goBack() {
        setStep((prev) => Math.max(prev - 1, 0));
    }

    // Kiểm tra lựa chọn và điểm, chặn bấm lặp, rồi gửi yêu cầu tạo đơn online.
    async function book() {
        if (submitting.current) return;
        if (promotionBusy || promotionDirty || promotionError) {
            setMsg('Vui lòng áp dụng mã hợp lệ hoặc hủy thay đổi mã trước khi tạo đơn.');
            return;
        }
        if (!user || !currentShowtime || !seat.length) {
            setMsg('Vui lòng đăng nhập, chọn suất chiếu và ít nhất một ghế.');
            return;
        }
        if (!validateSeats()) return;

        if (!pointsValid || (selectedPoints > 0 && (memberPoints.refreshing || memberPoints.error))) {
            setMsg('Vui lòng kiểm tra số dư và chọn số điểm nguyên không âm, không vượt mức tối đa.');
            return;
        }
        submitting.current = true;
        setBookingBusy(true);
        try {
            // Chỉ gửi lựa chọn; server kiểm tra lại và tính số tiền chính thức.
            const booking = await createBooking({
                promotionCode: activeQuote?.promotion?.code || '',
                points: selectedPoints,
                showtimeId: currentShowtime._id,
                seats: seat,
                foodItems: food.map((x) => ({ food: x._id, quantity: x.quantity || 1 }))
            });

            // Đơn đã được giữ ghế 10 phút; chuyển sang thanh toán, chưa có vé QR.
            setPending(booking);
            setMsg(`Đặt vé thành công: ${booking._id}. Ghế được giữ trong 10 phút.`);
            setTab('payment');
        } catch (error) {
            setMsg(error.message);
            memberPoints.refresh();
        } finally {
            submitting.current = false;
            setBookingBusy(false);
        }
    }

    if (!user) {
        return (
            <section className="page bookingAuthPage">
                <div className="bookingAuthCard">
                    <div className="bookingAuthIcon" aria-hidden="true">+</div>
                    <p className="bookingEyebrow">CINEMA+ · ĐẶT VÉ TRỰC TUYẾN</p>
                    <h2>Đăng nhập để bắt đầu đặt vé</h2>
                    <p>Đăng nhập để chọn suất chiếu, giữ ghế và xem lại vé trong tài khoản của bạn.</p>
                    <button type="button" className="primary" onClick={onRequireBookingLogin}>
                        Đăng nhập ngay
                    </button>
                    <button type="button" className="textButton" onClick={() => setTab('movies')}>
                        Khám phá phim trước
                    </button>
                </div>
            </section>
        );
    }

    return (
        <section className="page">
            <div className="bookingPageHeading">
                <p className="bookingEyebrow">CINEMA+ · ĐẶT VÉ TRỰC TUYẾN</p>
                <h2>Đặt vé trên app</h2>
                <p>Chọn suất chiếu, ghế ngồi và bắp nước yêu thích của bạn.</p>
            </div>
            <div className="booking appBooking">
                <div className="bookingFlow">
                    {flowSteps.map((label, index) => (
                        <button
                            key={label}
                            type="button"
                            className={step === index ? 'activeStep' : index < step ? 'doneStep' : ''}
                            onClick={() => index <= step && setStep(index)}
                            disabled={index > step}
                            aria-current={step === index ? 'step' : undefined}
                        >
                            <span className="stepNumber">{index < step ? '✓' : index + 1}</span>
                            <span>{label}</span>
                        </button>
                    ))}
                </div>

                <div className="bookingSelectionBar">
                    <div className="bookingSelectionMovie">
                        {currentMovie && <img src={getPoster(currentMovie)} alt="" />}
                        <div>
                            <span>ĐANG ĐẶT VÉ</span>
                            <strong>{currentMovie?.title || 'Chưa chọn phim'}</strong>
                            <small>{cinema || 'Chưa chọn rạp'}{currentShowtime?.room ? ` · ${currentShowtime.room}` : ''}</small>
                        </div>
                    </div>
                    <div className="bookingSelectionStat">
                        <span>Suất chiếu</span>
                        <strong>
                            {currentShowtime
                                ? new Date(currentShowtime.startTime).toLocaleString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                : 'Chưa chọn'}
                        </strong>
                    </div>
                    <div className="bookingSelectionStat">
                        <span>Ghế đã chọn</span>
                        <strong>{seat.length ? seat.join(', ') : 'Chưa chọn'}</strong>
                    </div>
                    <div className="bookingSelectionTotal">
                        <span>Tạm tính</span>
                        <strong>{subtotal.toLocaleString()}₫</strong>
                    </div>
                </div>

                {step === 0 && (
                    <div className="checkoutSection">
                        <div className="checkoutStepHeading">
                            <div>
                                <p className="bookingEyebrow">BƯỚC 1 / 5</p>
                                <h3>Chọn rạp chiếu</h3>
                                <p className="bookingStepDescription">Chọn địa điểm thuận tiện, sau đó khám phá phim và suất chiếu đang mở bán.</p>
                            </div>
                            <span className="optionalBadge">{cinemaOptions.length} rạp</span>
                        </div>
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
                            {!cinemaOptions.length && <p className="bookingEmptyState">Hiện chưa có rạp hoặc suất chiếu nào khả dụng.</p>}
                        </div>
                    </div>
                )}

                {step === 1 && cinema && (
                    <div className="checkoutSection">
                        <div className="checkoutStepHeading">
                            <div>
                                <p className="bookingEyebrow">BƯỚC 2 / 5 · {cinema}</p>
                                <h3>Chọn phim và suất chiếu</h3>
                                <p className="bookingStepDescription">Chọn khung giờ phù hợp để tiếp tục chọn ghế.</p>
                            </div>
                            <button type="button" className="bookingChangeLink" onClick={() => setStep(0)}>Đổi rạp</button>
                        </div>
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
                                                    <small>{new Date(showtime.startTime).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'short' })} · {showtime.room}</small>
                                                    <small>{Number(showtime.price || 0).toLocaleString()}₫ / vé</small>
                                                </button>
                                            ))}
                                            {!movieShowtimes.length && <p className="bookingEmptyState">Phim này chưa có suất chiếu tại rạp đã chọn.</p>}
                                        </div>
                                    </div>
                                );
                            })}
                            {!moviesForCinema.length && <p className="bookingEmptyState">Chưa có phim đang chiếu tại rạp này.</p>}
                        </div>
                    </div>
                )}

                {step === 2 && currentShowtime && (
                    <div className="checkoutSection">
                        <div className="checkoutStepHeading">
                            <div>
                                <p className="bookingEyebrow">BƯỚC 3 / 5 · {currentShowtime.room}</p>
                                <h3>Chọn ghế ngồi</h3>
                                <p className="bookingStepDescription">Chạm vào ghế trống để chọn hoặc bỏ chọn. Giá vé sẽ được cập nhật bên dưới.</p>
                            </div>
                            <span className="optionalBadge">{Number(currentShowtime.price || 0).toLocaleString()}₫ / vé</span>
                        </div>
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
                        <p className="seatSelectionHint">
                            {seat.length ? `${seat.length} ghế đã chọn · ${(currentShowtime.price * seat.length).toLocaleString()}₫` : 'Chọn một hoặc nhiều ghế để tiếp tục.'}
                        </p>
                    </div>
                )}

                {step === 3 && (
                    <div className="checkoutSection">
                        <div className="checkoutStepHeading">
                            <div>
                                <p className="bookingEyebrow">BƯỚC 4 / 5</p>
                                <h3>Thêm bắp nước cho buổi xem phim</h3>
                            </div>
                            <span className="optionalBadge">Không bắt buộc</span>
                        </div>
                        <p className="helperText">Bạn có thể bỏ qua nếu không muốn gọi thêm đồ ăn.</p>
                        {/* Chọn món mới chỉ cập nhật trên giao diện, chưa trừ tồn kho. */}
                        <FoodPicker foods={foods} items={food} onChange={setFood} />
                        <div className="bookingActions">
                            <button type="button" className="ghost" onClick={goBack}>Quay lại</button>
                            <button type="button" className="primary" onClick={goNext}>Tiếp tục</button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="checkoutSection">
                        <div className="checkoutStepHeading">
                            <div>
                                <p className="bookingEyebrow">BƯỚC 5 / 5</p>
                                <h3>Xác nhận thông tin vé</h3>
                            </div>
                            <span className="accountBadge">Đặt vé với {user.fullName}</span>
                        </div>
                        <div className="summaryCard">
                            <div className="summaryMovie">
                                {currentMovie && <img src={getPoster(currentMovie)} alt="" />}
                                <div>
                                    <span className="summaryLabel">PHIM</span>
                                    <strong>{currentMovie?.title || 'Chưa chọn phim'}</strong>
                                    <span>{currentShowtime?.cinema || cinema}</span>
                                </div>
                            </div>
                            <div className="summaryDetails">
                                <p><span>Suất chiếu</span><strong>{currentShowtime ? new Date(currentShowtime.startTime).toLocaleString('vi-VN') : 'Chưa chọn'}</strong></p>
                                <p><span>Phòng</span><strong>{currentShowtime?.room || '—'}</strong></p>
                                <p><span>Ghế</span><strong>{seat.join(', ') || 'Chưa chọn'}</strong></p>
                            </div>
                            <div className="summaryPriceBreakdown">
                                <h4>Chi tiết giá</h4>
                                <div className="summaryPriceRow">
                                    <span>Vé xem phim ({ticketPrice.toLocaleString()}₫ × {seat.length} ghế)</span>
                                    <strong>{ticketSubtotal.toLocaleString()}₫</strong>
                                </div>
                                {food.length ? food.map((item) => (
                                    <div className="summaryPriceRow" key={item._id}>
                                        <span>{translateFoodName(item.name)} (×{item.quantity || 1})</span>
                                        <strong>{(Number(item.price || 0) * (item.quantity || 1)).toLocaleString()}₫</strong>
                                    </div>
                                )) : (
                                    <div className="summaryPriceRow">
                                        <span>Bắp nước</span>
                                        <strong>Không gọi thêm</strong>
                                    </div>
                                )}
                                <div className="summaryPriceRow summaryFoodSubtotal">
                                    <span>Tổng bắp nước</span>
                                    <strong>{foodSubtotal.toLocaleString()}₫</strong>
                                </div>
                                {promotionDiscount > 0 && <div className="summaryPriceRow memberPointsSummaryDiscount"><span>Khuyến mãi ({activeQuote.promotion.code})</span><strong>−{promotionDiscount.toLocaleString('vi-VN')}₫</strong></div>}
                                {discount > 0 && <div className="summaryPriceRow memberPointsSummaryDiscount"><span>Giảm từ {selectedPoints} điểm</span><strong>−{discount.toLocaleString('vi-VN')}₫</strong></div>}
                            </div>
                            <div className="summaryTotal">
                                <span>Tổng thanh toán</span>
                                <strong>{(pointsSubtotal - discount).toLocaleString('vi-VN')}₫</strong>
                            </div>
                        </div>
                        <CounterPromotion key={cartKey} heading="Mã khuyến mãi" booking={{ promotion: activeQuote?.promotion, promotionDiscount, pointsUsed: selectedPoints }} editable={true} disabled={bookingBusy || promotionBusy}
                            onDraftChange={setPromotionDirty} onCancelDraft={() => setPromotionError('')}
                            onApply={code => applyPromotion(code)} onReplacePoints={code => applyPromotion(code, true)}
                            onRemove={() => { setPromotionQuote(null); setPromotionDirty(false); setPromotionError(''); }} />
                        {promotionBusy && <p className="helperText" role="status">Đang kiểm tra mã khuyến mãi…</p>}
                        {promotionError && <p className="error" role="alert">{promotionError}</p>}
                        {promotionDirty && <p className="helperText" role="status">Mã vừa nhập chưa áp dụng. Chọn Áp dụng mã hoặc Hủy thay đổi mã.</p>}
                        {!pointsAllowed && <p className="helperText">Mã này không dùng cùng điểm thành viên. Bỏ mã để sử dụng điểm.</p>}
                        {pointsAllowed && <MemberPointsPicker wallet={memberPoints} value={pointsToUse} onChange={setPointsToUse} subtotal={pointsSubtotal} busy={bookingBusy || promotionBusy} />}
                        <p className="accountNotice">Thông tin khách hàng sẽ được lấy từ tài khoản của bạn. Không cần nhập lại.</p>
                        <p className="helperText">Nhân viên sẽ kiểm tra độ tuổi và điều kiện người giám hộ tại quầy trước khi vào xem phim.</p>
                        <button type="button" className="primary full" onClick={book} disabled={bookingBusy || promotionBusy || promotionDirty || !!promotionError || !pointsValid || (selectedPoints > 0 && (memberPoints.refreshing || !!memberPoints.error))}>{bookingBusy ? 'Đang tạo đơn…' : 'Tạo đơn và chọn thanh toán'}</button>
                    </div>
                )}

                {step < 3 && <div className="bookingActions">
                    {step > 0 && (
                        <button type="button" className="ghost" onClick={goBack}>Quay lại</button>
                    )}
                    {step < flowSteps.length - 1 && (
                        <button type="button" className="primary" onClick={goNext}>Tiếp tục</button>
                    )}
                </div>}
            </div>
        </section>
    );
}
