import * as refunds from "../../services/payments/refundService.js";

export async function preview(req, res, next) {
 try { res.set('Cache-Control', 'no-store').json(await refunds.previewRefund(req.params.id, req.user._id)); }
 catch (error) { next(error); }
}
export async function request(req, res, next) {
 try {
  const refund = await refunds.requestMemberRefund(req.params.id, req.user._id, req.body.quoteKey);
  res.status(refund.status === 'completed' ? 200 : 202).json({ refund });
 } catch (error) { next(error); }
}
export async function cancelShowtime(req, res, next) {
 try {
  const result = await refunds.cancelShowtime(req.params.id, req.body, req.user._id);
  res.json({ ...result, message: `Đã hủy suất. Hoàn điểm xong ${result.completed} đơn; ${result.unresolved} yêu cầu cần đối soát. Khách vãng lai không được hoàn vé.` });
 } catch (error) { next(error); }
}
export async function issues(req, res, next) {
 try { res.set('Cache-Control', 'no-store').json(await refunds.listRefundIssues()); }
 catch (error) { next(error); }
}
export async function retry(req, res, next) {
 try {
  const refund = await refunds.retryRefund(req.params.reference, req.user._id);
  res.status(refund.status === 'completed' ? 200 : 202).json({ refund });
 } catch (error) { next(error); }
}
