import { useCallback, useEffect, useRef, useState } from 'react';
import { getProfile } from '../services/profileService';

export default function useMemberPoints(user, setUser) {
    const memberId = user?.role === 'member' ? user._id : null;
    const [step,setStep]=useState(1);
    const [balance, setBalance] = useState(Number(user?.memberPoints || 0));
    const [refreshing, setRefreshing] = useState(!!memberId);
    const [error, setError] = useState('');
    const revision = useRef(0);

    const refresh = useCallback(async () => {
        if (!memberId) return;
        const request = ++revision.current;
        setRefreshing(true);
        setError('');
        try {
            const profile = await getProfile();
            if (request !== revision.current || profile._id !== memberId) return;
            setBalance(profile.memberPoints);
            setStep(profile.pointRedeemStep||1);
            setUser((current) => current?._id === memberId
                ? { ...current, memberPoints: profile.memberPoints }
                : current);
        } catch (err) {
            if (request === revision.current) setError(err.response?.data?.message || 'Không tải được số dư điểm. Vui lòng thử lại.');
        } finally {
            if (request === revision.current) setRefreshing(false);
        }
    }, [memberId, setUser]);

    useEffect(() => {
        refresh();
        window.addEventListener('focus', refresh);
        window.addEventListener('member-points-changed', refresh);
        return () => {
            ++revision.current;
            window.removeEventListener('focus', refresh);
            window.removeEventListener('member-points-changed', refresh);
        };
    }, [refresh]);

    useEffect(() => {
        setBalance(Number(user?.memberPoints || 0));
    }, [user?.memberPoints]);

    return { balance, step, refreshing, error, refresh };
}
