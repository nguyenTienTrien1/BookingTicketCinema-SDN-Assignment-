// Explicit legacy/custom step coverage; the configured application default is 100.
process.env.POINT_REDEEM_STEP='1';
import 'dotenv/config';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {once} from 'node:events';
import {randomUUID,createHash} from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from './src/app.js';
import User from './src/models/User.js';
import Movie from './src/models/Movie.js';
import Showtime from './src/models/Showtime.js';
import Food from './src/models/Food.js';
import Booking from './src/models/Booking.js';
import PaymentAttempt from './src/models/PaymentAttempt.js';
import {expireBookings} from './src/services/bookingService.js';
import {signature} from './src/services/vnpayService.js';
import {inviteStaff} from './src/services/staffService.js';
// Existing pending invitations remain usable; new POST /users provisioning is
// covered through real loopback SMTP in test_accounts.js.
process.env.SMTP_HOST='';process.env.GMAIL_USER='';

test('Nine UC completion against transactional MongoDB',async t=>{
 const dbName='uc_complete_'+randomUUID().replaceAll('-','');
 await mongoose.connect(process.env.MONGODB_URI,{dbName,serverSelectionTimeoutMS:5000});
 assert.ok((await mongoose.connection.db.admin().command({hello:1})).setName,'Tests must use a replica set, never emulate transactions.');
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(async()=>{await new Promise(r=>server.close(r));assert.equal(mongoose.connection.name,dbName);await mongoose.connection.dropDatabase();await mongoose.disconnect();});
 await Promise.all([User.init(),Movie.init(),Showtime.init(),Food.init(),Booking.init(),PaymentAttempt.init()]);
 const base='http://127.0.0.1:'+server.address().port+'/api';
 const account=(role='member',extra={})=>User.create({fullName:role,email:randomUUID()+'@uc.test',password:'Password123',role,status:'Active',memberPoints:200,...extra});
 const admin=await account('admin'),employee=await account('employee'),member=await account();
 async function request(path,actor,method='GET',body){const headers={'Content-Type':'application/json'};if(actor)headers.Cookie='token='+jwt.sign({id:actor.id,tokenVersion:actor.tokenVersion||0},process.env.JWT_SECRET);const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
 async function fixture(extra={}){const movie=await Movie.create({title:'Test '+randomUUID(),genre:['Action'],duration:100,classification:'P',releaseDate:new Date(),...extra});const show=await Showtime.create({movie:movie._id,cinema:'Test',room:'1',startTime:new Date(Date.now()+3600000),price:100000,seats:[{number:'A1'},{number:'A2'}]});return {movie,show};}
 async function book(actor=member,body={},extra={}){const f=await fixture(extra);const result=await request('/bookings',actor,'POST',{showtimeId:f.show.id,seats:['A1'],...body});assert.equal(result.status,201,JSON.stringify(result.data));return {...f,b:result.data};}

 await t.test('concurrent seat claims have one winner and cash payment keeps sold seats unavailable',async()=>{
  const f=await fixture(),other=await account();
  const results=await Promise.all([member,other].map(actor=>request('/bookings',actor,'POST',{showtimeId:f.show.id,seats:['A1']})));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  const b=results.find(r=>r.status===201).data;
  assert.ok(Math.abs(new Date(b.expiresAt)-Date.now()-600000)<10000);
  const paid=await request('/payments/bookings/'+b._id+'/cash',employee,'POST',{method:'cash',receivedAmount:b.total});
  assert.equal(paid.status,200);assert.equal(paid.data.paymentMethod,'cash');
  assert.equal((await request('/bookings',other,'POST',{showtimeId:f.show.id,seats:['A1']})).status,409);
  assert.equal(await Booking.countDocuments({showtime:f.show.id}),1);
 });
 await t.test('VNPay signed URL, ownership, failed retry, success and duplicate callback',async()=>{
  const saved=Object.fromEntries(['VNPAY_TMN_CODE','VNPAY_HASH_SECRET','VNPAY_RETURN_URL'].map(k=>[k,process.env[k]]));
  Object.assign(process.env,{VNPAY_TMN_CODE:'TESTMERCHANT',VNPAY_HASH_SECRET:'test-secret',VNPAY_RETURN_URL:'http://localhost/api/payments/vnpay/return'});
  try {
   const {b,show}=await book(),other=await account();
   const start=()=>request('/bookings/'+b._id+'/pay',member,'POST',{method:'vnpay'});
   const first=await start();assert.equal(first.status,200);
   const url=new URL(first.data.paymentUrl);assert.equal(url.hostname,'sandbox.vnpayment.vn');
   const unsigned=Object.fromEntries(url.searchParams);assert.equal(unsigned.vnp_SecureHash,signature(unsigned));
   assert.equal(url.searchParams.get('vnp_Amount'),String(b.total*100));
   assert.equal((await start()).data.reference,first.data.reference);
   assert.equal((await request('/bookings/payment-result/'+first.data.reference,other)).status,404);
   assert.equal((await request('/bookings/'+b._id+'/pay',member,'POST',{method:'cash'})).status,409);
   let reference=first.data.reference;
   const callback=async(extra={})=>{
    const params={vnp_TmnCode:process.env.VNPAY_TMN_CODE,vnp_TxnRef:reference,vnp_Amount:String(b.total*100),vnp_ResponseCode:'00',vnp_TransactionStatus:'00',vnp_TransactionNo:'123456',...extra};
    params.vnp_SecureHash=signature(params);return request('/payments/vnpay/ipn?'+new URLSearchParams(params));
   };
   assert.equal((await callback({vnp_Amount:'1'})).data.RspCode,'04');
   assert.equal((await request('/payments/vnpay/ipn?vnp_SecureHash=bad')).data.RspCode,'97');
   assert.equal((await callback({vnp_ResponseCode:'24',vnp_TransactionStatus:'02'})).data.RspCode,'00');
   assert.equal((await Booking.findById(b._id)).status,'pending');
   const second=await start();assert.notEqual(second.data.reference,reference);reference=second.data.reference;
   await PaymentAttempt.updateOne({ref:reference},{$set:{status:'unresolved',message:'Transient processing failure'}});
   assert.equal((await callback()).data.RspCode,'00');assert.equal((await callback()).data.RspCode,'02');
   const paidReference=reference;
   reference=first.data.reference;
   const beforeRefund=(await User.findById(member.id)).memberPoints;
   assert.equal((await callback({vnp_TransactionNo:'654321'})).data.RspCode,'00');
   assert.equal((await PaymentAttempt.findOne({ref:reference})).status,'refunded');
   assert.equal((await User.findById(member.id)).memberPoints,beforeRefund+b.total/1000);
   assert.equal((await callback({vnp_TransactionNo:'654321'})).data.RspCode,'02');
   assert.equal((await User.findById(member.id)).memberPoints,beforeRefund+b.total/1000);
   assert.equal((await Booking.findById(b._id)).paymentRef,paidReference);
   reference=paidReference;
   const result=await request('/bookings/payment-result/'+reference,member);
   assert.equal(result.data.status,'succeeded');assert.equal(result.data.booking.paymentMethod,'vnpay');assert.equal(result.data.booking.tickets.length,1);
   assert.equal((await Showtime.findById(show.id)).seats[0].status,'booked');
   assert.equal(await PaymentAttempt.countDocuments({booking:b._id,status:'succeeded'}),1);
  }finally{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
 });
 await t.test('online age checks are deferred to the counter, including payment and K guardian',async()=>{
  const f=await fixture({classification:'T18'});
  const r=await request('/bookings',member,'POST',{showtimeId:f.show.id,seats:['A1']});
  assert.equal(r.status,201);
  assert.equal((await request('/bookings/'+r.data._id+'/pay',member,'POST',{method:'demo'})).status,200);
  const young=await account(),k=await fixture({classification:'K'});
  assert.equal((await request('/bookings',young,'POST',{showtimeId:k.show.id,seats:['A1']})).status,201);
  assert.equal((await request('/payments/members/'+member.id+'/age',member,'PATCH',{age:18})).status,403);
 });
 await t.test('started showtimes cannot sell; cancel and expiry release holds',async()=>{
  const {show,b}=await book();
  assert.equal((await request('/bookings/'+b._id+'/cancel',member,'POST',{})).status,200);
  assert.equal((await Showtime.findById(show.id)).seats[0].status,'available');
  await Showtime.updateOne({_id:show.id},{$set:{startTime:new Date(Date.now()-1000)}});
  assert.equal((await request('/bookings',member,'POST',{showtimeId:show.id,seats:['A1']})).status,409);
  const second=await book();await Booking.updateOne({_id:second.b._id},{$set:{expiresAt:new Date(Date.now()-1000)}});await expireBookings();
  assert.equal((await Showtime.findById(second.show.id)).seats[0].status,'available');
  assert.equal((await Booking.findById(second.b._id)).status,'cancelled');
 });
 await t.test('F&B quantity, availability, pending updates and frozen price snapshots',async()=>{
  const food=await Food.create({name:'Popcorn',price:25000,available:true,stock:10});
  const {b}=await book(member,{foodItems:[{food:food.id,quantity:2}]});
  assert.equal(b.subtotal,150000);assert.equal(b.foodItems[0].unitPrice,25000);
  const updated=await request('/bookings/'+b._id+'/food',member,'PATCH',{foodItems:[{food:food.id,quantity:3}]});assert.equal(updated.data.subtotal,175000);
  await Food.updateOne({_id:food.id},{$set:{price:99999}});
  const paid=await request('/bookings/'+b._id+'/pay',member,'POST',{method:'demo'});assert.equal(paid.status,200);assert.equal(paid.data.subtotal,175000);assert.equal(paid.data.foodItems[0].unitPrice,25000);assert.equal((await Food.findById(food.id)).stock,7);
  const f=await fixture();await Food.updateOne({_id:food.id},{$set:{available:false}});
  assert.equal((await request('/bookings',member,'POST',{showtimeId:f.show.id,seats:['A1'],foodItems:[{food:food.id,quantity:1}]})).status,409);
  assert.equal((await Showtime.findById(f.show.id)).seats[0].status,'available');
 });
 await t.test('stock shortage rolls back points, seats, receipt and tickets in one transaction',async()=>{
  const customer=await account(),food=await Food.create({name:'Drink',price:20000,stock:2});
  const {b,show}=await book(customer,{points:20,foodItems:[{food:food.id,quantity:2}]});await Food.updateOne({_id:food.id},{$set:{stock:1}});
  assert.equal((await request('/bookings/'+b._id+'/pay',customer,'POST',{method:'demo'})).status,409);
  assert.equal((await User.findById(customer.id)).memberPoints,200);assert.equal((await Showtime.findById(show.id)).seats[0].status,'held');assert.equal((await Booking.findById(b._id)).tickets.length,0);assert.equal(await PaymentAttempt.countDocuments({booking:b._id,status:'succeeded'}),0);
 });
 await t.test('two paid seats get distinct real PNG QR codes; concurrent retry spends once',async()=>{
  const customer=await account(),{b}=await book(customer,{seats:['A1','A2'],points:100});
  const results=await Promise.all([request('/bookings/'+b._id+'/pay',customer,'POST',{method:'demo'}),request('/bookings/'+b._id+'/pay',customer,'POST',{method:'demo'})]);
  assert.ok(results.every(r=>r.status===200));const paid=results[0].data;assert.equal(paid.tickets.length,2);assert.notEqual(paid.tickets[0].code,paid.tickets[1].code);assert.match(paid.tickets[0].qr,/^data:image\/png;base64,/);assert.equal((await User.findById(customer.id)).memberPoints,100);assert.equal(await PaymentAttempt.countDocuments({booking:b._id,status:'succeeded'}),1);
  assert.equal((await request('/payments/tickets/'+paid.tickets[0].code,employee)).status,200);
 });
 await t.test('simulation failure leaves balance/stock unchanged; production refuses simulation',async()=>{
  const {b}=await book();const before=(await User.findById(member.id)).memberPoints;
  assert.equal((await request('/bookings/'+b._id+'/pay',member,'POST',{method:'demo',result:'failed'})).data.status,'pending');assert.equal((await User.findById(member.id)).memberPoints,before);assert.equal(await PaymentAttempt.countDocuments({booking:b._id,status:'failed'}),1);
  const env=process.env.NODE_ENV;process.env.NODE_ENV='production';try{assert.equal((await request('/bookings/'+b._id+'/pay',member,'POST',{method:'demo'})).status,403);}finally{if(env===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=env;}
 });
 await t.test('points-only settlement is zero amount, no gateway or cash receipt',async()=>{
  const customer=await account(),{b}=await book(customer,{points:100});const result=await request('/bookings/'+b._id+'/pay',customer,'POST',{method:'points'});assert.equal(result.status,200);assert.equal(result.data.paymentMethod,'points');assert.equal((await PaymentAttempt.findOne({booking:b._id})).method,'points');assert.equal((await User.findById(customer.id).select('+redemptionEntries')).redemptionEntries.length,1);
 });
 await t.test('member cannot self-confirm cash; staff checks exact cash amount and deadline',async()=>{
  const {b}=await book();assert.equal((await request('/bookings/'+b._id+'/pay',member,'POST',{method:'cash'})).data.status,'pending');assert.equal((await request('/payments/bookings/'+b._id+'/cash',member,'POST',{receivedAmount:b.total})).status,403);
  assert.equal((await request('/payments/bookings/'+b._id+'/cash',employee,'POST',{receivedAmount:1})).status,403);
  assert.equal((await request('/payments/bookings/'+b._id+'/cash',employee,'POST',{method:'demo',receivedAmount:b.total})).status,200);
 });
 await t.test('legacy staff invite is hashed, pending, single-use and recipient chooses the password',async()=>{
  const email=randomUUID()+'@staff.test';const created={data:await inviteStaff({fullName:'New staff',email,role:'employee'},admin.id)};assert.equal(created.data.user.status,'Pending Activation');assert.equal(created.data.password,undefined);
  assert.equal((await request('/auth/login',null,'POST',{email,password:'AdminMustNotSetThis'})).status,401);
  const token=new URL(created.data.activationLink,'http://localhost').searchParams.get('token');const u=await User.findById(created.data.user._id).select('+staffActivationHash');assert.equal(u.staffActivationHash,createHash('sha256').update(token).digest('hex'));
  assert.equal((await request('/auth/activate-staff',null,'POST',{token,password:'Recipient123',confirmPassword:'Recipient123'})).status,200);
  assert.equal((await request('/auth/activate-staff',null,'POST',{token,password:'Recipient123',confirmPassword:'Recipient123'})).status,400);
  assert.equal((await request('/auth/login',null,'POST',{email,password:'Recipient123'})).status,200);
 });
 await t.test('expired invitation can be renewed, old link is invalid and status cannot bypass activation',async()=>{
  const r={data:await inviteStaff({fullName:'Expired staff',email:randomUUID()+'@staff.test',role:'employee'},admin.id)};const id=r.data.user._id,token=new URL(r.data.activationLink,'http://localhost').searchParams.get('token');await User.updateOne({_id:id},{$set:{staffActivationExpires:new Date(Date.now()-1000)}});
  assert.equal((await request('/auth/activate-staff',null,'POST',{token,password:'Recipient123',confirmPassword:'Recipient123'})).status,400);
  assert.equal((await request('/users/'+id+'/status',admin,'PATCH',{status:'Active',expectedStatus:'Pending Activation'})).status,400);
  const renewed=await request('/users/'+id+'/invitation',admin,'POST',{});assert.equal(renewed.status,200);assert.notEqual(renewed.data.activationLink,r.data.activationLink);
 });
 await t.test('status confirmation uses expected state and records actor, before and after',async()=>{
  const target=await account();const url='/users/'+target.id+'/status';assert.equal((await request(url,admin,'PATCH',{status:'Banned'})).status,400);
  assert.equal((await request(url,admin,'PATCH',{status:'Banned',expectedStatus:'Active'})).status,200);assert.equal((await request(url,admin,'PATCH',{status:'Active',expectedStatus:'Active'})).status,409);
  const saved=await User.findById(target.id).select('+statusHistory');assert.equal(saved.statusHistory[0].before,'Active');assert.equal(saved.statusHistory[0].after,'Banned');assert.equal(String(saved.statusHistory[0].actor),admin.id);
 });
 await t.test('RDS redemption step 100 rejects fractional groups and settles a full 100-point order',async()=>{
  process.env.POINT_REDEEM_STEP='100';
  try {
   const customer=await account(),f=await fixture();
   assert.equal((await request('/config')).data.pointRedeemStep,100);
   assert.equal((await request('/bookings',customer,'POST',{showtimeId:f.show.id,seats:['A1'],points:50})).status,400);
   const created=await request('/bookings',customer,'POST',{showtimeId:f.show.id,seats:['A1'],points:100});assert.equal(created.status,201);
   assert.equal((await request('/bookings/'+created.data._id+'/points',customer,'PATCH',{points:99})).status,400);
   const paid=await request('/bookings/'+created.data._id+'/pay',customer,'POST',{method:'points'});assert.equal(paid.status,200);assert.equal(paid.data.total,0);assert.equal(paid.data.user.memberPoints,100);
  } finally {process.env.POINT_REDEEM_STEP='1';}
 });
 await t.test('concurrent Admin disables cannot leave the system without an active Admin',async()=>{
  const other=await account('admin');await Promise.all([request('/users/'+other.id+'/status',admin,'PATCH',{status:'Banned',expectedStatus:'Active'}),request('/users/'+admin.id+'/status',other,'PATCH',{status:'Banned',expectedStatus:'Active'})]);assert.ok(await User.countDocuments({role:'admin',status:'Active'})>=1);
 });
 await t.test('different concurrent orders cannot spend the same points twice',async()=>{
  const customer=await account('member',{memberPoints:100});
  const first=await book(customer,{points:100}),second=await book(customer,{points:100});
  const results=await Promise.all([first,second].map(item=>request('/bookings/'+item.b._id+'/pay',customer,'POST',{method:'points'})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal((await User.findById(customer.id)).memberPoints,0);
  assert.equal(await Booking.countDocuments({_id:{$in:[first.b._id,second.b._id]},status:'paid'}),1);
 });
 await t.test('different concurrent sales cannot oversell the last food item',async()=>{
  const food=await Food.create({name:'Last drink',price:10000,stock:1}),a=await account(),b=await account();
  const first=await book(a,{foodItems:[{food:food.id,quantity:1}]}),second=await book(b,{foodItems:[{food:food.id,quantity:1}]});
  const results=await Promise.all([request('/bookings/'+first.b._id+'/pay',a,'POST',{method:'demo'}),request('/bookings/'+second.b._id+'/pay',b,'POST',{method:'demo'})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await Food.findById(food.id)).stock,0);
 });
});
