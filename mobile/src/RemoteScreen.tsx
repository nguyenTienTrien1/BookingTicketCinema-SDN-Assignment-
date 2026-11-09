import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from './api';
import { Button, Muted, s } from './ui';
export function RemoteScreen<T>({path,children}:{path:string;children:(data:T)=>React.ReactNode}) {
  const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  useEffect(()=>{let active=true;Promise.resolve().then(()=>{if(!active)return;setData(null);setError('');return api<T>(path).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});});return()=>{active=false;};},[path,reload]);
  return data?children(data):<View style={s.content}>{error?<><Text style={s.error}>{error}</Text><Button title="Thử lại" onPress={()=>setReload(v=>v+1)}/></>:<Muted>Đang tải…</Muted>}</View>;
}
