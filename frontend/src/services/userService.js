import {api} from './api';
export const getUsers=()=>api('/users');
export const getPointHistory=(id)=>api(`/users/${id}/points-history`);
export const createAccount=(data)=>api('/users',{method:'POST',body:JSON.stringify(data)});
export const updateStatus=(id,status,expectedStatus)=>api(`/users/${id}/status`,{method:'PATCH',body:JSON.stringify({status,expectedStatus})});
export const adjustPoints=(id,points,reason,expectedBalance,requestId)=>api(`/users/${id}/points`,{method:'PATCH',body:JSON.stringify({points,reason,expectedBalance,requestId})});
