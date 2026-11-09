import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../api';
import { Button, Heading, Muted, s } from '../ui';
import { useSession } from '../session';
export default function Page(){const {reference}=useLocalSearchParams<{reference:string}>(),{user,loading}=useSession(),[error,setError]=useState('');useEffect(()=>{if(!user||!reference)return;api(`${user.role==='member'?'/bookings/payment-result/':'/payments/results/'}${encodeURIComponent(reference)}`).then(result=>router.replace({pathname:'/order/[id]',params:{id:result.booking._id}})).catch(e=>setError(e.message));},[user,reference]);return <View style={s.content}><Heading>Đang kiểm tra thanh toán</Heading><Muted>Chỉ kết quả xác minh từ máy chủ quyết định trạng thái đơn.</Muted>{!!error&&<Text style={s.error}>{error}</Text>}{!loading&&!user&&<Button title="Đăng nhập để xem kết quả" onPress={()=>router.replace('/')}/>}<Button secondary title="Mở lịch sử vé" onPress={()=>router.replace(user?.role==='member'?'/tickets':'/workspace')}/></View>;}
