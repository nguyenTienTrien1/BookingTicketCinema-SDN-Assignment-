import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { openExternal } from '../../services/browser';
import { api, API_URL } from '../../services/api';
import { useSession } from '../../context/SessionContext';
import { Artwork, Button, Card, Chip, Eyebrow, Field, Heading, Muted } from '../../components/ui';
import { colors, s } from '../../theme/index';

let googlePending: {id:string;secret:string}|null = null;
type Mode='login'|'register'|'verify'|'forgot'|'reset';
export function AuthScreen({initialMode='login',initialToken=''}:{initialMode?:Mode;initialToken?:string}) {
  const {login,error:sessionError}=useSession();
  const [mode,setMode]=useState<Mode>(initialMode),[staff,setStaff]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [form,setForm]=useState({email:'',password:'',confirmPassword:'',fullName:'',phone:'',token:initialToken});
  const [googleWaiting,setGoogleWaiting]=useState(!!googlePending);
  const exchanging=useRef(false),submitting=useRef(false);
  function field(name:keyof typeof form){return {value:form[name],onChangeText:(text:string)=>setForm(v=>({...v,[name]:text}))};}
  function changeMode(next:Mode){setMode(next);setError('');setNotice('');}
  async function perform(action:()=>Promise<void>){if(submitting.current)return;submitting.current=true;setBusy(true);setError('');try{await action();}catch(e){setError((e as Error).message);}finally{submitting.current=false;setBusy(false);}}
  function token(){const value=form.token.trim();try{return new URL(value).searchParams.get('token')||value;}catch{return value;}}
  async function submit(){await perform(async()=>{
    if(mode==='login'){await login(await api(staff?'/auth/mobile/staff-login':'/auth/mobile/login','POST',{email:form.email.trim(),password:form.password}));return;}
    if(mode==='register'){
      if(form.password!==form.confirmPassword)throw new Error('Xác nhận mật khẩu không khớp.');
      const result=await api('/auth/register','POST',{fullName:form.fullName,email:form.email.trim(),password:form.password,phone:form.phone});
      setMode('verify');setNotice(result.emailSent===false?'Tài khoản đã tạo nhưng email chưa gửi được. Kiểm tra SMTP rồi gửi lại email xác minh.':result.message);return;
    }
    if(mode==='verify'){const result=await api('/auth/verify-email','POST',{token:token()});setMode('login');setNotice(result.message||'Xác minh thành công. Bạn có thể đăng nhập.');return;}
    if(mode==='forgot'){const result=await api('/auth/forgot-password','POST',{email:form.email.trim()});setNotice(result.message);return;}
    if(form.password!==form.confirmPassword)throw new Error('Xác nhận mật khẩu không khớp.');
    const result=await api('/auth/reset-password','POST',{token:token(),newPassword:form.password,confirmPassword:form.confirmPassword});setMode('login');setNotice(result.message);
  });}
  async function exchange(){if(!googlePending||exchanging.current)return;exchanging.current=true;try{const result=await api(`/auth/mobile/google/${googlePending.id}/exchange`,'POST',{secret:googlePending.secret});if(result.status==='complete'){googlePending=null;setGoogleWaiting(false);await login(result);}}catch(e){setError((e as Error).message);googlePending=null;setGoogleWaiting(false);}finally{exchanging.current=false;}}
  useEffect(()=>{if(!googleWaiting)return;void Promise.resolve().then(exchange);const timer=setInterval(()=>void exchange(),3000);return()=>clearInterval(timer);},[googleWaiting]);
  async function google(){await perform(async()=>{const result=await api('/auth/mobile/google','POST',{returnTo:Linking.createURL('/auth-return')});googlePending={id:result.id,secret:result.secret};setGoogleWaiting(true);const promise=openExternal(API_URL+result.browserPath);void promise.then(()=>exchange()).catch(e=>setError(e.message));});}
  const title={login:'Chào mừng trở lại',register:'Tạo tài khoản',verify:'Xác minh email',forgot:'Quên mật khẩu',reset:'Đặt lại mật khẩu'}[mode];
  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content,{flexGrow:1,justifyContent:'center'}]}>
    <Eyebrow>ĐÊM PHIM BẮT ĐẦU TỪ ĐÂY</Eyebrow><View style={s.between}><Text style={{color:'white',fontSize:31,lineHeight:38,fontWeight:'800',letterSpacing:-1,flex:1}}>Màn ảnh lớn.{'\n'}Trong tầm tay.</Text><View style={{width:75,transform:[{rotate:'8deg'}]}}><Artwork uri="/images/posters/dune.jpg"/></View></View><Card><Heading>{title}</Heading>
      {mode==='login'&&<View style={s.wrap}><Chip selected={!staff} title="Thành viên" icon="user" onPress={()=>setStaff(false)}/><Chip selected={staff} title="Nhân viên / Admin" icon="shield" onPress={()=>setStaff(true)}/></View>}
      {mode==='register'&&<><Field label="Họ và tên" {...field('fullName')}/><Field label="Số điện thoại" keyboardType="phone-pad" {...field('phone')}/></>}
      {['login','register','forgot','verify'].includes(mode)&&<Field icon="mail" label="Email" placeholder="Email thành viên" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" {...field('email')}/>}
      {['verify','reset'].includes(mode)&&<Field label="Token hoặc liên kết nhận qua email" autoCapitalize="none" autoCorrect={false} {...field('token')}/>}
      {['login','register','reset'].includes(mode)&&<Field icon="lock" label={mode==='login'?'Mật khẩu':'Mật khẩu mới'} placeholder="Nhập mật khẩu" secureTextEntry autoComplete={mode==='login'?'current-password':'new-password'} {...field('password')}/>}
      {['register','reset'].includes(mode)&&<Field label="Xác nhận mật khẩu" secureTextEntry {...field('confirmPassword')}/>}
      {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice&&<Muted>{notice}</Muted>}{!!sessionError&&<Text style={s.error}>{sessionError}</Text>}
      <Button busy={busy} title={mode==='login'?'Đăng nhập':mode==='forgot'?'Gửi liên kết đặt lại':mode==='verify'?'Xác minh':'Lưu & tiếp tục'} onPress={submit}/>
      {mode==='verify'&&<Button secondary busy={busy} title="Gửi lại email xác minh" onPress={()=>perform(async()=>{const result=await api('/auth/resend-verification','POST',{email:form.email.trim()});setNotice(result.message);})}/>}
      {mode==='login'&&!staff&&<><View style={[s.row,{gap:10}]}><View style={{height:1,backgroundColor:colors.border,flex:1}}/><Muted>hoặc</Muted><View style={{height:1,backgroundColor:colors.border,flex:1}}/></View><Button secondary busy={busy} title="Tiếp tục với Google" onPress={google}/>{googleWaiting&&<Button secondary title="Kiểm tra phiên Google" onPress={()=>void exchange()}/>}<View style={s.between}><Pressable accessibilityRole="button" onPress={()=>changeMode('register')} style={{minHeight:44,justifyContent:'center',flexShrink:1}}><Text style={{color:colors.pink,fontSize:13,fontWeight:'600'}}>Tạo tài khoản mới</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>changeMode('forgot')} style={{minHeight:44,justifyContent:'center',flexShrink:1}}><Text style={{color:colors.muted,fontSize:12}}>Quên mật khẩu?</Text></Pressable></View></>}
      {mode==='forgot'&&<Button secondary title="Tôi đã nhận liên kết đặt lại" onPress={()=>changeMode('reset')}/>}
      {mode!=='login'&&<Button secondary title="Về đăng nhập" onPress={()=>changeMode('login')}/>}</Card>
    {mode==='verify'&&<Muted>Mở email xác minh hoặc dán liên kết vào ô token. Sau xác minh, trở lại đăng nhập.</Muted>}
  </ScrollView></KeyboardAvoidingView>;
}
