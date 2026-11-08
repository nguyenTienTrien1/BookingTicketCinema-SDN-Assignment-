import * as s from "../../services/bookings/bookingService.js";
export async function promotionPreview(req,res,next){try{
 if(typeof req.body?.code!=='string'||!req.body.code.trim())return res.status(400).json({message:'Vui lòng nhập mã khuyến mãi.'});
 res.set('Cache-Control','no-store').json(await s.previewMemberPromotion(req.body));
}catch(e){next(e);}}
// Tạo đơn online: lấy chủ đơn từ tài khoản đăng nhập, không tin userId do khách gửi.
export async function create(req, res, next) {
  try {
    res
      .status(201)
      .json(
        await s.createBooking({
          ...req.body,
          userId: req.user._id,
          counterEmployee: null,
        }),
      );
  } catch (e) {
    next(e);
  }
}
// Đổi số điểm dự kiến dùng trên đơn của khách, chưa trừ điểm thực tế.
export async function points(req, res, next) {
  try {
    res.json(
      await s.applyMemberPoints(
        req.params.id,
        req.user._id,
        Number(req.body.points),
      ),
    );
  } catch (e) {
    next(e);
  }
}
// Áp dụng/đổi mã khuyến mãi; chuỗi rỗng dùng để bỏ mã đang áp dụng.
export async function promotion(req, res, next) {
  try {
    if (typeof req.body?.code !== "string")
      return res
        .status(400)
        .json({
          message: "Vui lòng gửi mã khuyến mãi; dùng chuỗi rỗng để bỏ mã.",
        });
    res.json(
      await s.applyMemberPromotion(
        req.params.id,
        req.user._id,
        req.body.code,
        req.body.replacePoints,
      ),
    );
  } catch (e) {
    next(e);
  }
}
// Luồng cũ bị service chặn để khách không tự xác nhận đã trả tiền.
export async function payment(req, res, next) {
  try {
    res.json(await s.pay(req.params.id, req.user._id, req.body.method));
  } catch (e) {
    next(e);
  }
}
// Lấy lịch sử đơn của người đăng nhập; không lưu cache dữ liệu trả về.
export async function list(req, res, next) {
  try {
    const bookings = await s.listBookings(req.user._id);
    res.set("Cache-Control", "no-store").json(bookings);
  } catch (error) {
    next(error);
  }
}

// Xem chi tiết đơn sau khi kiểm tra đơn thuộc đúng người đăng nhập.
export async function view(req, res, next) {
  try {
    const b = await s.loadBooking(req.params.id);
    if (!b || String(b.user?._id) !== String(req.user._id))
      return res.status(404).json({ message: "Không tìm thấy đơn." });
    res.json(b);
  } catch (e) {
    next(e);
  }
}
// Thay bắp nước và để service kiểm tra, tính lại tổng tiền đơn.
export async function food(req, res, next) {
  try {
    res.json(
      await s.updateFoods(req.params.id, req.user._id, req.body.foodItems),
    );
  } catch (e) {
    next(e);
  }
}
// Hủy đơn chưa thanh toán và giải phóng ghế qua service.
export async function cancel(req, res, next) {
  try {
    res.json(await s.cancelBooking(req.params.id, req.user._id));
  } catch (e) {
    next(e);
  }
}
