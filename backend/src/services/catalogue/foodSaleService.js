import mongoose from 'mongoose';
import Food from "../../models/catalogue/Food.js";
import FoodSale from "../../models/catalogue/FoodSale.js";
import { transaction } from '../common/transaction.js';
import { quoteFoodPromotion, consumeFoodPromotion } from './foodSalePromotionService.js';

function saleError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function counterCatalogue() {
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  return {
    foods: await Food.find({ available: true, deletedAt: null }).sort({ name: 1 }),
    paymentsEnabled: Boolean(hello.setName || hello.msg === 'isdbgrid')
  };
}

export async function getFoodSale(id, employeeId) {
  if (!mongoose.isObjectIdOrHexString(id)) throw saleError('Mã đơn bán hàng không hợp lệ.');
  const sale = await FoodSale.findOne({ _id: id, employee: employeeId });
  if (!sale) throw saleError('Không tìm thấy đơn bán hàng của bạn.', 404);
  return sale;
}

export async function createFoodSale(input, employeeId) {
  if (!input || typeof input.requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId)) {
    throw saleError('Mã yêu cầu không hợp lệ.');
  }
  await FoodSale.init();
  const existing = await FoodSale.findOne({ employee: employeeId, requestId: input.requestId });
  if (existing) return existing;
  if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) {
    throw saleError('Vui lòng chọn từ 1 đến 50 sản phẩm.');
  }
  const ids = [];
  const items = [];
  let total = 0;
  for (const item of input.items) {
    if (!item || !mongoose.isObjectIdOrHexString(item.food) || ids.includes(String(item.food).toLowerCase()) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      throw saleError('Mỗi sản phẩm chỉ được chọn một lần, số lượng từ 1 đến 100.');
    }
    ids.push(String(item.food).toLowerCase());
    const food = await Food.findOne({ _id: item.food, available: true, deletedAt: null });
    if (!food || !Number.isInteger(food.stock) || food.stock < item.quantity) {
      throw saleError('Sản phẩm không còn bán hoặc không đủ tồn kho.', 409);
    }
    if (!Number.isSafeInteger(food.price) || food.price < 0) throw saleError('Giá sản phẩm không hợp lệ.', 409);
    total += food.price * item.quantity;
    items.push({ food: food._id, name: food.name, unitPrice: food.price, quantity: item.quantity });
  }
  if (!Number.isSafeInteger(total) || total <= 0) throw saleError('Tổng tiền đơn hàng không hợp lệ.');
  try {
    return await FoodSale.create({ employee: employeeId, requestId: input.requestId, items, subtotal: total, total });
  } catch (error) {
    if (error.code === 11000) return FoodSale.findOne({ employee: employeeId, requestId: input.requestId });
    throw error;
  }
}

export async function cancelFoodSale(id, employeeId) {
  const sale = await getFoodSale(id, employeeId);
  if (sale.status === 'cancelled') return sale;
  const cancelled = await FoodSale.findOneAndUpdate(
    { _id: id, employee: employeeId, status: 'pending', 'onlinePayment.status': { $ne: 'created' } }, { $set: { status: 'cancelled' } }, { new: true }
  );
  if (!cancelled) throw saleError('Đơn đã nhận thanh toán hoặc đã thay đổi, không thể hủy.', 409);
  return cancelled;
}

