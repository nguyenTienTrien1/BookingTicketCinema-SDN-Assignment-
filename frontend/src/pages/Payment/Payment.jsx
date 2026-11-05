import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyPoints, payBooking } from '../../services/bookingService';
import { translateFoodName } from '../../utils/uiText';

const paymentMethods = [
    { id: 'vnpay', name: 'VNPay', description: 'Ví điện tử / ngân hàng' },
    { id: 'momo', name: 'MoMo', description: 'Ví điện tử MoMo' },
    { id: 'credit-card', name: 'Thẻ ngân hàng', description: 'Visa / Mastercard' }
];

export default function Payment({ user, setUser, pending, onDone, setMsg, setTab }) {
    const [booking, setBooking] = useState(pending);
    const [points, setPoints] = useState(String(pending?.pointsUsed || ''));
    const [paymentMethod, setPaymentMethod] = useState('vnpay');
    const [ticketReady, setTicketReady] = useState(false);
    const [simulatorOpen, setSimulatorOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState('');
    const [clock, setClock] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setClock(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const expiresAt = booking?.expiresAt ? new Date(booking.expiresAt).getTime() : 0;
    const remainingSeconds = expiresAt ? Math.max(0, Math.ceil((expiresAt - clock) / 1000)) : 0;
    const holdExpired = Boolean(booking?.status === 'pending' && (!expiresAt || remainingSeconds === 0));
    const holdCountdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;

    if (!booking) {
        return (
            <section className="page">
                <div className="payment emptyPayment">
                    <h2>Không có vé chờ thanh toán</h2>
                    <p>Hãy chọn phim, suất chiếu và ghế trước khi thanh toán.</p>
                    <button type="button" className="primary" onClick={onDone}>Về trang chủ</button>
                </div>
            </section>
        );
    }

    async function usePoints() {
        const pointsToUse = Number(points);
        if (!user) {
            setMsg('Bạn cần đăng nhập để sử dụng điểm thành viên.');
            return;
        }
        if (holdExpired) {
            setPaymentError('Thời gian giữ ghế đã hết. Hãy tạo đơn đặt vé mới.');
            return;
        }
        if (!Number.isInteger(pointsToUse) || pointsToUse < 0 || points === '') {
            setPaymentError('Nhập số điểm nguyên không âm. Nhập 0 để bỏ áp dụng điểm.');
            return;
        }

        setPaymentError('');
        try {
            const result = await applyPoints(booking._id, { userId: user._id, points: pointsToUse });
            setBooking((current) => ({ ...current, ...result, showtime: current.showtime, foodItems: current.foodItems }));
            setPoints(String(result.pointsUsed || ''));
            setMsg('Điểm thành viên đã được áp dụng.');
        } catch (error) {
            setPaymentError(error.message);
        }
    }

    async function simulatePayment(success) {
        if (holdExpired) {
            setSimulatorOpen(false);
            setPaymentError('Thời gian giữ ghế đã hết. Hãy chọn lại suất chiếu và ghế.');
            return;
        }
        if (!success) {
            setSimulatorOpen(false);
            setPaymentError('Giao dịch mô phỏng thất bại. Đơn vé vẫn đang chờ thanh toán, bạn có thể thử lại.');
            return;
        }

        setProcessing(true);
        setPaymentError('');
        try {
            const result = await payBooking(booking._id, { userId: user._id, method: paymentMethod });
            if (result.user && Number.isFinite(Number(result.user.memberPoints))) {
                setUser((currentUser) => currentUser
                    ? { ...currentUser, memberPoints: Number(result.user.memberPoints) }
                    : currentUser);
            }
            setBooking((current) => ({ ...current, status: result.status, paymentStatus: result.paymentStatus, paymentMethod: result.paymentMethod, paymentRef: result.paymentRef }));
            setSimulatorOpen(false);
            setTicketReady(true);
            setMsg('Thanh toán mô phỏng thành công. Vé điện tử đã được tạo.');
        } catch (error) {
            setSimulatorOpen(false);
            setPaymentError(error.message);
        } finally {
            setProcessing(false);
        }
    }

    if (ticketReady) {
        return (
            <section className="page paymentPage">
                <div className="paymentResult successBox">
                    <div className="paymentResultIcon">✓</div>
                    <p className="bookingEyebrow">GIAO DỊCH MÔ PHỎNG HOÀN TẤT</p>
                    <h2>Thanh toán thành công</h2>
                    <p>Đây là giao dịch mô phỏng, không có khoản tiền thật nào được thu.</p>
                    <div className="ticketCard">
                        <div className="ticketHeader">
                            <span>VÉ ĐIỆN TỬ</span>
                            <strong>{booking._id}</strong>
                        </div>
                        <Link className="historyLink" to={`/bookings/${booking._id}/tickets`}>Xem mã QR từng vé</Link>
                        <p><strong>Phim:</strong> {booking.showtime?.movie?.title || 'Phim'}</p>
                        <p><strong>Rạp:</strong> {booking.showtime?.cinema || '—'}</p>
                        <p><strong>Ngày:</strong> {booking.showtime ? new Date(booking.showtime.startTime).toLocaleString('vi-VN') : '—'}</p>
                        <p><strong>Ghế:</strong> {(booking.seats || []).join(', ')}</p>
                        <p><strong>Phương thức:</strong> {paymentMethods.find((method) => method.id === booking.paymentMethod)?.name || booking.paymentMethod}</p>
                        <p><strong>Mã giao dịch:</strong> {booking.paymentRef || 'Mô phỏng'}</p>
                        <p><strong>Tổng tiền:</strong> {Number(booking.total || 0).toLocaleString()}₫</p>
                    </div>
                    <button type="button" className="primary full" onClick={onDone}>Hoàn tất</button>
                </div>
            </section>
        );
    }

    return (
        <section className="page paymentPage">
            <div className="paymentHeading">
                <p className="bookingEyebrow">BƯỚC CUỐI · THANH TOÁN</p>
                <h2>Hoàn tất đặt vé</h2>
                <p>Chọn phương thức và chạy giao dịch mô phỏng để kiểm tra luồng thanh toán.</p>
            </div>
            <div className="paymentLayout">
                <div className="payment paymentCheckout">
                    <div className="demoNotice">
                        <strong>Chế độ mô phỏng</strong>
                        <span>Không nhập thông tin thẻ thật. Bạn có thể mô phỏng giao dịch thành công hoặc thất bại.</span>
                    </div>

                    {booking.status === 'pending' && (
                        <div className={holdExpired ? 'seatHoldNotice expired' : 'seatHoldNotice'}>
                            <strong>{holdExpired ? 'Đã hết thời gian giữ ghế' : 'Thời gian giữ ghế còn lại'}</strong>
                            <span>{holdExpired ? 'Đơn này không thể thanh toán nữa. Vui lòng đặt lại ghế.' : holdCountdown}</span>
                        </div>
                    )}

                    <h3>Phương thức thanh toán</h3>
                    <div className="paymentOptions demoPaymentOptions">
                        {paymentMethods.map((method) => (
                            <button
                                key={method.id}
                                type="button"
                                className={paymentMethod === method.id ? 'paymentOption selected' : 'paymentOption'}
                                onClick={() => setPaymentMethod(method.id)}
                                aria-pressed={paymentMethod === method.id}
                            >
                                <span className={`paymentMethodIcon ${method.id}`} aria-hidden="true">
                                    {method.id === 'credit-card' ? '▰' : method.id === 'momo' ? 'M' : 'V'}
                                </span>
                                <strong>{method.name}</strong>
                                <small>{method.description}</small>
                            </button>
                        ))}
                    </div>

                    {user && (Number(user.memberPoints) > 0 || Number(booking.pointsUsed) > 0) && booking.status === 'pending' && (
                        <div className="pointsPayment">
                            <div>
                                <strong>Điểm thành viên</strong>
                                <small>
                                    Bạn đang có {Number(user.memberPoints).toLocaleString()} điểm.
                                    {' '}1 điểm giảm 1.000₫.
                                    {booking.pointsUsed > 0 && ` Đang dùng ${booking.pointsUsed} điểm.`}
                                </small>
                            </div>
                            <div className="pointBox">
                                <input
                                    type="number"
                                    min="0"
                                    max={Math.min(Number(user.memberPoints), Math.floor(Number(booking.subtotal || booking.total || 0) / 1000))}
                                    step="1"
                                    value={points}
                                    onChange={(event) => setPoints(event.target.value)}
                                    placeholder="Số điểm (0 để bỏ)"
                                    disabled={holdExpired}
                                />
                                <button type="button" onClick={usePoints} disabled={holdExpired}>
                                    {booking.pointsUsed > 0 ? 'Cập nhật' : 'Áp dụng'}
                                </button>
                            </div>
                        </div>
                    )}

                    {paymentError && <p className="paymentError" role="alert">{paymentError}</p>}
                    {holdExpired ? (
                        <button type="button" className="primary full" onClick={() => setTab('booking')}>
                            Đặt lại vé
                        </button>
                    ) : (
                        <button type="button" className="vnpay startSimulation" onClick={() => { setPaymentError(''); setSimulatorOpen(true); }}>
                            Mô phỏng thanh toán · {Number(booking.total || 0).toLocaleString()}₫
                        </button>
                    )}
                </div>

                <aside className="payment paymentSummary">
                    <h3>Tóm tắt đơn vé</h3>
                    <p><span>Phim</span><strong>{booking.showtime?.movie?.title || 'Phim'}</strong></p>
                    <p><span>Rạp</span><strong>{booking.showtime?.cinema || '—'}</strong></p>
                    <p><span>Suất chiếu</span><strong>{booking.showtime ? new Date(booking.showtime.startTime).toLocaleString('vi-VN') : '—'}</strong></p>
                    <p><span>Ghế</span><strong>{(booking.seats || []).join(', ') || '—'}</strong></p>
                    {booking.foodItems?.length > 0 && (
                        <p><span>Bắp nước</span><strong>{booking.foodItems.map((item) => translateFoodName(item.food?.name || 'Đồ ăn')).join(', ')}</strong></p>
                    )}
                    <p><span>Tạm tính</span><strong>{Number(booking.subtotal || booking.total || 0).toLocaleString()}₫</strong></p>
                    {Number(booking.discount) > 0 && <p><span>Giảm từ điểm</span><strong>-{Number(booking.discount).toLocaleString()}₫</strong></p>}
                    <div className="paymentGrandTotal">
                        <span>Thành tiền</span>
                        <strong>{Number(booking.total || 0).toLocaleString()}₫</strong>
                    </div>
                    <small>Ghế được giữ trong thời gian giới hạn. Hoàn tất thanh toán để xác nhận vé.</small>
                </aside>
            </div>

            {simulatorOpen && (
                <div className="paymentModalBackdrop" role="presentation">
                    <div className="paymentModal" role="dialog" aria-modal="true" aria-labelledby="paymentModalTitle">
                        <button
                            type="button"
                            className="paymentModalClose"
                            aria-label="Đóng cửa sổ thanh toán"
                            onClick={() => setSimulatorOpen(false)}
                        >
                            ×
                        </button>
                        <div className={`paymentModalIcon ${paymentMethod}`}>
                            {paymentMethod === 'credit-card' ? '▰' : paymentMethod === 'momo' ? 'M' : 'V'}
                        </div>
                        <p className="bookingEyebrow">CỔNG THANH TOÁN MÔ PHỎNG</p>
                        <h2 id="paymentModalTitle">Xác nhận giao dịch</h2>
                        <p className="paymentModalMethod">{paymentMethods.find((method) => method.id === paymentMethod)?.name}</p>
                        <strong className="paymentModalAmount">{Number(booking.total || 0).toLocaleString()}₫</strong>
                        <p className="paymentModalHelp">Chọn kết quả giả lập. Thao tác này không kết nối ngân hàng hoặc thu tiền thật.</p>
                        <div className="paymentModalActions">
                            <button type="button" className="ghost" onClick={() => simulatePayment(false)} disabled={processing}>
                                Giả lập thất bại
                            </button>
                            <button type="button" className="primary" onClick={() => simulatePayment(true)} disabled={processing}>
                                {processing ? 'Đang xử lý…' : 'Giả lập thành công'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
