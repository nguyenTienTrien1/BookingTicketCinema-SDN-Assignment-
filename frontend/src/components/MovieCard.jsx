import React from 'react';

import alice from '../assets/posters/alice_in_borderland.jpg';
import usDead from '../assets/posters/all_of_us_are_dead.jpg';
import attack from '../assets/posters/attack_on_titan.jpg';
import avatar from '../assets/posters/avatar_fire_and_ash.jpg';
import dune from '../assets/posters/dune.jpg';
import fourHands from '../assets/posters/four_hands.jpg';
import harry from '../assets/posters/harry_potter.jpg';
import wishes from '../assets/posters/if_wishes_could_kill.jpg';
import joker from '../assets/posters/joker.jpg';
import stranger from '../assets/posters/stranger_things.jpg';
import batman from '../assets/posters/the_batman.jpg';
import narnia from '../assets/posters/the_chronicles_of_narnia.jpg';
import flood from '../assets/posters/the_great_flood.jpg';
import kitchen from '../assets/posters/the_legend_of_kitchen_soldier.jpg';
import maze from '../assets/posters/the_maze_runner.jpg';
import venom from '../assets/posters/venom.jpg';
import wednesday from '../assets/posters/wednesday.jpg';
import { translateGenre } from '../utils/uiText';

const posters = {
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

export function getMoviePoster(movie) {
    const normalizedTitle = String(movie.title || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    return movie.poster?.startsWith('http') ? movie.poster : posters[normalizedTitle] || movie.poster || '';
}

export default function MovieCard({ movie, onClick, onDetail }) {
    const poster = getMoviePoster(movie);
    const genreText = [
        ...(movie.genre?.slice(0, 2).map(translateGenre) || []),
        ...(movie.duration ? [`${movie.duration} phút`] : [])
    ].join(' · ');

    return (
        <article className="card">
            <img
                src={poster}
                alt={movie.title}
                loading="lazy"
                onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/images/posters/rampage.jpg';
                }}
            />

            <div className="cardInfo">
                <b title={movie.title}>{movie.title}</b>

                <span title={genreText}>{genreText}</span>

                <small>★ {movie.rating || '—'}</small>
                <div className="movieCardActions">
                    <button type="button" className="movieCardDetail" onClick={onDetail}>
                        Chi tiết phim
                    </button>
                    <button type="button" className="movieCardBook" onClick={onClick}>
                        Đặt vé
                    </button>
                </div>
            </div>
        </article>
    );
}
