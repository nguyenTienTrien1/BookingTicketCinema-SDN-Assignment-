import * as s from '../services/userService.js';
export async function create(req,res,next){try{res.status(201).json(await s.createAccount(req.body));}catch(e){next(e);}}
export async function status(req,res,next){try{const u=await s.updateStatus(req.params.id,req.body.status);if(!u)return res.status(404).json({message:'Không tìm thấy tài khoản.'});res.json(u);}catch(e){next(e);}}
export async function points(req,res,next){try{const u=await s.adjustPoints(req.params.id,req.body.points);if(!u)return res.status(404).json({message:'Không tìm thấy tài khoản.'});res.json(u);}catch(e){next(e);}}
export async function list(req,res,next){try{res.json(await import('../models/User.js').then(m=>m.default.find().select('-password -verificationToken -verificationExpires -tokenVersion -failedLoginAttempts -lockUntil').sort({createdAt:-1})));}catch(e){next(e);}}
