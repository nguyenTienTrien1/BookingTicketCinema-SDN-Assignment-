import {useState} from 'react';
import {Link} from 'react-router-dom';
import {createAccount} from '../../services/userService';
export default function CreateAccount(){
 const [form,setForm]=useState({fullName:'',email:'',phone:'',role:'employee'}),[busy,setBusy]=useState(false),[result,setResult]=useState(null),[error,setError]=useState('');
 return <section className="page"><h2>Tạo tài khoản nhân sự</h2><p>Nhân sự nhận lời mời có hạn 24 giờ và tự đặt mật khẩu. Admin không tạo mật khẩu dùng lại.</p>
 <form className="adminForm" onSubmit={async event=>{event.preventDefault();if(busy)return;setBusy(true);setError('');try{setResult(await createAccount(form));}catch(e){setError(e.message);}finally{setBusy(false);}}}>
 <fieldset disabled={busy}>{['fullName','email','phone'].map((key,index)=><label key={key}>{['Họ tên','Email','Điện thoại (tùy chọn)'][index]}<input type={key==='email'?'email':'text'} required={key!=='phone'} value={form[key]} onChange={event=>setForm({...form,[key]:event.target.value})}/></label>)}
 <label>Vai trò<select value={form.role} onChange={event=>setForm({...form,role:event.target.value})}><option value="employee">Employee</option><option value="admin">Admin</option></select></label><button className="primary" type="submit">{busy?'Đang tạo…':'Tạo và gửi lời mời'}</button></fieldset></form>
 {error&&<p role="alert">{error}</p>}{result&&<div role="status"><p>{result.message}</p>{result.activationLink&&<Link to={result.activationLink}>Mở lời mời kích hoạt (bản local)</Link>}</div>}</section>;
}
