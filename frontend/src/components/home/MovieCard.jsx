import { useState } from 'react';
import { translateGenre } from '../../utils/uiText';
import '../../styles/home/home.css';

// Fallback images map for local assets
import alice from '../../assets/posters/alice_in_borderland.jpg';
import usDead from '../../assets/posters/all_of_us_are_dead.jpg';
import attack from '../../assets/posters/attack_on_titan.jpg';
import avatar from '../../assets/posters/avatar_fire_and_ash.jpg';
import dune from '../../assets/posters/dune.jpg';
import fourHands from '../../assets/posters/four_hands.jpg';
import harry from '../../assets/posters/harry_potter.jpg';
import wishes from '../../assets/posters/if_wishes_could_kill.jpg';
import joker from '../../assets/posters/joker.jpg';
import stranger from '../../assets/posters/stranger_things.jpg';
import batman from '../../assets/posters/the_batman.jpg';
import narnia from '../../assets/posters/the_chronicles_of_narnia.jpg';
import flood from '../../assets/posters/the_great_flood.jpg';
import kitchen from '../../assets/posters/the_legend_of_kitchen_soldier.jpg';
import maze from '../../assets/posters/the_maze_runner.jpg';
import venom from '../../assets/posters/venom.jpg';
import wednesday from '../../assets/posters/wednesday.jpg';

const localPosters = {
  'if wishes could kill': wishes,
  'four hands': fourHands,
  'the legend of kitchen soldier': kitchen,
  'the great flood': flood,
  'alice in borderland': alice,
  'all of us are dead': usDead,
  'stranger things': stranger,
  'wednesday': wednesday,
  'the chronicles of narnia': narnia,
  'the maze runner': maze,
  'venom': venom,
  'dune': dune,
  'joker': joker,
  'the batman': batman,
  'attack on titan': attack,
  'harry potter': harry,
  'avatar fire and ash': avatar,
  'avatar: fire and ash': avatar,
  'rampage': '/images/posters/rampage.jpg',
  'jurassic world: fallen kingdom': '/images/posters/jurassic_world.jpg',
  'jurassic world fallen kingdom': '/images/posters/jurassic_world.jpg'
};

export default function MovieCard({ movie, onBook, onDetail }) {
  const [imgError, setImgError] = useState(false);

  if (!movie) return null;

  const normalizedTitle = String(movie.title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  const posterSource =
    (!imgError && movie.poster) ||
    localPosters[normalizedTitle] ||
    localPosters[movie.title?.toLowerCase()] ||
    '/images/posters/rampage.jpg';

  const year = movie.releaseDate
    ? new Date(movie.releaseDate).getFullYear()
    : '2026';

  const primaryGenre =
    movie.genre && movie.genre.length > 0
      ? translateGenre(movie.genre[0])
      : 'Điện ảnh';

  const isComingSoon =
    movie.status === 'coming-soon' ||
    (movie.releaseDate && new Date(movie.releaseDate).getTime() > Date.now() + 14 * 24 * 60 * 60 * 1000);

  function handleCardClick() {
    if (onDetail) {
      onDetail(movie);
    }
  }

  function handleBookClick(e) {
    e.stopPropagation();
    if (onBook) {
      onBook(movie);
    }
  }

  function handleDetailClick(e) {
    e.stopPropagation();
    if (onDetail) {
      onDetail(movie);
    }
  }

  return (
    <article
      className="cinematicMovieCard"
      onClick={handleCardClick}
      title={`${movie.title} (${year})`}
    >
      <div className="cardPosterWrapper">
        {/* Top Badges */}
        {isComingSoon ? (
          <span className="cardBadgeTopLeft" style={{ background: '#3b82f6' }}>
            Sắp chiếu
          </span>
        ) : (
          <span className="cardBadgeTopLeft">2D</span>
        )}

        {movie.rating > 0 && (
          <span className="cardBadgeTopRight">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#ffb800">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {movie.rating.toFixed(1)}
          </span>
        )}

        {/* Poster Image */}
        <img
          src={posterSource}
          alt={movie.title}
          className="cardPosterImg"
          loading="lazy"
          onError={() => setImgError(true)}
        />

        {/* Hover Action Overlay */}
        <div className="cardHoverOverlay">
          {!isComingSoon && (
            <button
              type="button"
              className="cardQuickBtn book"
              onClick={handleBookClick}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect width="20" height="15" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
              <span>Đặt vé</span>
            </button>
          )}

          <button
            type="button"
            className="cardQuickBtn detail"
            onClick={handleDetailClick}
          >
            <span>Chi tiết</span>
          </button>
        </div>
      </div>

      {/* Content Below Poster */}
      <div className="cardContent">
        <h4 className="cardTitle">{movie.title}</h4>
        <div className="cardMetaRow">
          <span className="cardGenre">
            {year} • {primaryGenre}
          </span>
          <span className="cardRating">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#fbbf24">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            {movie.rating ? movie.rating.toFixed(1) : '8.0'}
          </span>
        </div>
      </div>
    </article>
  );
}

