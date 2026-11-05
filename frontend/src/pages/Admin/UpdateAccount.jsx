import {api} from '../../services/api';
import {Link} from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getUsers, updateStatus } from '../../services/userService';
import { translateAccountStatus, translateRole } from '../../utils/uiText';

const statuses = ['Active', 'Deactivated', 'Banned'];

export default function UpdateAccount({ setMsg }) {
    const [users, setUsers] = useState([]);
    const [invite,setInvite]=useState(null);

    useEffect(() => {
        getUsers().then(setUsers).catch((error) => setMsg(error.message));
    }, [setMsg]);

    async function change(user, status) {
        if (!window.confirm('Xác nhận đổi trạng thái từ ' + user.status + ' sang ' + status + '?')) return;
        try {
            const updated = await updateStatus(user._id, status, user.status);
            setUsers((current) => current.map((item) => item._id === user._id ? updated : item));
            setMsg('Đã cập nhật trạng thái tài khoản.');
        } catch (error) {
            setMsg(error.message);
        }
    }

    return (
        <section className="page">
            <h2>Cập nhật trạng thái tài khoản</h2>
            {invite&&<p>{invite.message} {invite.activationLink&&<Link to={invite.activationLink}>Mở lời mời local</Link>}</p>}
            <div className="adminList">
                {users.map((user) => (
                    <div className="adminRow" key={user._id}>
                        <div>
                            <b>{user.fullName}</b>
                            <span>{user.email} · {translateRole(user.role)}</span>
                        </div>
                        {user.status==='Pending Activation'&&<button type="button" onClick={async()=>{try{setInvite(await api('/users/'+user._id+'/invitation',{method:'POST',body:'{}'}));}catch(e){setMsg(e.message);}}}>Gửi lại lời mời</button>}
                        <select
                            aria-label={`Trạng thái tài khoản ${user.fullName}`}
                            value={({ active: 'Active', inactive: 'Deactivated', blocked: 'Banned', Inactive: 'Deactivated' })[user.status] || user.status}
                            onChange={(event) => change(user, event.target.value)}
                        >
                            <option value="Pending Activation" disabled>Chờ kích hoạt nhân sự</option>
                            <option value="Pending Verification" disabled>Chờ xác thực email</option>
                            {statuses.map((status) => (
                                <option value={status} key={status}>{translateAccountStatus(status)}</option>
                            ))}
                        </select>
                    </div>
                ))}
                {!users.length && <p>Chưa có tài khoản nào.</p>}
            </div>
        </section>
    );
}
