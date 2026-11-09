import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import * as Linking from 'expo-linking';
import { openExternal } from '../services/browser';
import { api, API_URL } from '../services/api';
import { useSession } from '../context/SessionContext';
import { Button, Card, Heading, Muted } from './ui';
import { s } from '../theme/index';
import { useAction } from '../utils/hooks';
export default function GoogleLink({onLinked}:{onLinked:()=>Promise<void>}){const {login}=useSession(),[pending,setPending]=useState<{id:string;secret:string}|null>(null),a=useAction(),exchanging=useRef(false);
 async function exchange(){if(!pending||exchanging.current)return;exchanging.current=true;try{const result=await api(`/auth/mobile/google/${pending.id}/exchange`,'POST',{secret:pending.secret});if(result.status==='complete'){setPending(null);await login(result);await onLinked();a.setNotice('Đã liên kết Google.');}}catch(e){setPending(null);a.setError((e as Error).message);}finally{exchanging.current=false;}}
 useEffect(()=>{if(!pending)return;const timer=setInterval(()=>void exchange(),3000);return()=>clearInterval(timer);},[pending]);
 return <Card><Heading>Liên kết Google</Heading><Muted>Chọn Google cùng email và nhập mật khẩu CINEMA+ hiện tại trên trang xác thực. Sau khi liên kết, có thể đăng nhập bằng Google.</Muted><Button secondary busy={a.busy} title="Liên kết tài khoản Google" onPress={()=>a.run(async()=>{const result=await api('/auth/mobile/google','POST',{purpose:'link-google',returnTo:Linking.createURL('/auth-return')});setPending({id:result.id,secret:result.secret});void openExternal(API_URL+result.browserPath).catch(e=>a.setError(e.message));})}/>{pending&&<Button secondary title="Kiểm tra kết quả liên kết" onPress={()=>void exchange()}/ >}{!!a.error&&<Text style={s.error}>{a.error}</Text>}{!!a.notice&&<Muted>{a.notice}</Muted>}</Card>;
}
