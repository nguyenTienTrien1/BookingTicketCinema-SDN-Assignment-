import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import Food from '../models/Food.js';
import { movieDataset } from '../../seedMovies.js';

await mongoose.connect(
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/booking_cinema'
);

// Seed only a new database; never erase existing accounts or bookings.
const counts = await Promise.all([User.countDocuments(), Movie.countDocuments(), Showtime.countDocuments(), Food.countDocuments()]);
if (counts.some(count => count > 0)) {
    console.log('Seed skipped: database already contains cinema data.');
    await mongoose.disconnect();
    process.exit(0);
}


// =========================
// USERS
// =========================

const admin = await User.create({
    fullName: 'Cinema Admin',
    email: 'admin@cinema.com',
    password: 'admin123',
    role: 'admin',
    status: 'Active',
    memberPoints: 50
});

await User.create({
    fullName: 'Demo Member',
    email: 'member@cinema.com',
    password: '123456',
    role: 'member',
    status: 'Active',
    memberPoints: 20
});

await User.create({
    fullName: 'Cinema Employee',
    email: 'employee@cinema.com',
    password: 'employee123',
    role: 'employee',
    status: 'Active',
    memberPoints: 0
});

await User.create({
    fullName: 'Pending Member',
    email: 'pending@cinema.com',
    password: '123456',
    role: 'member',
    status: 'Pending Verification',
    memberPoints: 0
});

await User.create({
    fullName: 'Banned User',
    email: 'banned@cinema.com',
    password: '123456',
    role: 'member',
    status: 'Banned',
    memberPoints: 0
});

// =========================
// 19 STANDARDIZED MOVIES
// =========================

const movies = await Movie.insertMany(movieDataset);

// =========================
// SHOWTIMES (Only now-showing movies)
// =========================

const nowShowingMovies = movies.filter(m => m.status === 'now-showing');

for (const m of nowShowingMovies) {

    for (let i = 0; i < 3; i++) {

        const start = new Date(
            Date.now() +
            (i + 1) * 24 * 60 * 60 * 1000
        );

        start.setHours(
            14 + i * 3,
            0,
            0,
            0
        );

        const seats = [];

        for (let r = 0; r < 5; r++) {

            for (let c = 1; c <= 8; c++) {

                seats.push({
                    number:
                        String.fromCharCode(65 + r) + c,
                    status: 'available'
                });

            }
        }

        await Showtime.create({
            movie: m._id,
            cinema: 'Cinema City',
            room: 'Room ' + (i + 1),
            startTime: start,
            price: 80000,
            seats
        });
    }
}

// =========================
// 16 FOODS
// =========================

await Food.insertMany([

    // COMBO
    {
        name: 'Combo Mini',
        description: '1 bắp vừa + 1 nước',
        price: 59000,
        image: '/assets/foods/combo_mini.png',
        available: true, stock: 100
    },

    {
        name: 'Combo Couple',
        description: '1 bắp lớn + 2 nước',
        price: 89000,
        image: '/assets/foods/combo_couple.png',
        available: true, stock: 100
    },

    {
        name: 'Combo Family',
        description: '2 bắp lớn + 4 nước',
        price: 159000,
        image: '/assets/foods/combo_family.png',
        available: true, stock: 100
    },

    {
        name: 'Combo Friends',
        description: '2 bắp vừa + 3 nước',
        price: 129000,
        image: '/assets/foods/combo_friends.png',
        available: true, stock: 100
    },

    {
        name: 'Combo VIP',
        description: '2 bắp phô mai lớn + 2 nước lớn',
        price: 139000,
        image: '/assets/foods/combo_vip.png',
        available: true, stock: 100
    },

    // POPCORN
    {
        name: 'Popcorn Small',
        description: 'Bắp rang size nhỏ vị truyền thống',
        price: 35000,
        image: '/assets/foods/popcorn_small.png',
        available: true, stock: 100
    },

    {
        name: 'Popcorn Medium',
        description: 'Bắp rang size vừa vị truyền thống',
        price: 45000,
        image: '/assets/foods/popcorn_medium.png',
        available: true, stock: 100
    },

    {
        name: 'Popcorn Large',
        description: 'Bắp rang size lớn vị truyền thống',
        price: 55000,
        image: '/assets/foods/popcorn_large.png',
        available: true, stock: 100
    },

    {
        name: 'Popcorn Caramel',
        description: 'Bắp rang vị caramel',
        price: 49000,
        image: '/assets/foods/popcorn_caramel.png',
        available: true, stock: 100
    },

    {
        name: 'Popcorn Cheese',
        description: 'Bắp rang vị phô mai',
        price: 49000,
        image: '/assets/foods/popcorn_cheese.png',
        available: true, stock: 100
    },

    {
        name: 'Popcorn Mix',
        description: 'Bắp rang mix vị',
        price: 49000,
        image: '/assets/foods/popcorn_mix.png',
        available: true, stock: 100
    },

    // DRINKS
    {
        name: 'Coca Cola',
        description: 'Coca Cola lạnh',
        price: 29000,
        image: '/assets/foods/coca_cola.png',
        available: true, stock: 100
    },

    {
        name: 'Pepsi',
        description: 'Pepsi lạnh',
        price: 29000,
        image: '/assets/foods/pepsi.png',
        available: true, stock: 100
    },

    {
        name: 'Sprite',
        description: 'Sprite lạnh',
        price: 29000,
        image: '/assets/foods/sprite.png',
        available: true, stock: 100
    },

    {
        name: 'Fanta',
        description: 'Fanta lạnh',
        price: 29000,
        image: '/assets/foods/fanta.png',
        available: true, stock: 100
    },

    {
        name: 'Dasani',
        description: 'Nước suối Dasani',
        price: 19000,
        image: '/assets/foods/dasani.png',
        available: true, stock: 100
    }

]);

// =========================
// RESULT
// =========================

console.log('================================');
console.log('SEED COMPLETED SUCCESSFULLY');
console.log('Movies:', movies.length);
console.log('Foods: 16');
console.log('Showtimes:', nowShowingMovies.length * 3);
console.log('Admin:', admin.email);
console.log('================================');

await mongoose.disconnect();
