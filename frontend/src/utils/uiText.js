const genreLabels = {
    action: 'Hành động',
    adventure: 'Phiêu lưu',
    animation: 'Hoạt hình',
    comedy: 'Hài',
    crime: 'Tội phạm',
    documentary: 'Tài liệu',
    drama: 'Tâm lý',
    family: 'Gia đình',
    fantasy: 'Giả tưởng',
    horror: 'Kinh dị',
    mystery: 'Bí ẩn',
    romance: 'Lãng mạn',
    'sci-fi': 'Khoa học viễn tưởng',
    'science fiction': 'Khoa học viễn tưởng',
    thriller: 'Giật gân',
    war: 'Chiến tranh'
};

const foodLabels = {
    'combo couple': 'Combo đôi',
    'combo family': 'Combo gia đình',
    'combo friends': 'Combo bạn bè',
    'combo mini': 'Combo nhỏ',
    'combo vip': 'Combo VIP',
    'popcorn caramel': 'Bắp rang caramel',
    'popcorn cheese': 'Bắp rang phô mai',
    'popcorn large': 'Bắp rang cỡ lớn',
    'popcorn medium': 'Bắp rang cỡ vừa',
    'popcorn mix': 'Bắp rang thập cẩm',
    'popcorn small': 'Bắp rang cỡ nhỏ'
};

export function translateGenre(genre) {
    return genreLabels[String(genre || '').trim().toLowerCase()] || genre;
}

export function translateFoodName(name) {
    return foodLabels[String(name || '').trim().toLowerCase()] || name;
}

export function translateRole(role) {
    const labels = {
        admin: 'Quản trị viên',
        employee: 'Nhân viên',
        member: 'Thành viên'
    };
    return labels[String(role || '').trim().toLowerCase()] || role || 'Chưa có';
}

export function translateAccountStatus(status) {
    const labels = {
        active: 'Đang hoạt động',
        inactive: 'Ngừng hoạt động',
        blocked: 'Đã khóa',
        banned: 'Đã khóa'
    };
    return labels[String(status || '').trim().toLowerCase()] || status || 'Chưa có';
}
