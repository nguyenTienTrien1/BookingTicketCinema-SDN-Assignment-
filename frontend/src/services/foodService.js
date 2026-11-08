import {api} from './api';
// Lấy danh sách bắp nước từ server để khách chọn khi đặt vé.
export const getFoods=()=>api('/foods');
