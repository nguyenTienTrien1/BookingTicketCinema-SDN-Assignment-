import crypto from "node:crypto";
import Booking from "../../models/bookings/Booking.js";
import PaymentAttempt from "../../models/payments/PaymentAttempt.js";
import User from "../../models/users/User.js";
import { settle, loadBooking } from "../bookings/bookingService.js";
import { transaction, domainError as fail } from "../common/transaction.js";
import { refundFailedPayment } from "./refundService.js";
import { validateMobileReturn } from './mobileReturn.js';
// Sắp xếp, mã hóa tham số vnp_ và bỏ trường chữ ký để tạo chuỗi ký thống nhất.
export function canonical(params) {
  return Object.keys(params)
    .filter(
      (k) =>
        k.startsWith("vnp_") &&
        !["vnp_SecureHash", "vnp_SecureHashType"].includes(k),
    )
    .sort()
    .map(
      (k) =>
        encodeURIComponent(k) +
        "=" +
        encodeURIComponent(params[k]).replace(/%20/g, "+"),
    )
    .join("&");
}
// Tạo chữ ký HMAC-SHA512 bằng khóa bí mật để ký yêu cầu và đối chiếu kết quả.
export function signature(params, secret = process.env.VNPAY_HASH_SECRET) {
  if (!secret) throw fail("Chưa cấu hình VNPay sandbox.", 503);
  return crypto
    .createHmac("sha512", secret)
    .update(canonical(params))
    .digest("hex");
}
// Định dạng thời gian yyyyMMddHHmmss theo múi giờ Việt Nam cho VNPay.
function date(value) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (key) => p.find((x) => x.type === key).value;
  return ["year", "month", "day", "hour", "minute", "second"].map(get).join("");
}
// Kiểm tra đơn, tạo/dùng lại mã giao dịch và trả URL VNPay có chữ ký; chưa ghi nhận đã trả tiền.
export async function createPayment(bookingId, userId, ip, staffId = null, mobileReturnTo = null) {
  if (mobileReturnTo) mobileReturnTo = validateMobileReturn(mobileReturnTo);
  if (
    !process.env.VNPAY_TMN_CODE ||
    !process.env.VNPAY_HASH_SECRET ||
    !process.env.VNPAY_RETURN_URL
  )
    throw fail(
      "Cần cấu hình VNPAY_TMN_CODE, VNPAY_HASH_SECRET và VNPAY_RETURN_URL trong backend/.env.",
      503,
    );
  const attempt = await transaction(async (session) => {
    const filter = { _id: bookingId, user: userId };
    if (staffId) {
      const actor = await User.findOne({
        _id: staffId,
        role: { $in: ["employee", "admin"] },
        status: { $in: ["Active", "active"] },
      }).session(session);
      if (!actor) throw fail("Không có quyền tạo thanh toán tại quầy.", 403);
      delete filter.user;
    }
    const b = await Booking.findOne(filter).session(session);
    if (
      !b ||
      b.status !== "pending" ||
      !b.expiresAt ||
      b.expiresAt <= new Date()
    )
      throw fail("Đơn không còn hiệu lực.", 410);
    if (b.total <= 0) throw fail("Đơn 0đ phải dùng thanh toán bằng điểm.");
    if (b.activePayment) {
      const a = await PaymentAttempt.findOne({ ref: b.activePayment }).session(
        session,
      );
      if (a?.status === "created" && a.method === "vnpay") {
        if (mobileReturnTo) { a.mobileReturnTo = mobileReturnTo; await a.save({ session }); }
        return a;
      }
      if (a?.status === "unresolved")
        throw fail(
          "Giao dịch đang cần đối soát. Không thanh toán lại; vui lòng liên hệ nhân viên.",
          409,
        );
    }
    const a = new PaymentAttempt({
      ref: crypto.randomBytes(12).toString("hex"),
      booking: b._id,
      amount: b.total,
      method: "vnpay",
      expiresAt: b.expiresAt,
      actor: staffId || undefined,
      mobileReturnTo: mobileReturnTo || undefined,
    });
    await a.save({ session });
    b.activePayment = a.ref;
    await b.save({ session });
    return a;
  });
  // Lấy số tiền đã lưu trên server, nhân 100 theo định dạng VNPay.
  const params = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_Amount: String(attempt.amount * 100),
    vnp_CurrCode: "VND",
    vnp_TxnRef: attempt.ref,
    vnp_OrderInfo: "Thanh toan ve " + bookingId,
    vnp_OrderType: "other",
    vnp_Locale: "vn",
    vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
    vnp_IpAddr: ip === "::1" ? "127.0.0.1" : String(ip).replace("::ffff:", ""),
    vnp_CreateDate: date(attempt.createdAt),
    vnp_ExpireDate: date(attempt.expiresAt),
  };
  return {
    paymentUrl:
      (process.env.VNPAY_URL ||
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html") +
      "?" +
      canonical(params) +
      "&vnp_SecureHash=" +
      signature(params),
    reference: attempt.ref,
  };
}
// Xác minh kết quả VNPay rồi hoàn tất đơn; callback lặp không xử lý thanh toán lần nữa.
export async function processIPN(params) {
  // Kiểm tra chữ ký, merchant, mã giao dịch và số tiền trước khi cập nhật đơn.
  if (
    Object.values(params).some((value) => typeof value !== "string") ||
    !/^[a-f0-9]{128}$/i.test(params.vnp_SecureHash || "")
  )
    return { RspCode: "97", Message: "Invalid signature" };
  const expected = signature(params);
  if (
    !crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(params.vnp_SecureHash, "hex"),
    )
  )
    return { RspCode: "97", Message: "Invalid signature" };
  if (params.vnp_TmnCode !== process.env.VNPAY_TMN_CODE)
    return { RspCode: "97", Message: "Merchant mismatch" };
  const attempt = await PaymentAttempt.findOne({
    ref: params.vnp_TxnRef,
    method: "vnpay",
  });
  if (!attempt) return { RspCode: "01", Message: "Order not found" };
  if (
    !/^\d+$/.test(params.vnp_Amount) ||
    Number(params.vnp_Amount) !== attempt.amount * 100 ||
    (params.vnp_CurrCode && params.vnp_CurrCode !== "VND")
  )
    return { RspCode: "04", Message: "Invalid amount" };
  if (attempt.status === "succeeded")
    return { RspCode: "02", Message: "Already confirmed" };
  if (attempt.status === "refunded" || attempt.status === "returned")
    return { RspCode: "02", Message: "Already refunded" };
  // Chỉ thành công khi cả hai mã là 00; thất bại thì ghi nhận và cho phép thử lại.
  if (
    params.vnp_ResponseCode !== "00" ||
    params.vnp_TransactionStatus !== "00"
  ) {
    await transaction(async (session) => {
      const a = await PaymentAttempt.findOne({
        ref: attempt.ref,
        status: "created",
        collectedAt: null,
      }).session(session);
      if (!a) return;
      a.status = "failed";
      a.responseCode = params.vnp_ResponseCode;
      await a.save({ session });
      await Booking.updateOne(
        { _id: a.booking, activePayment: a.ref, status: "pending" },
        { $set: { activePayment: null } },
        { session },
      );
    });
    return { RspCode: "00", Message: "Failure recorded" };
  }
  if (!params.vnp_TransactionNo || params.vnp_TransactionNo === "0")
    return { RspCode: "99", Message: "Missing transaction reference" };
  if (attempt.providerRef && attempt.providerRef !== params.vnp_TransactionNo)
    return { RspCode: "99", Message: "Transaction reference mismatch" };
  // This is verified provider evidence; retain it even if local finalization fails.
  // Lưu bằng chứng khoản thu trước khi gọi settle() để hoàn tất đơn.
  await PaymentAttempt.updateOne(
    { _id: attempt._id, status: { $in: ["created", "failed", "unresolved"] } },
    {
      $set: {
        providerRef: params.vnp_TransactionNo,
        collectedAt: attempt.collectedAt || new Date(),
      },
    },
  );
  try {
    await settle(attempt.booking, {
      kind: "vnpay",
      ref: attempt.ref,
      verified: true,
      providerRef: params.vnp_TransactionNo,
    });
    return { RspCode: "00", Message: "Confirm Success" };
  } catch (error) {
    // Đã thu tiền nhưng không phát hành được vé: thử hoàn điểm, nếu chưa được thì chờ đối soát.
    const message = error.status
      ? error.message
      : "Chưa xác nhận hoàn tất khoản thu VNPay. Cần đối soát.";
    await PaymentAttempt.updateOne(
      {
        ref: attempt.ref,
        status: { $in: ["created", "failed", "unresolved"] },
      },
      {
        $set: {
          status: "unresolved",
          providerRef: params.vnp_TransactionNo,
          message,
        },
      },
    );
    await Booking.updateOne(
      { _id: attempt.booking, status: "pending", activePayment: attempt.ref },
      { $set: { paymentIssue: message } },
    );
    try {
      const refund = await refundFailedPayment(attempt.ref);
      if (refund.status === "completed")
        return { RspCode: "00", Message: "Payment credited to member points" };
    } catch {
      /* Keep unresolved when evidence or Member account is missing. */
    }
    return { RspCode: "99", Message: "Recorded for reconciliation" };
  }
}

// Sandbox merchants may not have an IPN URL registered for a changing tunnel.
// A signed return has the same provider fields as IPN. Reuse the complete
// verifier/transaction processor, never a browser success flag or a new proof.
// Production continues to require the independent IPN channel.
// Dự phòng khi thiếu IPN: xác minh Return bằng processIPN, chỉ bật cho Sandbox ngoài production.
export async function processSandboxReturn(params) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.VNPAY_SANDBOX_RETURN_FALLBACK !== "true"
  )
    return null;
  let gateway;
  try {
    gateway = new URL(
      process.env.VNPAY_URL ||
        "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
    );
  } catch {
    return null;
  }
  if (
    gateway.protocol !== "https:" ||
    gateway.hostname !== "sandbox.vnpayment.vn"
  )
    return null;
  if (!params.vnp_SecureHash) return null;
  return processIPN(params);
}
