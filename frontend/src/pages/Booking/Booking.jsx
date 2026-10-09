import { useState } from 'react';
import { createBooking } from '../../services/bookingService';

export default function Booking({
    user,
    selected,
    showtimes,
    foods,
    setTab,
    setMsg,
    setPending
}) {
    const [seat, setSeat] = useState([]);
    const [food, setFood] = useState([]);

    const movieId = selected?.movie?._id || selected?._id;

    const times = showtimes.filter(
        s =>
            !movieId ||
            s.movie?._id === movieId ||
            s.movie === movieId
    );

    // =========================
    // KIỂM TRA GHẾ CÓ BỊ CHỪA
    // =========================
    function isSeatInvalid(seatNumber) {
        const allSeats = selected?.seats || [];

        // Chỉ xét các ghế có thể đặt hoặc VIP
        const usableSeats = allSeats
            .filter(s => s.status === 'available' || s.status === 'vip')
            .map(s => s.number)
            .sort((a, b) => a - b);

        const selectedSeats = [...seat, seatNumber].sort(
            (a, b) => a - b
        );

        // Sau khi chọn ghế, tìm những ghế trống còn lại
        const remainingSeats = usableSeats.filter(
            number => !selectedSeats.includes(number)
        );

        for (const number of remainingSeats) {
            const index = usableSeats.indexOf(number);

            const left = usableSeats[index - 1];
            const right = usableSeats[index + 1];

            // =========================
            // 1. GHẾ NGOÀI CÙNG
            // =========================
            if (index === 0 || index === usableSeats.length - 1) {
                const hasOtherSeat =
                    index === 0
                        ? selectedSeats.includes(right)
                        : selectedSeats.includes(left);

                if (hasOtherSeat) {
                    return true;
                }
            }

            // =========================
            // 2. GHẾ Ở GIỮA
            // =========================
            if (
                left !== undefined &&
                right !== undefined &&
                selectedSeats.includes(left) &&
                selectedSeats.includes(right)
            ) {
                return true;
            }
        }

        return false;
    }

    // =========================
    // CHỌN / BỎ CHỌN GHẾ
    // =========================
    function handleSeatClick(s) {
        if (s.status !== 'available' && s.status !== 'vip') {
            return;
        }

        // Nếu đang bỏ ghế đã chọn
        if (seat.includes(s.number)) {
            setSeat(seat.filter(x => x !== s.number));
            return;
        }

        // Kiểm tra ghế chừa
        if (isSeatInvalid(s.number)) {
            setMsg(
                'Không thể chừa một ghế ở giữa hoặc một ghế ngoài cùng.'
            );
            return;
        }

        setSeat([...seat, s.number]);
    }

    // =========================
    // BOOKING
    // =========================
    async function book() {
        if (!user || !selected || !seat.length) {
            setMsg(
                'Login, choose a showtime and at least one seat.'
            );
            return;
        }

        try {
            const b = await createBooking({
                userId: user._id,
                showtimeId: selected._id,
                seats: seat,
                foodItems: food.map(x => ({
                    food: x._id,
                    quantity: 1
                }))
            });

            setPending(b);

            setMsg(
                `Booking created: ${b._id}. Seats are held for 10 minutes.`
            );

            setTab('payment');
        } catch (e) {
            setMsg(e.message);
        }
    }

    return (
        <section className="page">

            <h2>Book Movie Ticket</h2>

            <div className="booking">

                <h3>
                    {selected?.movie?.title ||
                        selected?.title ||
                        'Select a movie'}
                </h3>

                {/* =========================
                    SHOWTIME
                ========================= */}
                <div className="showtimes">

                    {times.map(s => (
                        <button
                            className={
                                selected?._id === s._id
                                    ? 'selected'
                                    : ''
                            }
                            onClick={() =>
                                window.dispatchEvent(
                                    new CustomEvent(
                                        'select-showtime',
                                        { detail: s }
                                    )
                                )
                            }
                            key={s._id}
                        >
                            {new Date(
                                s.startTime
                            ).toLocaleString()}

                            <small>
                                {s.cinema} · {s.room} ·{' '}
                                {s.price?.toLocaleString()}₫
                            </small>
                        </button>
                    ))}

                </div>

                {selected && (
                    <>

                        {/* =========================
                            SEAT
                        ========================= */}

                        <h3>Reserve Seat</h3>

                        {/* LEGEND */}

                        <div className="seatLegend">

                            <div>
                                <span className="legendSeat available"></span>
                                Ghế trống
                            </div>

                            <div>
                                <span className="legendSeat booked"></span>
                                Ghế đã đặt
                            </div>

                            <div>
                                <span className="legendSeat broken"></span>
                                Ghế hỏng
                            </div>

                            <div>
                                <span className="legendSeat vip"></span>
                                Ghế VIP
                            </div>

                            <div>
                                <span className="legendSeat chosen"></span>
                                Đang chọn
                            </div>

                        </div>

                        <div className="screen">
                            SCREEN
                        </div>

                        <div className="seats">

                            {selected.seats?.map(s => {

                                let seatClass = 'seat';

                                if (s.status === 'booked') {
                                    seatClass += ' booked';
                                }
                                else if (s.status === 'broken') {
                                    seatClass += ' broken';
                                }
                                else if (s.status === 'vip') {
                                    seatClass += ' vip';
                                }
                                else {
                                    seatClass += ' available';
                                }

                                if (seat.includes(s.number)) {
                                    seatClass += ' chosen';
                                }

                                return (
                                    <button
                                        key={s.number}
                                        disabled={
                                            s.status !== 'available' &&
                                            s.status !== 'vip'
                                        }
                                        className={seatClass}
                                        onClick={() =>
                                            handleSeatClick(s)
                                        }
                                    >
                                        {s.number}
                                    </button>
                                );
                            })}

                        </div>

                        {/* =========================
                            FOOD
                        ========================= */}

                        <h3>Add Food & Drink</h3>

                        <div className="food">

                            {foods.map(f => (
                                <button
                                    className={
                                        food.some(
                                            x => x._id === f._id
                                        )
                                            ? 'chosen'
                                            : ''
                                    }
                                    onClick={() =>
                                        setFood(x =>
                                            x.some(
                                                a =>
                                                    a._id === f._id
                                            )
                                                ? x.filter(
                                                    a =>
                                                        a._id !==
                                                        f._id
                                                )
                                                : [...x, f]
                                        )
                                    }
                                    key={f._id}
                                >
                                    {f.name}

                                    <b>
                                        {f.price?.toLocaleString()}₫
                                    </b>
                                </button>
                            ))}

                        </div>

                        <button
                            className="primary full"
                            onClick={book}
                        >
                            CONTINUE TO PAYMENT
                        </button>

                    </>
                )}

            </div>

        </section>
    );

}
