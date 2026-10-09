import { useState } from 'react';
import { applyPoints, payBooking } from '../../services/bookingService';

export default function Payment({ user, pending, onDone, setMsg }) {
    const [booking, setBooking] = useState(pending);
    const [points, setPoints] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('vnpay');
    const [voucher, setVoucher] = useState('');
    const [ticketReady, setTicketReady] = useState(false);

    if (!booking) {
        return (
            <section className="page">
                <h2>Không có vé chờ thanh toán</h2>
            </section>
        );
    }

    async function usePoints() {
        if (!user) {
            setMsg('Bạn cần đăng nhập để sử dụng điểm thành viên.');
            return;
        }

        try {
            const result = await applyPoints(booking._id, { userId: user._id, points: Number(points) });
            setBooking(result);
            setMsg('Điểm thành viên đã được áp dụng.');
        } catch (error) {
            setMsg(error.message);
        }
    }

    async function pay() {
        if (!user) {
            setMsg('Bạn cần đăng nhập để thanh toán.');
            return;
        }

        try {
            await payBooking(booking._id, { userId: user._id, method: paymentMethod });
            setTicketReady(true);
            setMsg('Thanh toán thành công. Vé điện tử đang được tạo.');
        } catch (error) {
            setMsg(error.message);
        }
    }

    if (ticketReady) {
        return (
            <section className="page">
                <div className="payment successBox">
                    <h2>Thanh toán thành công</h2>
                    <div className="ticketCard">
                        <div className="ticketHeader">
                            <span>VÉ ĐIỆN TỬ</span>
                            <strong>{booking._id}</strong>
                        </div>
                        <div className="qrBox">QR</div>
                        <p><strong>Phim:</strong> {booking.showtime?.movie?.title || 'Movie'}</p>
                        <p><strong>Rạp:</strong> {booking.showtime?.cinema}</p>
                        <p><strong>Ngày:</strong> {booking.showtime ? new Date(booking.showtime.startTime).toLocaleString('vi-VN') : ''}</p>
                        <p><strong>Ghế:</strong> {(booking.seats || []).join(', ')}</p>
                        <p><strong>Tổng tiền:</strong> {booking.total?.toLocaleString()}₫</p>
                    </div>
                    <button className="primary full" onClick={onDone}>Xem hoặc tải vé</button>
                </div>
            </section>
        );
    }

    return (
        <section className="page">
            <h2>Thanh toán</h2>
            <div className="payment">
                <p>Phim: <b>{booking.showtime?.movie?.title || 'Movie'}</b></p>
                <p>Rạp: <b>{booking.showtime?.cinema}</b></p>
                <p>Ngày chiếu: <b>{booking.showtime ? new Date(booking.showtime.startTime).toLocaleString('vi-VN') : ''}</b></p>
                <p>Ghế: <b>{(booking.seats || []).join(', ')}</b></p>
                <p>Subtotal: <b>{booking.subtotal?.toLocaleString()}₫</b></p>
                <p>Discount: <b>{booking.discount?.toLocaleString() || '0'}₫</b></p>
                <h2>Total: {booking.total?.toLocaleString()}₫</h2>

                <div className="pointBox">
                    <input type="number" min="0" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="Điểm thành viên" />
                    <button type="button" onClick={usePoints}>Áp dụng</button>
                </div>

                <div className="couponBox">
                    <input value={voucher} onChange={(e) => setVoucher(e.target.value)} placeholder="Mã khuyến mãi" />
                    <button type="button" onClick={() => setVoucher('CINEMA10')}>Dùng</button>
                </div>

                <div className="paymentOptions">
                    <button type="button" className={paymentMethod === 'vnpay' ? 'paymentOption selected' : 'paymentOption'} onClick={() => setPaymentMethod('vnpay')}>VNPay</button>
                    <button type="button" className={paymentMethod === 'momo' ? 'paymentOption selected' : 'paymentOption'} onClick={() => setPaymentMethod('momo')}>MoMo</button>
                    <button type="button" className={paymentMethod === 'cod' ? 'paymentOption selected' : 'paymentOption'} onClick={() => setPaymentMethod('cod')}>Tiền mặt</button>
                </div>

                <button type="button" className="vnpay" onClick={pay}>Thanh toán {paymentMethod.toUpperCase()}</button>
            </div>
        </section>
    );
}
