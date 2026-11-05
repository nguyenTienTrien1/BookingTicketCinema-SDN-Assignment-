import * as s from '../services/userService.js';
export async function pointHistory(req, res, next) {
  try {
    const history = await s.pointHistory(req.params.id);
    if (!history) return res.status(404).json({ message: 'Không tìm thấy thành viên.' });
    res.json(history);
  } catch (error) { next(error); }
}
export async function create(req,res,next){try{res.status(201).json(await s.createAccount(req.body, req.user._id));}catch(e){next(e);}}
export async function status(req,res,next){try{const u=await s.updateStatus(req.params.id,req.body.status,req.user._id,req.body.expectedStatus);if(!u)return res.status(404).json({message:'Không tìm thấy tài khoản.'});res.json(u);}catch(e){next(e);}}
export async function points(req,res,next){try{const u=await s.adjustPoints(req.params.id,req.body.points,req.body.reason,req.user._id,req.body.requestId,req.body.expectedBalance);if(!u)return res.status(404).json({message:'Không tìm thấy tài khoản.'});res.json(u);}catch(e){next(e);}}
export async function list(req,res,next){try{res.json(await import('../models/User.js').then(m=>m.default.find().select('-password -verificationToken -verificationExpires -tokenVersion -failedLoginAttempts -lockUntil').sort({createdAt:-1})));}catch(e){next(e);}}
