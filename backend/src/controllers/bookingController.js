import * as s from '../services/bookingService.js';
export async function create(req,res,next){try{res.status(201).json(await s.createBooking(req.body));}catch(e){next(e);}}
export async function points(req,res,next){try{res.json(await s.applyMemberPoints(req.params.id,req.body.userId,Number(req.body.points)));}catch(e){next(e);}}
export async function payment(req,res,next){try{res.json(await s.pay(req.params.id,req.body.userId,req.body.method));}catch(e){next(e);}}
export async function list(req,res,next){try{res.json(await s.listBookings(req.query.userId));}catch(e){next(e);}}
