import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { api } from '../../services/api';
import { useSession } from '../../context/SessionContext';
import { useGoogleAuth } from '../../context/GoogleAuthContext';
import { Artwork, Button, Card, Chip, Eyebrow, Field, Heading, Muted } from '../../components/ui';
import { colors, s } from '../../theme/index';

type Mode='login'|'register'|'verify'|'forgot';
export function AuthScreen({initialMode='login'}:{initialMode?:Mode}) {
  const {login,error:sessionError}=useSession();
  const googleAuth=useGoogleAuth();
  const [mode,setMode]=useState<Mode>(initialMode),[staff,setStaff]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [form,setForm]=useState({email:'',password:'',confirmPassword:'',fullName:'',phone:''});
  const submitting=useRef(false);
  function field(name:keyof typeof form){return {value:form[name],onChangeText:(text:string)=>setForm(v=>({...v,[name]:text}))};}
  function changeMode(next:Mode){setMode(next);setError('');setNotice('');}
  async function perform(action:()=>Promise<void>){if(submitting.current)return;submitting.current=true;setBusy(true);setError('');try{await action();}catch(e){setError((e as Error).message);}finally{submitting.current=false;setBusy(false);}}
  async function submit(){await perform(async()=>{
    if(mode==='login'){await login(await api(staff?'/auth/mobile/staff-login':'/auth/mobile/login','POST',{email:form.email.trim(),password:form.password}));return;}
    if(mode==='register'){
      if(form.password!==form.confirmPassword)throw new Error('Xác nhận mật khẩu không khớp.');
      const result=await api('/auth/mobile/register','POST',{fullName:form.fullName,email:form.email.trim(),password:form.password,phone:form.phone});
      setMode('verify');setForm(value=>({...value,password:'',confirmPassword:''}));
      setNotice(result.emailSent===false?'Tài khoản đã tạo nhưng chưa gửi được email xác minh. Bạn có thể bấm gửi lại email.':'Vui lòng mở email và bấm “Xác thực tài khoản” để kích hoạt tài khoản. Sau đó quay lại ứng dụng để đăng nhập.');return;
    }
    if(mode==='forgot'){const result=await api('/auth/mobile/forgot-password','POST',{email:form.email.trim()});setNotice(result.message+' Mở email mới nhất và bấm “Đặt lại mật khẩu” để mở form trong ứng dụng.');return;}
  });}
  const title={login:'Chào mừng trở lại',register:'Tạo tài khoản',verify:'Xác minh email',forgot:'Quên mật khẩu'}[mode];
  return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content,{flexGrow:1,justifyContent:'center'}]}>
    <Eyebrow>ĐÊM PHIM BẮT ĐẦU TỪ ĐÂY</Eyebrow><View style={s.between}><Text style={{color:'white',fontSize:31,lineHeight:38,fontWeight:'800',letterSpacing:-1,flex:1}}>Màn ảnh lớn.{'\n'}Trong tầm tay.</Text><View style={{width:75,transform:[{rotate:'8deg'}]}}><Artwork uri="/images/posters/dune.jpg"/></View></View><Card><Heading>{title}</Heading>
      {mode==='login'&&<View style={s.wrap}><Chip disabled={googleAuth.waiting||googleAuth.starting} selected={!staff} title="Thành viên" icon="user" onPress={()=>setStaff(false)}/><Chip disabled={googleAuth.waiting||googleAuth.starting} selected={staff} title="Nhân viên / Admin" icon="shield" onPress={()=>setStaff(true)}/></View>}
      {mode==='register'&&<><Field label="Họ và tên" {...field('fullName')}/><Field label="Số điện thoại" keyboardType="phone-pad" {...field('phone')}/></>}
      {['login','register','forgot','verify'].includes(mode)&&<Field icon="mail" label="Email" placeholder="Email thành viên" editable={mode!=='verify'} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" {...field('email')}/>}
      {['login','register'].includes(mode)&&<Field icon="lock" label={mode==='login'?'Mật khẩu':'Mật khẩu mới'} placeholder="Nhập mật khẩu" secureTextEntry autoComplete={mode==='login'?'current-password':'new-password'} {...field('password')}/>}
      {mode==='register'&&<Field label="Xác nhận mật khẩu" secureTextEntry {...field('confirmPassword')}/>}
      {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice&&<Muted>{notice}</Muted>}{!!sessionError&&<Text style={s.error}>{sessionError}</Text>}
      {mode!=='verify'&&<Button busy={busy} disabled={!googleAuth.ready||googleAuth.waiting||googleAuth.starting} title={mode==='login'?'Đăng nhập':mode==='forgot'?'Gửi liên kết đặt lại':'Lưu & tiếp tục'} onPress={submit}/>}
      {mode==='verify'&&<Button secondary busy={busy} title="Gửi lại email xác minh" onPress={()=>perform(async()=>{const result=await api('/auth/mobile/resend-verification','POST',{email:form.email.trim()});if(result.emailSent===false)throw new Error('Chưa gửi được email xác minh. Vui lòng thử lại sau.');setNotice(result.message);})}/>}
      {mode==='login'&&!staff&&<><View style={[s.row,{gap:10}]}><View style={{height:1,backgroundColor:colors.border,flex:1}}/><Muted>hoặc</Muted><View style={{height:1,backgroundColor:colors.border,flex:1}}/></View><Button secondary busy={googleAuth.starting} disabled={busy||googleAuth.waiting||!googleAuth.ready} title="Tiếp tục với Google" onPress={()=>void googleAuth.start()}/>{!!googleAuth.error&&<Text accessibilityRole="alert" style={s.error}>{googleAuth.error}</Text>}{!!googleAuth.notice&&<Muted>{googleAuth.notice}</Muted>}{googleAuth.waiting&&<><Button secondary title="Kiểm tra đăng nhập Google" onPress={()=>void googleAuth.check()}/><Button secondary title="Hủy đăng nhập Google" onPress={()=>void googleAuth.cancel()}/></>}<View style={s.between}><Pressable accessibilityRole="button" disabled={googleAuth.waiting||googleAuth.starting} accessibilityState={{disabled:googleAuth.waiting||googleAuth.starting}} onPress={()=>changeMode('register')} style={{minHeight:44,justifyContent:'center',flexShrink:1}}><Text style={{color:colors.pink,fontSize:13,fontWeight:'600'}}>Tạo tài khoản mới</Text></Pressable><Pressable accessibilityRole="button" disabled={googleAuth.waiting||googleAuth.starting} accessibilityState={{disabled:googleAuth.waiting||googleAuth.starting}} onPress={()=>changeMode('forgot')} style={{minHeight:44,justifyContent:'center',flexShrink:1}}><Text style={{color:colors.muted,fontSize:12}}>Quên mật khẩu?</Text></Pressable></View></>}
      {mode!=='login'&&<Button secondary title="Về đăng nhập" onPress={()=>changeMode('login')}/>}</Card>
    {mode==='verify'&&<Muted>Không thấy email? Hãy kiểm tra thư mục Spam hoặc Thư rác. Chỉ cần bấm liên kết trong email, không cần nhập mã xác minh.</Muted>}
  </ScrollView></KeyboardAvoidingView>;
}
