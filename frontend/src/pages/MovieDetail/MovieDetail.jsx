import { useMemo } from 'react';

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
import { translateGenre } from '../../utils/uiText';

const posterMap = {
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
  'avatar fire and ash': avatar
};

function getPoster(movie) {
  if (!movie) return '';
  if (typeof movie.poster === 'string' && movie.poster.startsWith('http')) return movie.poster;

  const title = String(movie.title || '').trim().toLowerCase();
  const normalized = title.replace(/[^a-z0-9\s]/g, '').trim();
  return posterMap[title] || posterMap[normalized] || movie.poster || '';
}

export default function MovieDetail({ selected, movies, showtimes, setSelected, setTab }) {
  const movie = selected && selected.title ? selected : movies.find((item) => item._id === selected?._id) || null;

  const list = useMemo(() => {
    if (!movie) return [];

    return showtimes.filter((showtime) => {
      const movieId = showtime.movie?._id || showtime.movie;
      return String(movieId) === String(movie._id);
    });
  }, [movie, showtimes]);

  const grouped = useMemo(() => {
    return list.reduce((acc, showtime) => {
      const key = showtime.cinema || 'Rạp mặc định';
      if (!acc[key]) acc[key] = [];
      acc[key].push(showtime);
      return acc;
    }, {});
  }, [list]);

  if (!movie) {
    return (
      <section className="page movieDetailPage">
        <h2>Không có phim để xem</h2>
        <button className="primary" type="button" onClick={() => setTab('booking')}>
          Quay lại đặt vé
        </button>
      </section>
    );
  }

  return (
    <section className="page movieDetailPage">
      <button className="movieDetailBack" type="button" onClick={() => setTab('movies')}>
        ← Quay lại danh sách phim
      </button>
      <div className="movieDetailWrap">
        <img src={getPoster(movie)} alt={movie.title} className="movieDetailPoster" />

        <div className="movieDetailInfo">
          <p className="bookingEyebrow">THÔNG TIN PHIM</p>
          <div className="movieDetailHeader">
            <h2>{movie.title}</h2>
            <button className="primary" type="button" onClick={() => { setSelected(movie); setTab('booking'); }}>
              Đặt vé
            </button>
          </div>

          <div className="movieMetaRow">
            <span>{movie.ageLimit || 18}+</span>
            <span>{movie.genre?.map(translateGenre).join(' | ') || 'Phim'}</span>
            <span>{movie.duration || 120} phút</span>
          </div>

          <p className="movieDescription">{movie.description || 'Không có mô tả.'}</p>

          <div className="movieFacts">
            <div>
              <strong>Đánh giá:</strong> {movie.rating || '—'}
            </div>
            <div>
              <strong>Khởi chiếu:</strong> {movie.releaseDate ? new Date(movie.releaseDate).toLocaleDateString('vi-VN') : '—'}
            </div>
            <div>
              <strong>Thời lượng:</strong> {movie.duration || 120} phút
            </div>
            <div>
              <strong>Phân loại:</strong> {movie.ageLimit || 18}+
            </div>
          </div>
        </div>
      </div>

      <div className="movieScheduleSection">
        <h3>Suất chiếu</h3>

        {Object.keys(grouped).length === 0 ? (
          <p>Hiện chưa có suất chiếu cho phim này.</p>
        ) : (
          <div className="cinemaScheduleList">
            {Object.entries(grouped).map(([cinemaName, items]) => (
              <div key={cinemaName} className="cinemaScheduleCard">
                <h4>{cinemaName}</h4>
                <div className="showtimeGrid">
                  {items.map((showtime) => (
                    <button
                      key={showtime._id}
                      type="button"
                      className="showtimeBtn"
                      onClick={() => {
                        setSelected(showtime);
                        setTab('booking');
                      }}
                    >
                      <span>{new Date(showtime.startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <small>{showtime.room || 'Phòng chiếu'} • {showtime.price?.toLocaleString()}₫</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
