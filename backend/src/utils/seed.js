import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Movie from '../models/Movie.js';
import Showtime from '../models/Showtime.js';
import Food from '../models/Food.js';

await mongoose.connect(
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/booking_cinema'
);

await Promise.all([
    User.deleteMany({}),
    Movie.deleteMany({}),
    Showtime.deleteMany({}),
    Food.deleteMany({})
]);

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
// 17 MOVIES
// =========================

const movies = await Movie.insertMany([
    {
        title: 'If Wishes Could Kill',
        description: 'A mysterious thriller filled with suspense and unexpected twists.',
        poster: '/assets/posters/if_wishes_could_kill.jpg',
        genre: ['Thriller', 'Mystery'],
        duration: 110,
        ageLimit: 16,
        rating: 7.8,
        releaseDate: new Date('2026-01-10'),
        featured: true
    },
    {
        title: 'Four Hands',
        description: 'A dramatic story about music, family and ambition.',
        poster: '/assets/posters/four_hands.jpg',
        genre: ['Drama', 'Music'],
        duration: 105,
        ageLimit: 13,
        rating: 7.5,
        releaseDate: new Date('2026-02-01'),
        featured: false
    },
    {
        title: 'The Legend of Kitchen Soldier',
        description: 'An action comedy adventure surrounding an unexpected hero.',
        poster: '/assets/posters/the_legend_of_kitchen_soldier.jpg',
        genre: ['Action', 'Comedy'],
        duration: 118,
        ageLimit: 13,
        rating: 7.6,
        releaseDate: new Date('2026-02-15'),
        featured: true
    },
    {
        title: 'The Great Flood',
        description: 'A disaster movie about survival against a catastrophic flood.',
        poster: '/assets/posters/the_great_flood.jpg',
        genre: ['Action', 'Drama'],
        duration: 125,
        ageLimit: 13,
        rating: 8.0,
        releaseDate: new Date('2026-03-01'),
        featured: true
    },
    {
        title: 'Alice in Borderland',
        description: 'A group of players must survive dangerous games in a mysterious world.',
        poster: '/assets/posters/alice_in_borderland.jpg',
        genre: ['Action', 'Thriller'],
        duration: 130,
        ageLimit: 16,
        rating: 8.7,
        releaseDate: new Date('2026-03-10'),
        featured: true
    },
    {
        title: 'All of Us Are Dead',
        description: 'Students struggle to survive after a zombie outbreak.',
        poster: '/assets/posters/all_of_us_are_dead.jpg',
        genre: ['Horror', 'Action'],
        duration: 120,
        ageLimit: 18,
        rating: 8.2,
        releaseDate: new Date('2026-03-15'),
        featured: false
    },
    {
        title: 'Stranger Things',
        description: 'A supernatural mystery involving friendship and a strange parallel world.',
        poster: '/assets/posters/stranger_things.jpg',
        genre: ['Sci-Fi', 'Horror'],
        duration: 115,
        ageLimit: 16,
        rating: 8.8,
        releaseDate: new Date('2026-04-01'),
        featured: true
    },
    {
        title: 'Wednesday',
        description: 'A dark coming-of-age mystery at a strange academy.',
        poster: '/assets/posters/wednesday.jpg',
        genre: ['Comedy', 'Mystery'],
        duration: 110,
        ageLimit: 13,
        rating: 8.4,
        releaseDate: new Date('2026-04-05'),
        featured: false
    },
    {
        title: 'The Chronicles of Narnia',
        description: 'An epic fantasy adventure in the magical land of Narnia.',
        poster: '/assets/posters/the_chronicles_of_narnia.jpg',
        genre: ['Fantasy', 'Adventure'],
        duration: 143,
        ageLimit: 0,
        rating: 8.1,
        releaseDate: new Date('2026-04-10'),
        featured: true
    },
    {
        title: 'The Maze Runner',
        description: 'Young survivors must escape a dangerous maze.',
        poster: '/assets/posters/the_maze_runner.jpg',
        genre: ['Action', 'Sci-Fi'],
        duration: 113,
        ageLimit: 13,
        rating: 7.9,
        releaseDate: new Date('2026-04-15'),
        featured: false
    },
    {
        title: 'Venom',
        description: 'A journalist becomes host to a powerful alien symbiote.',
        poster: '/assets/posters/venom.jpg',
        genre: ['Action', 'Sci-Fi'],
        duration: 112,
        ageLimit: 13,
        rating: 7.7,
        releaseDate: new Date('2026-04-20'),
        featured: true
    },
    {
        title: 'Dune',
        description: 'An epic science-fiction journey across the desert planet Arrakis.',
        poster: '/assets/posters/dune.jpg',
        genre: ['Sci-Fi', 'Adventure'],
        duration: 155,
        ageLimit: 13,
        rating: 8.6,
        releaseDate: new Date('2026-05-01'),
        featured: true
    },
    {
        title: 'Joker',
        description: 'A psychological crime drama exploring the origins of a troubled man.',
        poster: '/assets/posters/joker.jpg',
        genre: ['Crime', 'Drama'],
        duration: 122,
        ageLimit: 18,
        rating: 8.4,
        releaseDate: new Date('2026-05-05'),
        featured: false
    },
    {
        title: 'The Batman',
        description: 'Batman investigates a series of crimes across Gotham City.',
        poster: '/assets/posters/the_batman.jpg',
        genre: ['Action', 'Crime'],
        duration: 176,
        ageLimit: 16,
        rating: 8.3,
        releaseDate: new Date('2026-05-10'),
        featured: true
    },
    {
        title: 'Attack on Titan',
        description: 'Humanity fights for survival against mysterious giant Titans.',
        poster: '/assets/posters/attack_on_titan.jpg',
        genre: ['Action', 'Fantasy'],
        duration: 140,
        ageLimit: 18,
        rating: 9.0,
        releaseDate: new Date('2026-05-15'),
        featured: true
    },
    {
        title: 'Harry Potter',
        description: 'A young wizard discovers a magical world and faces a dark enemy.',
        poster: '/assets/posters/harry_potter.jpg',
        genre: ['Fantasy', 'Adventure'],
        duration: 152,
        ageLimit: 0,
        rating: 8.5,
        releaseDate: new Date('2026-05-20'),
        featured: false
    },
    {
        title: 'Avatar: Fire and Ash',
        description: 'A new chapter in the epic adventure of Pandora.',
        poster: '/assets/posters/avatar_fire_and_ash.jpg',
        genre: ['Sci-Fi', 'Adventure'],
        duration: 190,
        ageLimit: 13,
        rating: 8.9,
        releaseDate: new Date('2026-06-01'),
        featured: true
    }
]);

