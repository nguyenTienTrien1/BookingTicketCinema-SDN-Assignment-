import * as service from "../../services/cinema/roomService.js";

export async function list(req, res, next) {
  try { res.json(await service.listRooms(req.query)); } catch (error) { next(error); }
}
export async function detail(req, res, next) {
  try { res.json(await service.getRoom(req.params.id)); } catch (error) { next(error); }
}
export async function create(req, res, next) {
  try { res.status(201).json({ room: await service.createRoom(req.body, req.user._id), message: 'Đã tạo phòng chiếu.' }); } catch (error) { next(error); }
}
export async function update(req, res, next) {
  try { res.json({ room: await service.updateRoom(req.params.id, req.body, req.user._id), message: 'Đã cập nhật phòng chiếu.' }); } catch (error) { next(error); }
}
export async function preview(req, res, next) {
  try { res.json(await service.previewSeats(req.params.id, req.body)); } catch (error) { next(error); }
}
export async function seats(req, res, next) {
  try { res.json({ room: await service.updateSeats(req.params.id, req.body, req.user._id), message: 'Đã lưu cấu hình ghế.' }); } catch (error) { next(error); }
}
export async function remove(req, res, next) {
  try { await service.removeRoom(req.params.id, req.body, req.user._id); res.json({ message: 'Đã xóa phòng chiếu.' }); } catch (error) { next(error); }
}
