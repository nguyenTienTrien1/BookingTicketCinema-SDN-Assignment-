import { StyleSheet } from 'react-native';
import { colors } from './colors';

export const s=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.bg},content:{padding:18,paddingBottom:30,gap:18,width:'100%',maxWidth:780,alignSelf:'center'},
 heading:{color:colors.text,fontWeight:'800',fontSize:25,letterSpacing:-.8,lineHeight:32},sectionTitle:{color:colors.text,fontWeight:'700',fontSize:20,letterSpacing:-.4},title:{color:colors.text,fontWeight:'700',fontSize:16,lineHeight:22},muted:{color:colors.muted,fontSize:13,lineHeight:20},label:{color:'#d6d8e4',fontWeight:'600',fontSize:13,lineHeight:19},eyebrow:{color:colors.pink,fontSize:10,fontWeight:'800',letterSpacing:2.2},
 card:{backgroundColor:colors.panel,borderWidth:1,borderColor:colors.border,borderRadius:20,padding:16,gap:14},
 button:{backgroundColor:colors.red,borderRadius:14,paddingHorizontal:16,paddingVertical:12,minHeight:48,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:9,flexShrink:1},secondary:{backgroundColor:'#20232f',borderColor:'#303444',borderWidth:1},buttonText:{color:'white',fontWeight:'700',fontSize:14,lineHeight:20,textAlign:'center',flexShrink:1},
 inputShell:{flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#303340',backgroundColor:'#0f1118',borderRadius:13,paddingHorizontal:12},input:{paddingVertical:14,paddingHorizontal:2,color:colors.text,minHeight:48,fontSize:15,flex:1,minWidth:0},
 row:{flexDirection:'row',gap:12,alignItems:'center'},between:{flexDirection:'row',gap:12,alignItems:'center',justifyContent:'space-between'},wrap:{flexDirection:'row',flexWrap:'wrap',gap:8},
 chip:{minHeight:44,paddingHorizontal:14,paddingVertical:10,borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'},chipSelected:{borderColor:'#9e3b53',backgroundColor:'#3b1d2a'},
 poster:{width:'100%',aspectRatio:2/3,borderRadius:13},banner:{width:'100%',aspectRatio:16/9,borderRadius:20},placeholder:{backgroundColor:'#202532',justifyContent:'center',alignItems:'center'},
 pill:{padding:12,borderRadius:12,borderWidth:1,borderColor:colors.border,backgroundColor:colors.panel,minHeight:46,justifyContent:'center'},selected:{borderColor:colors.red,backgroundColor:'#471b2b'},error:{color:'#ffb0bf',fontSize:13,lineHeight:21,backgroundColor:'#341a25',padding:12,borderRadius:12},
});