// =========================
// SHOWTIMES
// =========================

for (const m of movies) {

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
        available: true
    },

    {
        name: 'Combo Couple',
        description: '1 bắp lớn + 2 nước',
        price: 109000,
        image: '/assets/foods/combo_couple.png',
        available: true
    },

    {
        name: 'Combo Family',
        description: '2 bắp lớn + 2 nước',
        price: 159000,
        image: '/assets/foods/combo_family.png',
        available: true
    },

    {
        name: 'Combo Friends',
        description: '1 bắp lớn + 3 nước',
        price: 169000,
        image: '/assets/foods/combo_friends.png',
        available: true
    },

    {
        name: 'Combo VIP',
        description: '2 bắp lớn + 4 nước',
        price: 219000,
        image: '/assets/foods/combo_vip.png',
        available: true
    },

    // POPCORN
    {
        name: 'Popcorn Small',
        description: 'Bắp rang size nhỏ',
        price: 29000,
        image: '/assets/foods/popcorn_small.png',
        available: true
    },

    {
        name: 'Popcorn Medium',
        description: 'Bắp rang size vừa',
        price: 39000,
        image: '/assets/foods/popcorn_medium.png',
        available: true
    },

    {
        name: 'Popcorn Large',
        description: 'Bắp rang size lớn',
        price: 79000,
        image: '/assets/foods/popcorn_large.png',
        available: true
    },

    {
        name: 'Popcorn Caramel',
        description: 'Bắp rang vị caramel',
        price: 49000,
        image: '/assets/foods/popcorn_caramel.png',
        available: true
    },

    {
        name: 'Popcorn Cheese',
        description: 'Bắp rang vị phô mai',
        price: 49000,
        image: '/assets/foods/popcorn_cheese.png',
        available: true
    },

    {
        name: 'Popcorn Mix',
        description: 'Bắp rang mix vị',
        price: 49000,
        image: '/assets/foods/popcorn_mix.png',
        available: true
    },

    // DRINKS
    {
        name: 'Coca Cola',
        description: 'Coca Cola lạnh',
        price: 29000,
        image: '/assets/foods/coca_cola.png',
        available: true
    },

    {
        name: 'Pepsi',
        description: 'Pepsi lạnh',
        price: 29000,
        image: '/assets/foods/pepsi.png',
        available: true
    },

    {
        name: 'Sprite',
        description: 'Sprite lạnh',
        price: 29000,
        image: '/assets/foods/sprite.png',
        available: true
    },

    {
        name: 'Fanta',
        description: 'Fanta lạnh',
        price: 29000,
        image: '/assets/foods/fanta.png',
        available: true
    },

    {
        name: 'Dasani',
        description: 'Nước suối Dasani',
        price: 19000,
        image: '/assets/foods/dasani.png',
        available: true
    }

]);

// =========================
// RESULT
// =========================

console.log('================================');
console.log('SEED COMPLETED SUCCESSFULLY');
console.log('Movies:', movies.length);
console.log('Foods: 16');
console.log('Showtimes:', movies.length * 3);
console.log('Admin:', admin.email);
console.log('================================');

await mongoose.disconnect();