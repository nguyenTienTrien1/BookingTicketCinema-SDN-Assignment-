import React, { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../services/api';
import { useSession } from '../../context/SessionContext';
import { Accordion, Badge, Button, Card, Eyebrow, Field, Heading, Muted, Page } from '../../components/ui';
import { colors, s } from '../../theme/index';
import { Icon } from '../../components/Icon';
import GoogleLink from '../../components/GoogleLink';
export function ProfileScreen(){
  const {user,logout,refresh}=useSession(),[profile,setProfile]=useState<any>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [form,setForm]=useState({fullName:'',phone:'',age:'',gender:'Other'}),[password,setPassword]=useState({currentPassword:'',newPassword:'',confirmPassword:''});
  const submitting=useRef(false);
  async function load(){const {user:data}=await api('/users/me');setProfile(data);setForm({fullName:data.fullName,phone:data.phone||'',age:data.age==null?'':String(data.age),gender:data.gender||'Other'});}
  useEffect(()=>{Promise.resolve().then(load).catch(e=>setError(e.message));},[]);
  async function perform(action:()=>Promise<void>){if(submitting.current)return;submitting.current=true;setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError((e as Error).message);}finally{submitting.current=false;setBusy(false);}}
  if(!user)return null;
  return <Page><View style={{gap:6}}><Eyebrow>KHÔNG GIAN CỦA BẠN</Eyebrow><Heading>Tài khoản</Heading></View><Card><View style={s.row}><View style={{width:58,height:58,borderRadius:20,backgroundColor:'#3d1f30',alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.pink,fontSize:26,fontWeight:'800'}}>{user.fullName.slice(0,1).toUpperCase()}</Text></View><View style={{flex:1,gap:4}}><Text style={s.title}>{user.fullName}</Text><Text style={s.muted} numberOfLines={1}>{user.email}</Text><Badge tone="green">{user.role==='member'?'Thành viên':user.role==='admin'?'Quản trị viên':'Nhân viên'}</Badge></View></View></Card>
    {user.role==='member'&&<LinearGradient colors={['#342038','#211b2d','#191b27']} style={{borderRadius:20,padding:20,gap:14,borderWidth:1,borderColor:'#49334b'}}><View style={s.between}><Eyebrow>ĐIỂM THÀNH VIÊN</Eyebrow><Icon name="wallet" color={colors.pink}/></View><View style={[s.row,{alignItems:'baseline'}]}><Text style={{color:'white',fontSize:40,fontWeight:'800',letterSpacing:-1}}>{profile?.memberPoints??user.memberPoints??0}</Text><Muted>điểm</Muted></View><Muted>Dùng điểm để giảm tiền cho lần đặt vé tiếp theo.</Muted><Button secondary busy={busy} icon="wallet" title="Làm mới số dư" onPress={()=>perform(async()=>{await load();await refresh();})}/></LinearGradient>}
    {!!error&&<Text accessibilityRole="alert" style={s.error}>{error}</Text>}{!!notice&&<Muted>{notice}</Muted>}
    <Accordion title="Thông tin cá nhân">{(['fullName','phone','age'] as const).map(key=><Field key={key} label={{fullName:'Họ tên',phone:'Số điện thoại',age:'Tuổi'}[key]} keyboardType={key==='age'?'number-pad':key==='phone'?'phone-pad':'default'} value={form[key]} onChangeText={value=>setForm(f=>({...f,[key]:value}))}/>)}
      <View style={s.wrap}>{['Male','Female','Other'].map(value=><Button key={value} secondary={form.gender!==value} title={{Male:'Nam',Female:'Nữ',Other:'Khác'}[value]!} onPress={()=>setForm(f=>({...f,gender:value}))}/>)}</View>
      <Button busy={busy} disabled={!profile} title="Lưu hồ sơ" onPress={()=>perform(async()=>{if(form.age!==''&&!/^\d+$/.test(form.age))throw new Error('Tuổi phải là số nguyên.');await api('/users/me','PATCH',{...form,age:form.age===''?null:Number(form.age)});await refresh();setNotice('Đã cập nhật hồ sơ.');})}/></Accordion>
    {profile?.loginMethods?.local!==false&&<Accordion title="Đổi mật khẩu">{(['currentPassword','newPassword','confirmPassword'] as const).map(key=><Field key={key} secureTextEntry label={{currentPassword:'Mật khẩu hiện tại',newPassword:'Mật khẩu mới',confirmPassword:'Xác nhận mật khẩu mới'}[key]} value={password[key]} onChangeText={value=>setPassword(f=>({...f,[key]:value}))}/>)}<Button busy={busy} title="Đổi mật khẩu và đăng nhập lại" onPress={()=>perform(async()=>{await api('/users/me/password','PATCH',password);await logout();router.replace('/');})}/></Accordion>}
    {user.role==='member'&&profile?.loginMethods?.local&&!profile?.loginMethods?.google&&<GoogleLink onLinked={load}/>}
    {profile?.loginMethods?.google&&<Muted>Đã liên kết Google: {profile.loginMethods.googleEmail||user.email}</Muted>}
    <Button secondary title="Đăng xuất khỏi thiết bị" onPress={()=>perform(async()=>{await logout();router.replace('/');})}/><Text style={[s.muted,{textAlign:'center',fontSize:11}]}>CINEMA+ · Hẹn bạn tại rạp</Text>
  </Page>;
}
