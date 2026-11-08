import mongoose from 'mongoose';
import User from "../../models/users/User.js";

// Counter staff receive contact details, status and loyalty information only.
const EMPLOYEE_FIELDS = 'fullName email phone memberPoints isVIP status';
const ADMIN_FIELDS = EMPLOYEE_FIELDS + ' age gender role createdAt updatedAt lastLogin';
const SEARCH_LIMIT = 20;

function memberError(message, status = 400) {
    return Object.assign(new Error(message), { status });
}

function memberFields(viewerRole) {
    if (viewerRole === 'admin') return ADMIN_FIELDS;
    if (viewerRole === 'employee') return EMPLOYEE_FIELDS;
    throw memberError('Bạn không có quyền tra cứu thành viên.', 403);
}

function phonePatterns(query) {
    if (query.length > 64 || !/^\+?[0-9\s().-]+$/.test(query)) {
        throw memberError('Nhập email đầy đủ hoặc số điện thoại hợp lệ.');
    }
    let digits = query.replace(/[^0-9]/g, '');
    if (digits.length < 9 || digits.length > 15) {
        throw memberError('Số điện thoại cần có từ 9 đến 15 chữ số.');
    }
    // Vietnamese local, +84 and 0084 numbers identify the same contact.
    if (/^0084[1-9][0-9]{8,9}$/.test(digits)) digits = '0' + digits.slice(4);
    else if (/^84[1-9][0-9]{8,9}$/.test(digits)) digits = '0' + digits.slice(2);
    const variants = [digits];
    if (/^0[1-9][0-9]{8,9}$/.test(digits)) {
        variants.push('84' + digits.slice(1), '0084' + digits.slice(1));
    }
    // Only validated digits enter the regex; separators cannot match digits.
    return variants.map((value) => '^\\s*\\+?' + value.split('').join('[\\s().-]*') + '\\s*$');
}

export async function searchMembers(query, viewerRole) {
    const fields = memberFields(viewerRole);
    if (typeof query !== 'string' || !query.trim() || query.length > 254) {
        throw memberError('Vui lòng nhập email hoặc số điện thoại của thành viên.');
    }
    const value = query.trim();
    const filter = { role: 'member' };
    if (value.includes('@')) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw memberError('Email không hợp lệ.');
        filter.email = value.toLowerCase();
    } else {
        filter.$or = phonePatterns(value).map((pattern) => ({ phone: { $regex: pattern } }));
    }
    const members = await User.find(filter).select(fields).sort({ fullName: 1, _id: 1 }).limit(SEARCH_LIMIT + 1);
    return { members: members.slice(0, SEARCH_LIMIT), hasMore: members.length > SEARCH_LIMIT };
}

export async function getMember(id, viewerRole) {
    const fields = memberFields(viewerRole);
    if (!mongoose.isObjectIdOrHexString(id)) throw memberError('Mã thành viên không hợp lệ.');
    const member = await User.findOne({ _id: id, role: 'member' }).select(fields);
    if (!member) throw memberError('Không tìm thấy thành viên.', 404);
    return member;
}
