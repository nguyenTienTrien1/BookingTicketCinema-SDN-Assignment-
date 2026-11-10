import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../services/api';
import { money, statusText, when } from '../../utils/format';
import { Booking, Movie } from '../../utils/types';
import { Artwork, Badge, Button, Card, Chip, Eyebrow, Field, Heading, Muted, Page, Section } from '../../components/ui';
import { colors, s } from '../../theme/index';
import { bookingSummary } from '../../utils/checkout';
import { Icon } from '../../components/Icon';
import { useSession } from '../../context/SessionContext';

export function Home({onMovie}:{onMovie:(movie:Movie)=>void}){
 const {user}=useSession(),{width}=useWindowDimensions();
 const [movies,setMovies]=useState<Movie[]>([]),[search,setSearch]=useState(''),[genre,setGenre]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 async function load(){setLoading(true);setError('');try{setMovies(await api<Movie[]>('/movies'));}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void Promise.resolve().then(load);},[]);
 const genres=[...new Set(movies.flatMap(movie=>movie.genre||[]))].slice(0,8);
 const filtered=movies.filter(movie=>movie.title.toLocaleLowerCase('vi-VN').includes(search.toLocaleLowerCase('vi-VN'))&&(!genre||movie.genre?.includes(genre)));
 const featured=movies.find(movie=>movie.status!=='coming-soon') || movies[0],columns=width>=650?3:2,cardWidth=(Math.min(width,780)-36-14*(columns-1))/columns;
 return <Page refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.red}/>}>
  <View style={s.between}><View style={{gap:5}}><Eyebrow>HẸN BẠN TẠI RẠP</Eyebrow><Heading>Hôm nay, xem gì?</Heading></View><View style={local.avatar}><Text style={{color:colors.pink,fontWeight:'800',fontSize:20}}>{user?.fullName?.slice(0,1).toUpperCase()||'C'}</Text></View></View>
  <Field icon="search" label="Tìm phim" value={search} onChangeText={setSearch} placeholder="Tên phim bạn muốn xem…" returnKeyType="search"/>
  {!search&&!genre&&featured&&<View style={local.hero}><View style={StyleSheet.absoluteFill}><Artwork uri={featured.banner||featured.poster} wide fill/></View><LinearGradient colors={['#0a0b1010','#0a0b10a0','#0a0b10ff']} locations={[0,.45,1]} style={StyleSheet.absoluteFill}/><View style={local.heroContent}><View style={{alignSelf:'flex-start',backgroundColor:'#251820cc',borderRadius:7}}><Badge tone="red">GỢI Ý CHO BẠN</Badge></View><Text numberOfLines={2} style={local.heroTitle}>{featured.title}</Text><Text style={{color:'#d6d8e4',fontSize:12}}>{featured.classification||'P'}   •   {featured.duration} phút   •   {featured.genre?.slice(0,2).join(' / ')}</Text><View style={{alignSelf:'flex-start'}}><Button title="Xem suất chiếu" icon="ticket" onPress={()=>onMovie(featured)}/></View></View></View>}
  <Section title={search?'Kết quả tìm kiếm':'Khám phá phim'} detail={`${filtered.length} phim`}/>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}><Chip selected={!genre} title="Tất cả" onPress={()=>setGenre('')}/>{genres.map(value=><Chip key={value} selected={genre===value} title={value} onPress={()=>setGenre(value)}/>)}</ScrollView>
  {!!error&&<><Text style={s.error}>{error}</Text><Button secondary title="Tải lại danh sách" onPress={load}/></>}
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:14,rowGap:22}}>{filtered.map(movie=><Pressable key={movie._id} accessibilityRole="button" accessibilityLabel={`Xem phim ${movie.title}`} onPress={()=>onMovie(movie)} style={({pressed})=>({width:cardWidth,gap:9,opacity:pressed?.8:1})}><View><Artwork uri={movie.poster}/><View style={{position:'absolute',top:9,left:9,backgroundColor:'#12151deb',padding:6,borderRadius:7}}><Text style={{color:'white',fontSize:10,fontWeight:'800'}}>{movie.classification||'P'}</Text></View>{!!movie.rating&&<View style={local.rating}><Icon name="star" size={12} color={colors.gold}/><Text style={{fontSize:11,fontWeight:'700',color:colors.gold}}>{movie.rating}</Text></View>}</View><Text numberOfLines={2} style={s.title}>{movie.title}</Text><View style={[s.between,{gap:3}]}><Text style={[s.muted,{fontSize:11,flex:1}]} numberOfLines={1}>{movie.genre?.slice(0,2).join(' · ')}</Text><Text style={[s.muted,{fontSize:11}]}>{movie.duration}′</Text></View></Pressable>)}</View>
  {!loading&&!error&&!filtered.length&&<Card><Icon name="film" size={32}/><Text style={s.title}>Chưa tìm thấy phim phù hợp</Text><Muted>Thử tên phim khác hoặc chọn lại thể loại.</Muted><Button secondary title="Xóa bộ lọc" onPress={()=>{setSearch('');setGenre('');}}/></Card>}
 </Page>;
}

