import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import Movie from "../../src/models/movies/Movie.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/booking_cinema';

// Standardized list of 19 Cinema+ movies
export const movieDataset = [
  {
    title: 'If Wishes Could Kill',
    description: 'A mysterious thriller filled with suspense and unexpected twists.',
    poster: '/images/posters/if_wishes_could_kill.jpg',
    banner: '/images/backdrops/rampage.jpg',
    trailer: '',
    genre: ['Thriller', 'Mystery'],
    duration: 110,
    ageLimit: 16,
    rating: 7.8,
    releaseDate: new Date('2026-01-10'),
    status: 'now-showing',
    featured: true
  },
  {
    title: 'Four Hands',
    description: 'A dramatic story about music, family and ambition.',
    poster: '/images/posters/four_hands.jpg',
    banner: '/images/backdrops/rampage.jpg',
    trailer: '',
    genre: ['Drama', 'Music'],
    duration: 105,
    ageLimit: 13,
    rating: 7.5,
    releaseDate: new Date('2026-02-01'),
    status: 'now-showing',
    featured: false
  },
  {
    title: 'The Legend of Kitchen Soldier',
    description: 'An action comedy adventure surrounding an unexpected hero.',
    poster: '/images/posters/the_legend_of_kitchen_soldier.jpg',
    banner: '/images/backdrops/dune.jpg',
    trailer: '',
    genre: ['Action', 'Comedy'],
    duration: 118,
    ageLimit: 13,
    rating: 7.6,
    releaseDate: new Date('2026-02-15'),
    status: 'coming-soon',
    featured: false
  },
  {
    title: 'The Great Flood',
    description: 'A disaster movie about survival against a catastrophic flood.',
    poster: '/images/posters/the_great_flood.jpg',
    banner: '/images/backdrops/rampage.jpg',
    trailer: '',
    genre: ['Action', 'Drama'],
    duration: 125,
    ageLimit: 13,
    rating: 8.0,
    releaseDate: new Date('2026-03-01'),
    status: 'coming-soon',
    featured: false
  },
  {
    title: 'Alice in Borderland',
    description: 'A group of players must survive dangerous games in a mysterious world.',
    poster: '/images/posters/alice_in_borderland.jpg',
    banner: '/images/backdrops/dune.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/49_44FFhvFs',
    genre: ['Action', 'Thriller'],
    duration: 130,
    ageLimit: 16,
    rating: 8.7,
    releaseDate: new Date('2026-03-10'),
    status: 'now-showing',
    featured: true
  },
  {
    title: 'All of Us Are Dead',
    description: 'Students struggle to survive after a zombie outbreak.',
    poster: '/images/posters/all_of_us_are_dead.jpg',
    banner: '/images/backdrops/stranger_things.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/IN5TD4VRcST8',
    genre: ['Horror', 'Action'],
    duration: 120,
    ageLimit: 18,
    rating: 8.2,
    releaseDate: new Date('2026-03-15'),
    status: 'now-showing',
    featured: false
  },
  {
    title: 'Stranger Things',
    description: 'A supernatural mystery involving friendship and a strange parallel world.',
    poster: '/images/posters/stranger_things.jpg',
    banner: '/images/backdrops/stranger_things.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/b9EkMc79ZSU',
    genre: ['Sci-Fi', 'Horror'],
    duration: 115,
    ageLimit: 16,
    rating: 8.8,
    releaseDate: new Date('2026-04-01'),
    status: 'now-showing',
    featured: true
  },
  {
    title: 'Wednesday',
    description: 'A dark coming-of-age mystery at a strange academy.',
    poster: '/images/posters/wednesday.jpg',
    banner: '/images/backdrops/rampage.jpg',
    trailer: '',
    genre: ['Comedy', 'Mystery'],
    duration: 110,
    ageLimit: 13,
    rating: 8.4,
    releaseDate: new Date('2026-04-05'),
    status: 'now-showing',
    featured: false
  },
  {
    title: 'The Chronicles of Narnia',
    description: 'An epic fantasy adventure in the magical land of Narnia.',
    poster: '/images/posters/the_chronicles_of_narnia.jpg',
    banner: '/images/backdrops/rampage.jpg',
    trailer: '',
    genre: ['Fantasy', 'Adventure'],
    duration: 143,
    ageLimit: 0,
    rating: 8.1,
    releaseDate: new Date('2026-04-10'),
    status: 'now-showing',
    featured: true
  },
  {
    title: 'The Maze Runner',
    description: 'Young survivors must escape a dangerous maze.',
    poster: '/images/posters/the_maze_runner.jpg',
    banner: '/images/backdrops/rampage.jpg',
    trailer: '',
    genre: ['Action', 'Sci-Fi'],
    duration: 113,
    ageLimit: 13,
    rating: 7.9,
    releaseDate: new Date('2026-04-15'),
    status: 'now-showing',
    featured: false
  },
  {
    title: 'Venom',
    description: 'A journalist becomes host to a powerful alien symbiote.',
    poster: '/images/posters/venom.jpg',
    banner: '/images/backdrops/venom.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/u9Mv98Gr5pY',
    genre: ['Action', 'Sci-Fi'],
    duration: 112,
    ageLimit: 13,
    rating: 7.7,
    releaseDate: new Date('2026-04-20'),
    status: 'now-showing',
    featured: true
  },
  {
    title: 'Dune',
    description: 'An epic science-fiction journey across the desert planet Arrakis.',
    poster: '/images/posters/dune.jpg',
    banner: '/images/backdrops/dune.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/8g18jFHCLXk',
    genre: ['Sci-Fi', 'Adventure'],
    duration: 155,
    ageLimit: 13,
    rating: 8.6,
    releaseDate: new Date('2026-05-01'),
    status: 'now-showing',
    featured: true
  },
  {
    title: 'Joker',
    description: 'A psychological crime drama exploring the origins of a troubled man.',
    poster: '/images/posters/joker.jpg',
    banner: '/images/backdrops/rampage.jpg',
    trailer: '',
    genre: ['Crime', 'Drama'],
    duration: 122,
    ageLimit: 18,
    rating: 8.4,
    releaseDate: new Date('2026-05-05'),
    status: 'now-showing',
    featured: false
  },
  {
    title: 'The Batman',
    description: 'Batman investigates a series of crimes across Gotham City.',
    poster: '/images/posters/the_batman.jpg',
    banner: '/images/backdrops/the_batman.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/mqqft2x_Aa4',
    genre: ['Action', 'Crime'],
    duration: 176,
    ageLimit: 16,
    rating: 8.3,
    releaseDate: new Date('2026-05-10'),
    status: 'now-showing',
    featured: true
  },
  {
    title: 'Attack on Titan',
    description: 'Humanity fights for survival against mysterious giant Titans.',
    poster: '/images/posters/attack_on_titan.jpg',
    banner: '/images/backdrops/the_batman.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/M_OauHnAFc8',
    genre: ['Action', 'Fantasy'],
    duration: 140,
    ageLimit: 18,
    rating: 9.0,
    releaseDate: new Date('2026-05-15'),
    status: 'now-showing',
    featured: true
  },
  {
    title: 'Harry Potter',
    description: 'A young wizard discovers a magical world and faces a dark enemy.',
    poster: '/images/posters/harry_potter.jpg',
    banner: '/images/backdrops/rampage.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/VyHV0BRtdxo',
    genre: ['Fantasy', 'Adventure'],
    duration: 152,
    ageLimit: 0,
    rating: 8.5,
    releaseDate: new Date('2026-05-20'),
    status: 'now-showing',
    featured: false
  },
  {
    title: 'Avatar: Fire and Ash',
    description: 'A new chapter in the epic adventure of Pandora.',
    poster: '/images/posters/avatar_fire_and_ash.jpg',
    banner: '/images/backdrops/avatar_fire_and_ash.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/d9MyW72ELq0',
    genre: ['Sci-Fi', 'Adventure'],
    duration: 190,
    ageLimit: 13,
    rating: 8.9,
    releaseDate: new Date('2026-06-01'),
    status: 'coming-soon',
    featured: true
  },
  {
    title: 'Rampage',
    description: 'Khi ba loài động vật khác nhau bị nhiễm một mầm bệnh nguy hiểm, một nhà linh trưởng học và một nhà di truyền học phải hợp tác để ngăn chặn chúng tàn phá Chicago.',
    poster: '/images/posters/rampage.jpg',
    banner: '/images/backdrops/rampage.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/coOKvrsmQiI',
    genre: ['Action', 'Adventure', 'Sci-Fi'],
    duration: 107,
    ageLimit: 13,
    rating: 8.5,
    releaseDate: new Date('2026-04-13'),
    status: 'now-showing',
    featured: true
  },
  {
    title: 'Jurassic World: Fallen Kingdom',
    description: 'Khi ngọn núi lửa trên đảo Isla Nublar bắt đầu hoạt động trở lại, Owen và Claire tiến hành chiến dịch giải cứu những con khủng long còn sống sót khỏi nguy cơ tuyệt chủng lần thứ hai.',
    poster: '/images/posters/jurassic_world.jpg',
    banner: '/images/backdrops/jurassic_world.jpg',
    trailer: 'https://www.youtube-nocookie.com/embed/vn9mMeSuGgo',
    genre: ['Action', 'Adventure', 'Sci-Fi'],
    duration: 128,
    ageLimit: 13,
    rating: 8.3,
    releaseDate: new Date('2026-06-22'),
    status: 'now-showing',
    featured: true
  }
];

