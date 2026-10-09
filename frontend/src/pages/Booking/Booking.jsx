import BookingApp from './BookingApp';
import BookingCounter from './BookingCounter';

export default function Booking(props) {
    const role = String(props.user?.role || '').toLowerCase();

    if (role === 'member') return <BookingApp {...props} />;
    if (role === 'employee' || role === 'admin') return <BookingCounter {...props} />;

    return <BookingApp {...props} />;
}
