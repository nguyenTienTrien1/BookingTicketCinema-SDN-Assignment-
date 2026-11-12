const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ';
const labels = { pending: 'Chờ thanh toán', payment_received: 'Đã nhận tiền, chưa hoàn tất', reconciliation: 'Cần đối soát', paid: 'Đã thanh toán', cancelled: 'Đã hủy', returned: 'Đã trả tiền khách' };
export default function StaffFoodReceipt({ order, onReconcile }) {
  const unresolved = ['payment_received', 'reconciliation'].includes(order.status);
  return <section className="moviePanel movieForm staffFoodReceipt" aria-label="Kết quả tra cứu F&B">
    <div className="staffReceiptHeading"><div><span className="staffOrderKind">ĐƠN F&B · TIỀN MẶT</span><h2>Đơn bán đồ ăn & thức uống</h2></div><span className={'staffOrderStatus status-' + order.status}>{labels[order.status] || order.status}</span></div>
    <p className="staffOrderReference">Mã đơn: {order._id}</p>
    {order.employee?.fullName && <p>Nhân viên ghi nhận: {order.employee.fullName}</p>}
    <div className="movieTableWrap"><table className="movieTable"><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Thành tiền</th></tr></thead><tbody>{order.items.map(item => <tr key={item.food}><td>{item.name}<small>{money(item.unitPrice)} / phần</small></td><td>{item.quantity}</td><td>{money(item.quantity * item.unitPrice)}</td></tr>)}</tbody></table></div>
    <dl className="staffReceiptAmounts"><div><dt>Tổng đơn</dt><dd>{money(order.total)}</dd></div>{order.cashReceived != null && <><div><dt>Khách đưa</dt><dd>{money(order.cashReceived)}</dd></div><div><dt>Tiền thừa đã ghi nhận</dt><dd>{money(order.change)}</dd></div></>}{order.status === 'returned' && <div><dt>Đã trả lại khoản thực thu</dt><dd>{money(order.returnedAmount)}</dd></div>}</dl>
    {order.paidAt && <p className="helperText">Thanh toán lúc {new Date(order.paidAt).toLocaleString('vi-VN')}</p>}
    {order.status === 'paid' && <p className="staffToolsSuccess">Đơn đã hoàn tất. Không thu thêm tiền và không cần đối soát.</p>}
    {order.status === 'pending' && <p className="staffToolsHint">Đơn chưa ghi nhận tiền. Nhân viên tạo đơn tiếp tục nhận tiền tại màn hình Bán F&B; đơn này chưa cần đối soát.</p>}
    {unresolved && <><p className="staffToolsWarning">{order.issue || 'Đã ghi nhận khoản thu nhưng chưa xác nhận hoàn tất.'} Không thu tiền lần nữa.</p><button className="moviePrimary" type="button" onClick={onReconcile}>Mở đối soát đơn F&B</button></>}
  </section>;
}
