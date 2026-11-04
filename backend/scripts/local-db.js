import {spawn,execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import mongoose from 'mongoose';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),dbPath=path.join(root,'.local','mongodb');mkdirSync(dbPath,{recursive:true});
async function connect(){const c=mongoose.createConnection('mongodb://127.0.0.1:27019/admin?directConnection=true',{serverSelectionTimeoutMS:1500});c.on('error',()=>{});return c.asPromise();}
let connection;try{connection=await connect();}catch{
 const binary=process.env.MONGOD_BINARY||(process.platform==='win32'?execFileSync('where.exe',['mongod'],{encoding:'utf8'}).trim().split(/\r?\n/)[0]:'mongod');
 const child=spawn(binary,['--replSet','cinemaLocal','--port','27019','--bind_ip','127.0.0.1','--dbpath',dbPath,'--logpath',path.join(dbPath,'mongo.log'),'--wiredTigerCacheSizeGB','0.25'],{detached:true,windowsHide:true,stdio:'ignore'});child.unref();
 for(let i=0;i<20&&!connection;i++){await new Promise(resolve=>setTimeout(resolve,500));try{connection=await connect();}catch{}}
}
if(!connection)throw new Error('Cannot start local MongoDB. Check MONGOD_BINARY and .local/mongodb/mongo.log');
const hello=await connection.db.admin().command({hello:1});if(hello.setName&&hello.setName!=='cinemaLocal')throw new Error('Port 27019 is used by another replica set; no changes made.');
if(!hello.setName)try{await connection.db.admin().command({replSetInitiate:{_id:'cinemaLocal',members:[{_id:0,host:'127.0.0.1:27019'}]}});}catch(e){if(e.code!==23)throw e;}
await connection.close();
const primary=await mongoose.createConnection('mongodb://127.0.0.1:27019/admin?replicaSet=cinemaLocal',{serverSelectionTimeoutMS:20000}).asPromise();await primary.close();
console.log('Local transaction-capable MongoDB ready at mongodb://127.0.0.1:27019/booking_cinema?replicaSet=cinemaLocal');
