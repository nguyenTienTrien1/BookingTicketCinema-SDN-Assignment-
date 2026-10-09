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

const posters = [
    wishes,
    fourHands,
    kitchen,
    flood,
    alice,
    usDead,
    stranger,
    wednesday,
    narnia,
    maze,
    venom,
    dune,
    joker,
    batman,
    attack,
    harry,
    avatar
];

export default function MovieCard({ movie, index = 0, onClick }) {
    const poster = posters[index % posters.length];

    return (
        <article className="card" onClick={onClick}>
            <img src={poster} alt={movie.title} />

            <div className="cardInfo">
                <b>{movie.title}</b>

                <span>
                    {movie.genre?.slice(0, 2).join(' · ')} · {movie.duration}m
                </span>

                <small>★ {movie.rating || '—'}</small>
            </div>
        </article>
    );
}