export async function payFoodSale(id, input, employeeId) {
  let sale = await getFoodSale(id, employeeId);
  if (sale.status === 'paid') return sale;
  if (sale.status === 'returned') throw saleError('Khoản thu đã được trả lại khách. Không thanh toán lại đơn này.', 409);
  if (sale.status === 'reconciliation') throw saleError('Đơn cần đối soát. Không thu tiền lần nữa.', 409);
  if (sale.status === 'cancelled') throw saleError('Đơn đã hủy, không thể thanh toán.', 409);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw saleError('Thanh toán cần MongoDB replica set để lưu hóa đơn và trừ kho đồng thời. Chưa ghi nhận thu tiền.', 503);
  }
  if (sale.status === 'pending') {
    if (sale.onlinePayment?.status === 'created') throw saleError('Đang chờ kết quả VNPay. Không thu tiền mặt hoặc hủy đơn.', 409);
    const quote = await quoteFoodPromotion(sale, sale.promotion?.code || '', null);
    if (quote.discount !== (sale.promotionDiscount || 0) || quote.promotion?.ruleSignature !== sale.promotion?.ruleSignature) throw saleError('Mã đã thay đổi. Áp dụng lại mã trước khi nhận tiền.', 409);
    if (!input || input.paymentMethod !== 'cash' || input.paymentConfirmed !== true ||
        input.confirmedTotal !== sale.total || !Number.isSafeInteger(input.cashReceived) || input.cashReceived < sale.total) {
      throw saleError('Cần xác nhận đúng tổng tiền và tiền mặt đã nhận, không nhỏ hơn tổng đơn.');
    }
    // Persist the cash receipt before finalization so a failure never loses evidence of collected money.
    const received = await FoodSale.findOneAndUpdate(
      { _id: id, employee: employeeId, status: 'pending', __v: sale.__v, total: sale.total, 'onlinePayment.status': { $ne: 'created' } },
      { $set: { status: 'payment_received', paymentMethod: 'cash', cashReceived: input.cashReceived,
        change: input.cashReceived - sale.total, paymentConfirmedAt: new Date() } }, { new: true }
    );
    sale = received || await getFoodSale(id, employeeId);
    if (sale.status === 'pending') throw saleError('Đơn đã chuyển sang VNPay. Không thu tiền mặt.', 409);
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await FoodSale.findOne({ _id: id, employee: employeeId }).session(session);
      if (current.status === 'paid') return;
      if (current.status !== 'payment_received') throw saleError('Đơn không còn ở trạng thái thanh toán.', 409);
      if (current.paymentMethod !== 'cash') throw saleError('Đơn VNPay cần được xác minh bởi cổng thanh toán.', 409);
      await consumeFoodPromotion(current, session);
      for (const item of current.items) {
        const result = await Food.updateOne(
          { _id: item.food, available: true, deletedAt: null, price: item.unitPrice, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity, __v: 1 } }, { session }
        );
        if (result.modifiedCount !== 1) throw saleError('Giá hoặc tồn kho đã đổi sau khi thu tiền. Cần đối soát, không thu thêm.', 409);
      }
      await FoodSale.updateOne({ _id: id, status: 'payment_received' },
        { $set: { status: 'paid', paidAt: new Date() } }, { session });
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } catch (error) {
    // An unknown commit may actually have succeeded; never overwrite a Paid receipt.
    if (!error.hasErrorLabel?.('UnknownTransactionCommitResult')) {
      await FoodSale.updateOne({ _id: id, status: 'payment_received' },
        { $set: { status: 'reconciliation', issue: error.status ? error.message : 'Lỗi hoàn tất thanh toán; cần đối soát.' } });
    }
    const latest = await getFoodSale(id, employeeId);
    if (latest.status === 'paid') return latest;
    throw saleError('Chưa xác nhận hoàn tất. Tiền đã nhận được lưu để đối soát; không thu tiền lần nữa.', 409);
  } finally {
    await session.endSession();
  }
  return getFoodSale(id, employeeId);
}

export async function applyFoodPromotion(id, input, employeeId) {
  return transaction(async session => {
    const sale = await FoodSale.findOne({ _id: id, employee: employeeId }).session(session);
    if (!sale) throw saleError('Không tìm thấy đơn.', 404);
    if (sale.status !== 'pending' || sale.onlinePayment?.ref) throw saleError('Chỉ đổi mã trước khi tạo giao dịch VNPay. Muốn đổi mã sau giao dịch thất bại, hủy đơn và tạo lại.', 409);
    const quote = await quoteFoodPromotion(sale, input?.code, session);
    sale.subtotal = sale.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    sale.promotion = quote.promotion;
    sale.promotionDiscount = quote.discount;
    sale.total = sale.subtotal - quote.discount;
    sale.increment();
    await sale.save({ session });
    return sale;
  });
}
