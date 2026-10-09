import {api} from './api';
export const login=(data)=>api('/auth/login',{method:'POST',body:JSON.stringify(data)});
