import {translateFoodName} from '../utils/uiText';
import {foodImageUrl} from '../services/catalogueService';
import placeholder from '../assets/foods/placeholder.svg';
const images = import.meta.glob('../assets/foods/*.png', {eager:true, import:'default'});
export function foodImage(food) {
 const source = typeof food?.image === 'string' ? food.image.trim() : '';
 if (source.startsWith('/api/uploads/foods/')) return foodImageUrl(source);
 if (/^https?:\/\//i.test(source)) return source;
 if (source.startsWith('/assets/foods/')) {
  const bundled = images['..'+source];
  if (bundled) return bundled;
 }
 if (/^\/(?!\/)/.test(source)) return source;
 if (!source) return images['../assets/foods/'+food?.name?.toLowerCase().replaceAll(' ','_')+'.png'] || placeholder;
 return placeholder;
}
// Hiển thị bắp nước và số lượng đã chọn; món ngừng bán/hết hàng không được thêm.
export default function FoodPicker({foods,items,onChange,disabled=false}) {
 if (!foods.length) return <p className="helperText" role="status">Chưa có bắp nước đang bán. Bạn có thể tiếp tục đặt vé mà không chọn món.</p>;
 return <div className="foodGrid">{foods.map(food=>{
 const quantity=items.find(item=>item._id===food._id)?.quantity||0;
 const stock=Number(food.stock||0), unavailable=disabled||!food.available||stock<1;
 // Số lượng phải nguyên, từ 0 đến tồn kho; chọn 0 thì bỏ món khỏi danh sách.
 const change=value=>{if(!Number.isSafeInteger(value)||value<0||value>stock)return;onChange([...items.filter(item=>item._id!==food._id),...(value?[{...food,quantity:value}]:[])]);};
 return <article className={'foodItem'+(quantity?' chosen':'')} key={food._id}>
  <img src={foodImage(food)} alt={translateFoodName(food.name)} loading="lazy" width="200" height="150" onError={event=>{const image=event.currentTarget;if(image.src!==new URL(placeholder,window.location.href).href)image.src=placeholder;}} />
  <strong>{translateFoodName(food.name)}</strong><span className="foodPrice">{Number(food.price).toLocaleString('vi-VN')}đ <small>/ phần</small></span>
  {food.description&&<p className="foodDescription">{food.description}</p>}
  <small>{stock>0?'Còn '+stock+' phần':'Tạm hết hàng'}</small>
  <div className="foodQuantity"><button type="button" aria-label={'Giảm '+translateFoodName(food.name)} disabled={unavailable||quantity===0} onClick={()=>change(quantity-1)}>−</button>
  <input aria-label={'Số lượng '+translateFoodName(food.name)} type="number" min="0" max={stock} step="1" disabled={unavailable} value={quantity} onChange={event=>change(Number(event.target.value))}/>
  <button type="button" aria-label={'Thêm '+translateFoodName(food.name)} disabled={unavailable||quantity>=stock} onClick={()=>change(quantity+1)}>+</button></div>
 </article>;})}</div>;
}
