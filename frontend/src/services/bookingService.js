import {api} from './api';
export const getBookings=(options={})=>api('/bookings',options);
export const createBooking=(data)=>api('/bookings',{method:'POST',body:JSON.stringify(data)});
export const applyPoints=(id,data)=>api(`/bookings/${id}/points`,{method:'PATCH',body:JSON.stringify(data)});
export const payBooking=(id,data)=>api(`/bookings/${id}/pay`,{method:'POST',body:JSON.stringify(data)});