// Helper to escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Image verification helper
function verifyLocalImages() {
  const publicDir = path.resolve(__dirname, "../../../frontend/public");
  let missingCount = 0;

  if (!fs.existsSync(publicDir)) {
    console.log('[WARN] Frontend public folder not found relative to backend. Skipping local file check.');
    return 0;
  }

  for (const movie of movieDataset) {
    if (movie.poster) {
      const posterFile = path.join(publicDir, movie.poster);
      if (!fs.existsSync(posterFile)) {
        console.warn(`[WARN] Missing poster file for "${movie.title}": ${movie.poster}`);
        missingCount++;
      }
    }
    if (movie.banner) {
      const bannerFile = path.join(publicDir, movie.banner);
      if (!fs.existsSync(bannerFile)) {
        console.warn(`[WARN] Missing backdrop file for "${movie.title}": ${movie.banner}`);
        missingCount++;
      }
    }
  }

  if (missingCount === 0) {
    console.log('[OK] All 19 movie poster and backdrop image paths exist on disk.');
  }
  return missingCount;
}

/**
 * Main safe and repeatable seeding function
 */
export async function seedMovies(customUri = null) {
  const uri = customUri || MONGODB_URI;

  try {
    console.log('--------------------------------------------------');
    console.log('CINEMA+ MOVIE SEED SYNCHRONIZER');
    console.log('Target Database URI:', uri);
    console.log('--------------------------------------------------');

    // 1. Image verification
    verifyLocalImages();

    // 2. Connect to MongoDB
    await mongoose.connect(uri);
    console.log('[OK] Connected to MongoDB.');

    let insertedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    // 3. Process each movie safely without deleteMany
    for (const movieData of movieDataset) {
      const cleanTitle = movieData.title.trim();

      // Find by case-insensitive title match to avoid duplicate entries
      const existing = await Movie.findOne({
        title: { $regex: new RegExp(`^${escapeRegex(cleanTitle)}$`, 'i') }
      });

      if (!existing) {
        // Safe insert
        await Movie.create(movieData);
        insertedCount++;
        console.log(`[+] Inserted: "${cleanTitle}" (${movieData.status})`);
      } else {
        // Existing movie: preserve MongoDB _id & existing showtimes/bookings
        // Check if standardization is needed (e.g. updating old /assets/ paths to /images/ or filling missing banner/trailer/status)
        let needsUpdate = false;
        const updates = {};

        // Standardize legacy poster path to /images/posters/
        if (existing.poster !== movieData.poster && (!existing.poster || existing.poster.includes('/assets/'))) {
          updates.poster = movieData.poster;
          needsUpdate = true;
        }

        // Fill missing banner
        if (!existing.banner && movieData.banner) {
          updates.banner = movieData.banner;
          needsUpdate = true;
        }

        // Fill missing trailer
        if ((!existing.trailer || existing.trailer === '') && movieData.trailer) {
          updates.trailer = movieData.trailer;
          needsUpdate = true;
        }

        // Fill missing status
        if (!existing.status && movieData.status) {
          updates.status = movieData.status;
          needsUpdate = true;
        }

        if (needsUpdate) {
          await Movie.updateOne({ _id: existing._id }, { $set: updates });
          updatedCount++;
          console.log(`[*] Synchronized fields for: "${cleanTitle}" (ID preserved: ${existing._id})`);
        } else {
          skippedCount++;
          console.log(`[-] Skipped (already exists): "${cleanTitle}" (ID preserved: ${existing._id})`);
        }
      }
    }

    const totalInDb = await Movie.countDocuments();

    console.log('--------------------------------------------------');
    console.log('SEED SUMMARY:');
    console.log(`- Total movies in dataset: ${movieDataset.length}`);
    console.log(`- Newly inserted:          ${insertedCount}`);
    console.log(`- Synchronized/Updated:     ${updatedCount}`);
    console.log(`- Untouched/Skipped:        ${skippedCount}`);
    console.log(`- Total movies in database: ${totalInDb}`);
    console.log('--------------------------------------------------');

    await mongoose.disconnect();
    console.log('[OK] Disconnected from MongoDB cleanly.');

    return {
      totalDataset: movieDataset.length,
      insertedCount,
      updatedCount,
      skippedCount,
      totalInDb
    };
  } catch (error) {
    console.error('[ERROR] Movie seed failed:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    throw error;
  }
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('seedMovies.js')) {
  seedMovies()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
