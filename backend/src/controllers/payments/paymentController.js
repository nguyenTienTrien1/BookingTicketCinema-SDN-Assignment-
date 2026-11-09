import Booking from "../../models/bookings/Booking.js";
import User from "../../models/users/User.js";
import Food from "../../models/catalogue/Food.js";
import PaymentAttempt from "../../models/payments/PaymentAttempt.js";
import PointRefund from "../../models/payments/PointRefund.js";
import {
  settle,
  loadBooking,
  simulationFailure,
} from "../../services/bookings/bookingService.js";
import {
  createPayment,
  processIPN,
  processSandboxReturn,
} from "../../services/payments/vnpayService.js";
import { domainError as fail } from "../../services/common/transaction.js";
import {
  payStaffBooking,
  listReconciliation,
  reconcilePayment,
} from "../../services/payments/counterPaymentService.js";
import { ownedTickets } from "../../services/bookings/ticketService.js";
import { validateMobileReturn } from '../../services/payments/mobileReturn.js';
// Trả kết quả giao dịch, đơn và vé; thành viên chỉ xem được đơn của mình.
export async function result(req, res, next) {
  try {
    const attempt = await PaymentAttempt.findOne({
      ref: req.params.reference,
      method: "vnpay",
    });
    if (!attempt) throw fail("Không tìm thấy giao dịch.", 404);
    const filter = { _id: attempt.booking };
    if (req.user.role === "member") filter.user = req.user._id;
    const booking = await Booking.findOne(filter);
    if (!booking) throw fail("Không tìm thấy giao dịch.", 404);
    const refund = await PointRefund.findOne({
      reference: attempt.ref,
      booking: booking._id,
    })
      .select("reference kind status rate amount points completedAt")
      .lean();
    let ticketDetails;
    if (
      req.user.role !== "member" &&
      attempt.status === "succeeded" &&
      booking.status === "paid" &&
      booking.paymentRef === attempt.ref
    ) {
      try {
        ticketDetails = await ownedTickets(booking._id, booking.user);
      } catch {
        ticketDetails = {
          tickets: [],
          message:
            "Chưa tải được vé. Vui lòng kiểm tra lại trạng thái hoặc liên hệ quản lý.",
        };
      }
    }
    res
      .set("Cache-Control", "no-store")
      .json({
        status: attempt.status,
        booking: await loadBooking(booking._id),
        refund,
        ticketDetails,
      });
  } catch (e) {
    next(e);
  }
}
// Nhận yêu cầu thanh toán của chủ đơn và gọi service theo phương thức đã chọn.
export async function start(req, res, next) {
  try {
    const b = await Booking.findOne({ _id: req.params.id, user: req.user._id });
    if (!b) throw fail("Không tìm thấy đơn.", 404);
    if (b.status === "paid") return res.json(await loadBooking(b._id));
    if (req.body.method === "demo" && req.body.result === "failed")
      return res.json(await simulationFailure(b._id));
    if (req.body.method === "demo")
      return res.json(
        await settle(b._id, { kind: b.total === 0 ? "points" : "demo" }),
      );
    if (req.body.method === "points")
      return res.json(await settle(b._id, { kind: "points" }));
    if (req.body.method === "cash") {
      if (b.status !== "pending" || b.expiresAt <= new Date())
        throw fail("Đơn đã hủy hoặc hết hạn.", 410);
      if (b.activePayment)
        throw fail(
          "Đơn đang chờ kết quả VNPay. Chưa thể chuyển sang tiền mặt.",
          409,
        );
      return res.json({
        status: "pending",
        message: "Mang mã đơn tới quầy trước khi hết hạn.",
        booking: await loadBooking(b._id),
      });
    }
    if (req.body.method !== "vnpay")
      throw fail("Chọn thanh toán giả lập hoặc phương thức hợp lệ.");
    res.json(await createPayment(b._id, req.user._id, req.ip, null, req.body.mobileReturnTo || null));
  } catch (e) {
    next(e);
  }
}
// Chuyển yêu cầu thu tiền tại quầy cho service; chưa hoàn tất thì trả HTTP 202.
export async function cash(req, res, next) {
  try {
    if (
      req.body.method &&
      !["cash", "demo", "points"].includes(req.body.method)
    )
      throw fail("Dùng chức năng thanh toán để chọn VNPay.");
    const result = await payStaffBooking(
      req.params.id,
      req.body,
      req.user._id,
      req.ip,
    );
    res
      .status(
        result.status === "pending" && result.cashReceived > 0 ? 202 : 200,
      )
      .json(result);
  } catch (e) {
    next(e);
  }
}
// Xử lý thanh toán tại quầy qua service dành cho nhân viên/admin.
export async function staffPay(req, res, next) {
  try {
    const result = await payStaffBooking(
      req.params.id,
      req.body,
      req.user._id,
      req.ip,
    );
    res
      .status(
        result.status === "pending" && result.cashReceived > 0 ? 202 : 200,
      )
      .json(result);
  } catch (error) {
    next(error);
  }
}
// Nhận thông báo VNPay, gọi service xác minh và phản hồi mã kết quả xử lý.
export async function ipn(req, res) {
  try {
    res.json(await processIPN(req.query));
  } catch {
    res.json({ RspCode: "99", Message: "Retry later" });
  }
}
// Xử lý dự phòng Sandbox rồi chuyển trình duyệt về trang kết quả để đọc trạng thái từ server.
export async function returnUrl(req, res) {
  try {
    await processSandboxReturn(req.query);
  } catch {
    console.warn(
      "[VNPAY] Sandbox return could not be finalized; check IPN/payment status.",
    );
  }
  if (typeof req.query.vnp_TxnRef === 'string') {
    const attempt = await PaymentAttempt.findOne({ ref: req.query.vnp_TxnRef, method: 'vnpay' }).select('mobileReturnTo').catch(() => null);
    if (attempt?.mobileReturnTo) {
      try {
        const target = new URL(validateMobileReturn(attempt.mobileReturnTo));
        target.searchParams.set('reference', req.query.vnp_TxnRef);
        const href = target.toString().replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
        const script = JSON.stringify(target.toString()).replaceAll('<', '\\u003c');
        return res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).type('html').send(`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CINEMA+</title><body style="background:#090b10;color:white;font:18px system-ui;padding:32px"><h1>CINEMA+</h1><p>Quay lại app để kiểm tra kết quả từ máy chủ.</p><a style="color:#ff7a96" href="${href}">Mở lại Expo Go</a><script>location.href=${script}</script></body></html>`);
      } catch { /* An obsolete app address falls back to the existing website. */ }
    }
  }
  const url = new URL(
    "/payment-result",
    process.env.CLIENT_URL ||
      process.env.FRONTEND_URL ||
      "http://localhost:5173",
  );
  if (typeof req.query.vnp_TxnRef === "string")
    url.searchParams.set("reference", req.query.vnp_TxnRef);
  res.redirect(url.toString());
}
// Lấy danh sách khoản thu cần đối soát, không lưu cache kết quả.
export async function reconciliation(req, res, next) {
  try {
    res.set("Cache-Control", "no-store").json(await listReconciliation());
  } catch (error) {
    next(error);
  }
}
// Chuyển yêu cầu xử lý khoản thu cần đối soát cho service.
export async function resolvePayment(req, res, next) {
  try {
    res.json(
      await reconcilePayment(req.params.reference, req.body, req.user._id),
    );
  } catch (error) {
    next(error);
  }
}
// Kiểm tra và lưu tuổi đã xác minh của thành viên cùng người xác minh.
export async function verifyAge(req, res, next) {
  try {
    if (
      !Number.isInteger(req.body.age) ||
      req.body.age < 0 ||
      req.body.age > 120
    )
      throw fail("Tuổi không hợp lệ.");
    const u = await User.findOneAndUpdate(
      { _id: req.params.id, role: "member" },
      { $set: { verifiedAge: req.body.age, ageVerifiedBy: req.user._id } },
      { new: true },
    ).select("fullName verifiedAge");
    if (!u) throw fail("Không tìm thấy Member.", 404);
    res.json(u);
  } catch (e) {
    next(e);
  }
}
// Tra cứu thông tin đơn đặt vé theo mã đơn.
export async function lookup(req, res, next) {
  try {
    const b = await loadBooking(req.params.id);
    if (!b) throw fail("Không tìm thấy đơn.", 404);
    res.set("Cache-Control", "no-store").json(b);
  } catch (e) {
    next(e);
  }
}

