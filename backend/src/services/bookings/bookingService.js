import mongoose from "mongoose";
import crypto from "node:crypto";
import QRCode from "qrcode";
import Booking from "../../models/bookings/Booking.js";
import Showtime from "../../models/cinema/Showtime.js";
import Food from "../../models/catalogue/Food.js";
import User from "../../models/users/User.js";
import PaymentAttempt from "../../models/payments/PaymentAttempt.js";
import RevenueEntry from "../../models/revenue/RevenueEntry.js";
import { transaction, domainError as fail } from "../common/transaction.js";
import { withScheduleWrite } from "../cinema/showtimeService.js";
import {
  quoteCounterPromotion,
  consumeCounterPromotion,
} from "../catalogue/counterPromotionService.js";
import { orphanSeatMessage } from "../../../../shared/seatSelection.mjs";
export const POINT_VALUE = 1000;
// Kiểm tra điểm hợp lệ, đủ số dư và không vượt giá trị đơn; chưa trừ điểm.
export function validatePoints(points, subtotal, balance) {
  const step = Number(process.env.POINT_REDEEM_STEP || 1);
  if (!Number.isSafeInteger(points) || points < 0)
    throw fail("Số điểm phải là số nguyên không âm.");
  if (points % step !== 0) throw fail(`Số điểm phải là bội số ${step}.`);
  if (points > balance)
    throw fail(`Bạn chỉ có ${balance} điểm. Vui lòng giảm số điểm sử dụng.`);
  if (points * POINT_VALUE > subtotal)
    throw fail("Giá trị điểm sử dụng không được vượt giá trị đơn.");
}
const populate = [
  { path: "showtime", populate: { path: "movie" } },
  { path: "foodItems.food" },
  { path: "user", select: "fullName email role memberPoints status" },
];
// Tính lại tổng tiền trên server: giảm khuyến mãi trước, giảm điểm sau.
async function reprice(
  booking,
  member,
  session,
  code = booking.promotion?.code || "",
) {
  const quote = await quoteCounterPromotion(code, booking, session);
  validatePoints(
    booking.pointsUsed,
    booking.subtotal - quote.discount,
    member?.memberPoints || 0,
  );
  booking.promotion = quote.promotion;
  booking.promotionDiscount = quote.discount;
  booking.discount = booking.pointsUsed * POINT_VALUE;
  booking.total = booking.subtotal - booking.discount - quote.discount;
}
// Lấy đơn kèm thông tin suất chiếu, phim, món và thành viên.
export const loadBooking = (id) => Booking.findById(id).populate(populate);
// Giải phóng ghế đang giữ của đơn; không tác động ghế đã bán.
export async function releaseSeats(booking, session) {
  await Showtime.updateOne(
    { _id: booking.showtime },
    {
      $set: {
        "seats.$[s].status": "available",
        "seats.$[s].bookingId": null,
        "seats.$[s].holdUntil": null,
      },
    },
    {
      session,
      arrayFilters: [{ "s.bookingId": booking._id, "s.status": "held" }],
    },
  );
}
// Hủy các đơn chờ quá hạn và trả ghế về trạng thái trống.
export async function expireBookings() {
  const expired = await Booking.find({
    status: "pending",
    expiresAt: { $lte: new Date() },
  })
    .select("_id")
    .limit(100);
  for (const item of expired)
    await transaction(async (session) => {
      const b = await Booking.findOne({
        _id: item._id,
        status: "pending",
        expiresAt: { $lte: new Date() },
      }).session(session);
      if (!b) return;
      b.status = "cancelled";
      b.paymentStatus = "failed";
      await b.save({ session });
      await releaseSeats(b, session);
    });
}
// Kiểm tra món/tồn kho và lưu tên, đơn giá tại lúc chọn; chưa trừ kho.
async function foodSnapshot(items, session) {
  if (!Array.isArray(items)) throw fail("Danh sách món không hợp lệ.");
  const seen = new Set(),
    result = [];
  let total = 0;
  for (const item of items) {
    if (
      !item ||
      !mongoose.isObjectIdOrHexString(item.food) ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      seen.has(String(item.food))
    )
      throw fail("Món hoặc số lượng không hợp lệ/trùng lặp.");
    seen.add(String(item.food));
    const f = await Food.findOne({
      _id: item.food,
      available: true,
      deletedAt: null,
      stock: { $gte: item.quantity },
    }).session(session);
    if (!f) throw fail("Món đã ngừng bán hoặc không đủ tồn kho.", 409);
    result.push({
      food: f._id,
      name: f.name,
      unitPrice: f.price,
      quantity: item.quantity,
    });
    total += f.price * item.quantity;
  }
  return { items: result, total };
}
// Chặn phim không được bán; tại quầy yêu cầu xác nhận tuổi/người giám hộ.
async function checkAge(movie, member, actor, guardian) {
  if (!movie || movie.deletedAt || movie.classification === "C")
    throw fail("Phim không được phép bán vé.");
  const required =
    { T13: 13, T16: 16, T18: 18 }[movie.classification] || movie.ageLimit || 0;
  if (actor) {
    if ((required > 0 || movie.classification === "K") && guardian !== true)
      throw fail(
        "Nhân viên cần xác nhận kiểm tra tuổi/điều kiện người giám hộ.",
      );
  }
}
// Read-only quote: use current catalogue prices without holding seats or consuming a code.
export async function previewMemberPromotion({ showtimeId, seats, foodItems = [], code }) {
 if (!mongoose.isObjectIdOrHexString(showtimeId) || !Array.isArray(seats) || !seats.length || seats.some(s => typeof s !== 'string') || new Set(seats).size !== seats.length) throw fail('Dữ liệu đặt vé không hợp lệ.');
 const show = await Showtime.findById(showtimeId);
 if (!show || show.cancelledAt || show.startTime <= new Date()) throw fail('Suất chiếu không còn mở bán.', 409);
 if (seats.some(number => !show.seats.some(s => s.number === number && s.status === 'available' && (!s.condition || s.condition === 'Active')))) throw fail('Ghế vừa thay đổi. Vui lòng chọn lại.', 409);
 const food = await foodSnapshot(foodItems, null);
 const subtotal = show.price * seats.length + food.total;
 const quote = await quoteCounterPromotion(code, { ticketPrice: show.price, seats, foodItems: food.items, subtotal, pointsUsed: 0 }, null);
 return { subtotal, promotion: quote.promotion, promotionDiscount: quote.discount };
}
// Tạo đơn dưới khóa ghi lịch chiếu để tránh xung đột khi sửa lịch.
export async function createBooking(data) {
  const counterRequest = data.counterEmployee && data.requestId !== undefined;
  if (counterRequest && (typeof data.requestId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(data.requestId))) throw fail('Mã yêu cầu tạo đơn không hợp lệ.');
  return withScheduleWrite(async function () {
    // Reuse the committed order when the mobile client retries a lost response.
    if (counterRequest) {
      const existing = await Booking.findOne({ counterEmployee: data.counterEmployee, counterRequestId: data.requestId }).select('_id');
      if (existing) return loadBooking(existing._id);
    }
    return createBookingWithGuard(data);
  });
}
// Kiểm tra dữ liệu, tính tiền và giữ ghế 10 phút trong cùng giao dịch.
async function createBookingWithGuard({
  userId,
  showtimeId,
  seats,
  foodItems = [],
  counterEmployee = null,
  requestId,
  points = 0,
  guardianConfirmed = false,
  promotionCode = "",
}) {
  await expireBookings();
  if (
    !mongoose.isObjectIdOrHexString(showtimeId) ||
    (!counterEmployee && !mongoose.isObjectIdOrHexString(userId)) ||
    !Array.isArray(seats) ||
    !seats.length ||
    seats.some((s) => typeof s !== "string" && typeof s !== "number") ||
    new Set(seats.map(String)).size !== seats.length
  )
    throw fail("Dữ liệu đặt vé không hợp lệ.");
  const snapshot = await Showtime.findById(showtimeId).lean();
  if (!snapshot) throw fail("Không tìm thấy suất chiếu.", 404);
  const id = await transaction(async (session) => {
    const show = await Showtime.findById(showtimeId).session(session);
    if (!show || show.cancelledAt || show.startTime <= new Date())
      throw fail("Suất chiếu không còn mở bán.", 409);
    if (
      show.price !== snapshot.price ||
      String(show.movie) !== String(snapshot.movie) ||
      show.cinema !== snapshot.cinema ||
      show.room !== snapshot.room ||
      show.startTime.getTime() !== snapshot.startTime.getTime()
    )
      throw fail("Giá hoặc lịch chiếu vừa thay đổi. Vui lòng chọn lại.", 409);
    const movie = await Movie.findById(show.movie).session(session);
    const member = userId
      ? await User.findOne({
          _id: userId,
          role: "member",
          status: { $in: ["Active", "active"] },
        }).session(session)
      : null;
    if (userId && !member) throw fail("Không tìm thấy Member đang hoạt động.");
    await checkAge(movie, member, counterEmployee, guardianConfirmed);
    const seatError = orphanSeatMessage(show.seats, seats);
    if (seatError) throw fail(seatError, 409);
    const food = await foodSnapshot(foodItems, session);
    const subtotal = show.price * seats.length + food.total;
    validatePoints(points, subtotal, member?.memberPoints || 0);
    const b = new Booking({
      user: userId || null,
      counterEmployee,
      counterRequestId: counterEmployee ? requestId : undefined,
      showtime: show._id,
      seats: seats.map(String),
      ticketPrice: show.price,
      foodItems: food.items,
      subtotal,
      pointsUsed: points,
      discount: points * POINT_VALUE,
      total: subtotal - points * POINT_VALUE,
      expiresAt: new Date(Math.min(Date.now() + 600000, show.startTime.getTime())),
      ageCheckedBy: counterEmployee,
      guardianConfirmed,
    });
    // Keep history for pending/cancelled orders too, before tickets are issued.
    b.ticketContext = {
      startTime: show.startTime,
      cinema: show.cinema,
      room: show.room,
      movieTitle: movie.title,
      classification: movie.classification || "",
      ageLimit: movie.ageLimit || 0,
    };
    await reprice(b, member, session, promotionCode);
    // Operational condition is independent of available/held/booked. Missing
    // condition on a legacy snapshot means Active, never a VIP price override.
    // Giữ ghế: tất cả ghế phải còn trống và hoạt động mới đổi available → held.
    // Gắn bookingId và hạn giữ 10 phút; điều kiện ghi ngăn hai khách giữ trùng ghế.
    const claim = await Showtime.updateOne(
      {
        _id: show._id,
        $and: b.seats.map((number) => ({
          seats: {
            $elemMatch: {
              number,
              status: "available",
              condition: { $in: ["Active", null] },
            },
          },
        })),
      },
      {
        $set: {
          "seats.$[s].status": "held",
          "seats.$[s].bookingId": b._id,
          "seats.$[s].holdUntil": b.expiresAt,
        },
      },
      {
        session,
        arrayFilters: [
          {
            "s.number": { $in: b.seats },
            "s.status": "available",
            "s.condition": { $in: ["Active", null] },
          },
        ],
      },
    );
    if (claim.modifiedCount !== 1)
      throw fail("Ghế vừa được giữ/bán. Vui lòng chọn lại.", 409);
    await b.save({ session });
    return b._id;
  });
  return loadBooking(id);
}
import Movie from "../../models/movies/Movie.js";
// Chỉ cho sửa đơn đúng chủ, còn hạn và chưa có thanh toán đang xử lý.
async function pending(id, userId, session) {
  const b = await Booking.findOne({ _id: id, user: userId }).session(session);
  if (!b) throw fail("Không tìm thấy đơn.", 404);
  if (b.status !== "pending" || b.expiresAt <= new Date())
    throw fail("Đơn không còn được phép chỉnh sửa.", 410);
  if (b.activePayment || b.paymentProcessing)
    throw fail(
      "Đơn đang có giao dịch thanh toán. Xử lý kết quả hoặc đối soát trước khi sửa.",
      409,
    );
  return b;
}
// Cập nhật số điểm dự kiến dùng và tính lại tiền; chưa trừ điểm thực tế.
export async function applyMemberPoints(id, userId, points) {
  await transaction(async (session) => {
    const b = await pending(id, userId, session);
    const u =
      userId &&
      (await User.findOne({
        _id: userId,
        role: "member",
        status: { $in: ["Active", "active"] },
      }).session(session));
    if (!u) throw fail("Khách vãng lai không được dùng điểm.");
    // Chỉ lưu điểm dự kiến; reprice kiểm tra số dư và khuyến mãi trước khi lưu đơn.
    b.pointsUsed = points;
    await reprice(b, u, session);
    await b.save({ session });
  });
  return loadBooking(id);
}
// Thay bắp nước và tính lại tiền, giữ nguyên đơn giá vé đã lưu.
export async function updateFoods(id, userId, items) {
  await transaction(async (session) => {
    const b = await pending(id, userId, session);
    const f = await foodSnapshot(items, session);
    if (!Number.isFinite(b.ticketPrice))
      throw fail("Đơn cũ thiếu snapshot giá vé. Vui lòng hủy và đặt lại.", 409);
    const subtotal = b.ticketPrice * b.seats.length + f.total;
    const u = b.user && (await User.findById(b.user).session(session));
    b.foodItems = f.items;
    b.subtotal = subtotal;
    await reprice(b, u, session);
    await b.save({ session });
  });
  return loadBooking(id);
}
// Bỏ điểm dự kiến dùng khi khách chủ động chọn thay bằng mã khuyến mãi.
function replacePromotionPoints(booking, code, replacePoints) {
  if (
    typeof replacePoints !== "boolean" ||
    (replacePoints && (typeof code !== "string" || !code.trim()))
  )
    throw fail("Chỉ bỏ điểm khi áp dụng một mã khuyến mãi hợp lệ.");
  if (replacePoints) booking.pointsUsed = 0;
}
// Áp dụng, đổi hoặc bỏ mã khuyến mãi cho đơn tại quầy.
export async function applyCounterPromotion(
  id,
  userId,
  code,
  replacePoints = false,
) {
  await transaction(async (session) => {
    const b = await pending(id, userId, session);
    if (!b.counterEmployee)
      throw fail("Chỉ áp dụng khuyến mãi cho đơn tại quầy.", 403);
    const member = b.user && (await User.findById(b.user).session(session));
    replacePromotionPoints(b, code, replacePoints);
    await reprice(b, member, session, code);
    await b.save({ session });
  });
  return loadBooking(id);
}
// Áp dụng, đổi hoặc bỏ mã cho đơn online của chính thành viên.
export async function applyMemberPromotion(
  id,
  userId,
  code,
  replacePoints = false,
) {
  await transaction(async (session) => {
    const b = await pending(id, userId, session);
    if (b.counterEmployee)
      throw fail(
        "Thành viên chỉ được đổi mã trên đơn đặt vé trực tuyến của mình.",
        403,
      );
    const member = await User.findOne({
      _id: userId,
      role: "member",
      status: { $in: ["Active", "active"] },
    }).session(session);
    if (!member) throw fail("Tài khoản thành viên không còn hoạt động.", 403);
    replacePromotionPoints(b, code, replacePoints);
    await reprice(b, member, session, code);
    await b.save({ session });
  });
  return loadBooking(id);
}
// Hủy đơn chưa thanh toán và trả ghế; khoản thu chưa rõ phải đối soát trước.
export async function cancelBooking(id, userId) {
  await transaction(async (session) => {
    const b = await Booking.findOne({ _id: id, user: userId }).session(session);
    if (!b) throw fail("Không tìm thấy đơn.", 404);
    if (["paid", "refund-requested", "refunded"].includes(b.status))
      throw fail("Vé đã thanh toán hoặc đang hoàn điểm không thể hủy giữ ghế.");
    if (b.status === "cancelled") return;
    if (b.activePayment) {
      const payment = await PaymentAttempt.findOne({
        ref: b.activePayment,
      }).session(session);
      if (
        payment?.collectedAt ||
        payment?.providerRef ||
        payment?.status === "unresolved"
      )
        throw fail(
          "Đã ghi nhận khoản thu hoặc giao dịch chưa rõ kết quả. Cần đối soát trước khi hủy.",
          409,
        );
    }
    b.status = "cancelled";
    b.paymentStatus = "failed";
    await b.save({ session });
    await releaseSeats(b, session);
  });
  return loadBooking(id);
}
// Trusted server-only finalization. Client routes cannot pass settlement evidence.
// Hoàn tất thanh toán từ bằng chứng đã xác minh; mọi thay đổi cùng giao dịch, lỗi thì hoàn tác.
export async function settle(id, evidence) {
  const result = await transaction(async (session) => {
    const b = await Booking.findById(id).session(session);
    if (!b) throw fail("Không tìm thấy đơn.", 404);
    // Cùng giao dịch đã hoàn tất thì trả đơn cũ, tránh trừ điểm/kho và tạo vé lặp.
    if (b.status === "paid") {
      if (
        (evidence.ref && evidence.ref !== b.paymentRef) ||
        (evidence.kind === "vnpay" &&
          (!evidence.verified || b.paymentMethod !== "vnpay"))
      )
        throw fail(
          "Đơn đã thanh toán bằng giao dịch khác; cần đối soát khoản thu này.",
          409,
        );
      return b._id;
    }
    if (b.status !== "pending" || !b.expiresAt || b.expiresAt <= new Date())
      throw fail("Đơn đã hủy hoặc hết hạn.", 410);
    const show = await Showtime.findById(b.showtime).session(session);
    if (!show || show.cancelledAt || show.startTime <= new Date())
      throw fail("Suất đã bắt đầu hoặc đã hủy.", 409);
    const finalMovie = await Movie.findById(show.movie).session(session);
    const finalMember = b.user
      ? await User.findById(b.user).session(session)
      : null;
    await checkAge(
      finalMovie,
      finalMember,
      b.counterEmployee,
      b.guardianConfirmed,
    );
    let attempt;
    if (
      evidence.kind === "vnpay" ||
      (evidence.kind === "cash" && evidence.ref)
    ) {
      attempt = await PaymentAttempt.findOne({
        ref: evidence.ref,
        booking: b._id,
        method: evidence.kind,
        status: { $in: ["created", "unresolved"] },
        amount: b.total,
        currency: "VND",
      }).session(session);
      if (!attempt || b.activePayment !== attempt.ref)
        throw fail("Bằng chứng thanh toán không hợp lệ.", 409);
      if (
        evidence.kind === "vnpay" &&
        (!evidence.verified || !evidence.providerRef)
      )
        throw fail("VNPay chưa xác nhận giao dịch.", 409);
      if (evidence.kind === "cash" && (!attempt.collectedAt || !attempt.actor))
        throw fail("Chưa có biên nhận tiền mặt.", 409);
    } else if (b.activePayment) throw fail("Đơn đang có giao dịch VNPay.", 409);
    if (evidence.kind === "points" && b.total !== 0)
      throw fail("Chỉ xác nhận bằng điểm khi số tiền còn lại bằng 0.");
    if (evidence.kind === "cash") {
      const actor = await User.findOne({
        _id: evidence.actor,
        role: { $in: ["admin", "employee"] },
        status: { $in: ["Active", "active"] },
      }).session(session);
      const received = attempt
        ? attempt.receivedAmount
        : evidence.receivedAmount;
      if (
        !actor ||
        !Number.isSafeInteger(received) ||
        received < b.total ||
        b.total <= 0
      )
        throw fail("Nhân viên cần xác nhận đủ số tiền thực thu.", 403);
      b.cashReceived = received;
      b.change = received - b.total;
    }
    if (
      evidence.kind === "demo" &&
      (process.env.NODE_ENV === "production" ||
        process.env.ENABLE_PAYMENT_SIMULATION !== "true")
    )
      throw fail(
        "Thanh toán giả lập chưa được bật cho môi trường development.",
        403,
      );
    if (!["demo", "cash", "points", "vnpay"].includes(evidence.kind))
      throw fail("Phương thức không được hỗ trợ.");
    // Trừ điểm, trừ kho và chuyển ghế đang giữ thành ghế đã bán.
    if (b.user) {
      const member = await User.findOne({
        _id: b.user,
        role: "member",
        status: { $in: ["Active", "active"] },
      }).session(session);
      if (!member || member.memberPoints < b.pointsUsed)
        throw fail("Số dư điểm đã thay đổi hoặc tài khoản bị khóa.", 409);
      // Trừ điểm thực tế và ghi lịch sử trong giao dịch hoàn tất đơn; lỗi thì hoàn tác.
      if (b.pointsUsed)
        await User.updateOne(
          { _id: b.user, memberPoints: { $gte: b.pointsUsed } },
          {
            $inc: { memberPoints: -b.pointsUsed },
            $push: {
              redemptionEntries: {
                booking: b._id,
                delta: -b.pointsUsed,
                at: new Date(),
              },
            },
          },
          { session },
        );
    } else if (b.pointsUsed) throw fail("Đơn vãng lai không được dùng điểm.");
    // Chỉ trừ kho khi hoàn tất thanh toán; điều kiện stock ngăn nhiều đơn bán quá tồn.
    for (const item of b.foodItems) {
      const stock = await Food.updateOne(
        {
          _id: item.food,
          available: true,
          deletedAt: null,
          stock: { $gte: item.quantity },
        },
        { $inc: { stock: -item.quantity } },
        { session },
      );
      if (stock.modifiedCount !== 1)
        throw fail("Món đã hết hàng, chưa thể hoàn tất thanh toán.", 409);
    }
    // Hoàn tất thanh toán: chỉ đổi held → booked nếu mọi ghế còn thuộc đơn và chưa hết hạn giữ.
    const sold = await Showtime.updateOne(
      {
        _id: b.showtime,
        $and: b.seats.map((number) => ({
          seats: {
            $elemMatch: {
              number,
              status: "held",
              bookingId: b._id,
              holdUntil: { $gt: new Date() },
            },
          },
        })),
      },
      { $set: { "seats.$[s].status": "booked", "seats.$[s].holdUntil": null } },
      { session, arrayFilters: [{ "s.bookingId": b._id, "s.status": "held" }] },
    );
    if (sold.modifiedCount !== 1) throw fail("Giữ ghế không còn hợp lệ.", 409);
    // Tạo mã QR riêng cho từng ghế, ghi lượt khuyến mãi và biên nhận thanh toán.
    const issuedAt = new Date();
    b.ticketMode = evidence.kind === "demo" ? "demo" : "verified";
    b.ticketContext = {
      startTime: show.startTime,
      cinema: show.cinema,
      room: show.room,
      movieTitle: finalMovie.title,
      classification: finalMovie.classification || "",
      ageLimit: finalMovie.ageLimit || 0,
    };
    b.tickets = [];
    for (const seat of b.seats) {
      const code = crypto.randomBytes(24).toString("hex");
      b.tickets.push({
        seat,
        code,
        reference: code,
        qr: await QRCode.toDataURL(
          JSON.stringify({ ticket: code, booking: String(b._id), seat }),
          { width: 220, margin: 1 },
        ),
        status: "valid",
        issuedAt,
      });
    }
    await consumeCounterPromotion(b, session);
    if (!attempt) {
      const created = await PaymentAttempt.create(
        [
          {
            ref: crypto.randomUUID(),
            booking: b._id,
            amount: b.total,
            method: evidence.kind,
            status: "succeeded",
            receivedAmount: evidence.receivedAmount,
            actor: evidence.actor,
          },
        ],
        { session },
      );
      attempt = created[0];
    } else {
      attempt.status = "succeeded";
      attempt.message = undefined;
      if (evidence.providerRef) attempt.providerRef = evidence.providerRef;
      if (evidence.reason)
        attempt.reconciliation.push({
          action: "retry",
          reason: evidence.reason,
          actor: evidence.actor,
          at: new Date(),
        });
      await attempt.save({ session });
    }
    // Kiểm tra hạn lần cuối, ghi doanh thu và đánh dấu đơn đã thanh toán.
    const paidAt = new Date();
    if (paidAt > b.expiresAt || paidAt >= show.startTime)
      throw fail("Đã hết thời gian hoàn tất. Khoản thu cần đối soát.", 410);
    if (evidence.kind !== "demo") {
      const discounts = b.promotionDiscount || 0;
      if (
        ![b.subtotal, discounts, b.discount, b.total].every(
          (value) => Number.isSafeInteger(value) && value >= 0,
        ) ||
        b.subtotal - discounts - b.discount !== b.total
      )
        throw fail("Cơ cấu tiền của đơn không khớp.", 409);
      await RevenueEntry.create(
        [
          {
            booking: b._id,
            reference: attempt.ref,
            kind: "payment",
            method: evidence.kind,
            evidence:
              evidence.kind === "cash"
                ? "employee-receipt"
                : evidence.kind === "points"
                  ? "points-ledger"
                  : "provider-confirmation",
            confirmedAt: attempt.collectedAt || paidAt,
            currency: "VND",
            gross: b.subtotal,
            discounts,
            fees: 0,
            points: b.discount,
            amount: b.total,
          },
        ],
        { session },
      );
    }
    b.status = "paid";
    b.paymentStatus = "paid";
    b.paymentMethod = evidence.kind;
    b.paymentRef = attempt.ref;
    b.activePayment = null;
    b.paymentIssue = undefined;
    b.paidAt = paidAt;
    await b.save({ session });
    return b._id;
  });
  return loadBooking(result);
}
// Chặn trình duyệt tự xác nhận đã thanh toán.
export async function pay() {
  throw fail("Không chấp nhận xác nhận thanh toán từ trình duyệt.", 403);
}
// Lấy lịch sử đơn của thành viên, sắp xếp đơn mới nhất trước.
export const listBookings = (userId) =>
  Booking.find({ user: userId })
    .select(
      "showtime ticketContext ticketMode seats ticketPrice foodItems subtotal pointsUsed discount promotion promotionDiscount total status paymentMethod paymentStatus paymentRef activePayment cashReceived change paymentIssue expiresAt tickets paidAt createdAt updatedAt refund cinemaCancellation",
    )
    .populate([
      {
        path: "showtime",
        select: "movie cinema room startTime",
        populate: { path: "movie", select: "title poster banner" },
      },
      { path: "foodItems.food", select: "name" },
    ])
    .sort({ createdAt: -1, _id: -1 });

// Mô phỏng thanh toán thất bại khi phát triển; không trừ điểm/kho hay tạo vé.
export async function simulationFailure(id) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.ENABLE_PAYMENT_SIMULATION !== "true"
  )
    throw fail("Giả lập chỉ được bật ở development.", 403);
  const b = await Booking.findById(id);
  if (!b || b.status !== "pending" || b.expiresAt <= new Date())
    throw fail("Đơn không còn hiệu lực.", 410);
  await PaymentAttempt.create({
    ref: crypto.randomUUID(),
    booking: b._id,
    amount: b.total,
    method: "demo",
    status: "failed",
    message: "User-selected simulated failure",
  });
  return loadBooking(id);
}
