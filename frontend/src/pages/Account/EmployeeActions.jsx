import { Link } from 'react-router-dom';

const tasks = [
    { title: 'Tra cứu thành viên', description: 'Tìm thông tin liên hệ, điểm và hạng thành viên.', to: '/employee/members', icon: 'search' },
    { title: 'Check-in vé', description: 'Quét QR và xác nhận khách vào rạp.', to: '/employee/check-in', icon: 'qr' },
    { title: 'Thu tiền & đối soát', description: 'Tiếp nhận đơn online, đơn tại quầy và xử lý khoản thu.', to: '/staff/tools', icon: 'receipt' },
    { title: 'Bán bắp nước', description: 'Tạo đơn đồ ăn, thức uống riêng.', to: '/employee/food-sales', icon: 'food' },
];

function TaskIcon({ name }) {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {name === 'ticket' && <><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4Z" /><path d="M15 5v2m0 4v2m0 4v2" /></>}
        {name === 'search' && <><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5M7 10h6M10 7v6" /></>}
        {name === 'qr' && <><path d="M3 3h6v6H3Zm12 0h6v6h-6ZM3 15h6v6H3ZM15 15h3v3h3v3h-6Zm6-3h-3m-6 0v6" /></>}
        {name === 'receipt' && <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2ZM9 7h6M9 11h6M9 15h3" /></>}
        {name === 'food' && <><path d="M4 8h10l-1 13H5ZM3 8h12M6 4l1 4m4-4-1 4M17 11h5l-1 10h-3Zm2 0V5l3-2" /></>}
    </svg>;
}

export default function EmployeeActions({ onBookTickets }) {
    return <aside className="employeeTasks" aria-labelledby="employee-tasks-title">
        <div className="employeeTasksHeading">
            <p className="bookingEyebrow">NGHIỆP VỤ NHÂN VIÊN</p>
            <h2 id="employee-tasks-title">Tác vụ tại quầy</h2>
            <p>Chọn nghiệp vụ để bắt đầu phục vụ khách.</p>
        </div>
        <nav className="employeeTaskNav" aria-label="Tác vụ nhân viên">
            <button type="button" className="employeeTask employeeTaskPrimary" onClick={onBookTickets} aria-labelledby="employee-task-ticket" aria-describedby="employee-task-description-ticket">
                <span className="employeeTaskIcon"><TaskIcon name="ticket" /></span>
                <span className="employeeTaskText"><strong id="employee-task-ticket">Bán vé tại quầy</strong><span id="employee-task-description-ticket">Chọn phim, giữ ghế và tạo đơn vé.</span></span>
                <span className="employeeTaskArrow" aria-hidden="true">→</span>
            </button>
            {tasks.map(task => <Link key={task.to} to={task.to} className="employeeTask" aria-labelledby={`employee-task-${task.icon}`} aria-describedby={`employee-task-description-${task.icon}`}>
                <span className="employeeTaskIcon"><TaskIcon name={task.icon} /></span>
                <span className="employeeTaskText"><strong id={`employee-task-${task.icon}`}>{task.title}</strong><span id={`employee-task-description-${task.icon}`}>{task.description}</span></span>
                <span className="employeeTaskArrow" aria-hidden="true">→</span>
            </Link>)}
        </nav>
    </aside>;
}