export function Tickets({version,onOrder}:{version:number;onOrder:(booking:Booking)=>void}){
 const [items,setItems]=useState<Booking[]>([]),[filter,setFilter]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState('');
 async function load(){setLoading(true);setError('');try{setItems(await api<Booking[]>('/bookings'));}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void Promise.resolve().then(load);},[version]);
 const visible=items.filter(item=>!filter||item.status===filter);
 return <Page refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.red}/>}><View style={{gap:6}}><Eyebrow>NHỮNG CUỘC HẸN ĐIỆN ẢNH</Eyebrow><Heading>Vé & lịch sử</Heading><Muted>Vé, đơn đang giữ chỗ và lịch sử của bạn.</Muted></View>
  <View style={s.wrap}>{[['','Tất cả'],['pending','Chờ thanh toán'],['paid','Đã thanh toán']].map(([value,title])=><Chip key={value} selected={filter===value} title={title} onPress={()=>setFilter(value)}/>)}</View>
  {!!error&&<><Text style={s.error}>{error}</Text><Button secondary title="Thử lại" onPress={load}/></>}
  {!loading&&!error&&!visible.length&&<Card><Icon name="ticket" size={36} color={colors.pink}/><Text style={s.title}>Chưa có vé trong mục này</Text><Muted>Đặt một suất chiếu yêu thích để bắt đầu cuộc hẹn điện ảnh.</Muted></Card>}
  {visible.map(item=><View key={item._id} style={local.ticket}><View style={{padding:16,gap:14}}><View style={s.between}><Badge tone={item.status==='paid'?'green':item.status==='pending'?'gold':'neutral'}>{statusText(item.status)}</Badge><Icon name="ticket" size={18}/></View><View style={[s.row,{alignItems:'flex-start'}]}><View style={{width:68}}><Artwork uri={item.showtime?.movie?.poster}/></View><View style={{flex:1,gap:6}}><Text style={s.title} numberOfLines={2}>{bookingSummary(item).title}</Text><View style={s.row}><Icon name="calendar" size={14}/><Text style={s.muted}>{bookingSummary(item).startTime?when(bookingSummary(item).startTime):'—'}</Text></View><Text style={s.muted} numberOfLines={1}>{bookingSummary(item).cinema}</Text><Text style={{color:colors.pink,fontSize:12,fontWeight:'600'}}>Ghế {item.seats.join(', ')}</Text></View></View></View><View style={local.ticketBottom}><View><Text style={[s.muted,{fontSize:10}]}>TỔNG THANH TOÁN</Text><Text style={[s.title,{marginTop:3}]}>{money(item.total)}</Text></View><Button secondary title="Xem đơn" icon="arrow" onPress={()=>onOrder(item)}/></View></View>)}
 </Page>;
}
const local=StyleSheet.create({
 avatar:{height:44,width:44,borderRadius:16,backgroundColor:'#351a28',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#693044'},
 hero:{height:265,borderRadius:23,overflow:'hidden',backgroundColor:colors.panel},heroContent:{flex:1,justifyContent:'flex-end',padding:18,gap:10},heroTitle:{color:'white',fontSize:27,fontWeight:'800',letterSpacing:-.7,lineHeight:32},
 rating:{position:'absolute',bottom:9,right:9,flexDirection:'row',gap:4,alignItems:'center',backgroundColor:'#141620e8',padding:6,borderRadius:7},
 ticket:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,borderRadius:20,overflow:'hidden'},ticketBottom:{borderTopWidth:1,borderColor:'#3a3b47',borderStyle:'dashed',padding:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:12},
});
