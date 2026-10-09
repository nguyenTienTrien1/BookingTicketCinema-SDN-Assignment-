import * as users from '../services/userService.js';
export async function login(req,res,next){try{const u=await users.login(req.body.email,req.body.password);res.json({success:true,user:u});}catch(e){next(e);}}
