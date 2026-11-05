import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/auth/login.css';
import '../../styles/auth/passwordRecovery.css';

// Reuse the Login/Register split, poster assets, typography and form classes.
// There is no shared auth layout in the existing application.
export default function PasswordRecoveryLayout({ title, description, hideFooter = false, children }) {
  const headingRef = useRef(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | CINEMA+`;
    headingRef.current?.focus();
    return () => { document.title = previousTitle; };
  }, [title]);

  return (
    <main className="cinemaSplitPage passwordRecoveryPage" aria-labelledby="recovery-heading">
      <div className="cinemaVisualSide" aria-hidden="true">
        <div className="cinemaBrandHeader">CINEMA<span>+</span></div>
        <div className="cinemaPosterWall">
          <div className="posterColumn col1">
            <img src="/images/posters/dune.jpg" alt="" />
            <img src="/images/posters/the_batman.jpg" alt="" />
            <img src="/images/posters/joker.jpg" alt="" loading="lazy" />
            <img src="/images/posters/venom.jpg" alt="" loading="lazy" />
          </div>
          <div className="posterColumn col2">
            <img src="/images/posters/stranger_things.jpg" alt="" />
            <img src="/images/posters/avatar_fire_and_ash.jpg" alt="" />
            <img src="/images/posters/all_of_us_are_dead.jpg" alt="" loading="lazy" />
            <img src="/images/posters/wednesday.jpg" alt="" loading="lazy" />
          </div>
          <div className="posterColumn col3">
            <img src="/images/posters/alice_in_borderland.jpg" alt="" />
            <img src="/images/posters/attack_on_titan.jpg" alt="" />
            <img src="/images/posters/harry_potter.jpg" alt="" loading="lazy" />
            <img src="/images/posters/the_maze_runner.jpg" alt="" loading="lazy" />
          </div>
        </div>
        <div className="cinemaVisualGradientOverlay" />
      </div>

      <div className="cinemaFormSide">
        <section className="cinemaFormCard">
          <header className="cinemaCardHeader">
            <Link to="/" className="cinemaCardLogo" aria-label="Trang chủ CINEMA+">CINEMA<span>+</span></Link>
            <h1 id="recovery-heading" className="cinemaCardHeading" ref={headingRef} tabIndex={-1}>{title}</h1>
            <p className="recoveryDescription">{description}</p>
          </header>
          {children}
          {!hideFooter && (
            <div className="cinemaCardFooter recoveryFooter">
              <Link to="/login" className="forgotPasswordLink recoveryBackLink">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m12 19-7-7 7-7M5 12h14" />
                </svg>
                Quay lại đăng nhập
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