export async function staffTickets(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id).select('user');
    if (!booking) throw fail('Không tìm thấy đơn.', 404);
    res.set('Cache-Control', 'no-store').json(await ownedTickets(booking._id, booking.user));
  } catch (error) { next(error); }
}

// Xem/cập nhật tồn kho; chặn ghi đè nếu số tồn đã thay đổi.
export async function stock(req, res, next) {
  try {
    if (req.method === "GET") return res.json(await Food.find());
    if (!Number.isSafeInteger(req.body.stock) || req.body.stock < 0)
      throw fail("Tồn kho phải là số nguyên không âm.");
    const food = await Food.findOneAndUpdate(
      {
        _id: req.params.id,
        ...(req.body.expectedStock === 0
          ? { $or: [{ stock: 0 }, { stock: { $exists: false } }] }
          : { stock: req.body.expectedStock }),
      },
      { $set: { stock: req.body.stock } },
      { new: true },
    );
    if (!food) throw fail("Tồn kho đã thay đổi. Tải lại trước khi sửa.", 409);
    res.json(food);
  } catch (e) {
    next(e);
  }
}

// Tra cứu vé và suất chiếu theo mã vé.
export async function ticket(req, res, next) {
  try {
    const booking = await Booking.findOne({
      "tickets.code": req.params.code,
    }).populate({ path: "showtime", populate: { path: "movie" } });
    if (!booking) throw fail("Mã vé không tồn tại.", 404);
    const ticket = booking.tickets.find((t) => t.code === req.params.code);
    res.json({
      booking: booking._id,
      status: booking.status,
      ticket,
      showtime: booking.showtime,
    });
  } catch (e) {
    next(e);
  }
}
