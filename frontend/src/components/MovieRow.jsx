import MovieCard from './MovieCard';
export default function MovieRow({title,movies,onMovie}){return <section className="section"><div className="sectionTitle"><h2>{title}</h2><span>View all →</span></div><div className="row">{movies.map((m,i)=><MovieCard key={m._id} movie={m} index={i} onClick={()=>onMovie(m)}/>)}</div></section>}
