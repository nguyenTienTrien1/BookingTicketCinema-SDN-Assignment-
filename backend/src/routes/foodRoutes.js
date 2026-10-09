import {Router} from 'express';import Food from '../models/Food.js';const r=Router();r.get('/',async(_q,res,n)=>{try{res.json(await Food.find({available:true}))}catch(e){n(e)}});export default r;
