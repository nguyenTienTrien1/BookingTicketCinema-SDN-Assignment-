import {api} from './api';
export const getUsers=()=>api('/users');
export const createAccount=(data)=>api('/users',{method:'POST',body:JSON.stringify(data)});
export const updateStatus=(id,status)=>api(`/users/${id}/status`,{method:'PATCH',body:JSON.stringify({status})});
export const adjustPoints=(id,points)=>api(`/users/${id}/points`,{method:'PATCH',body:JSON.stringify({points})});
