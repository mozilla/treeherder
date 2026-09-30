import { Link } from 'react-router';

import logo from '../img/treeherder-logo.png';

import { pushUrl } from './helpers';
import { chooseFullView } from './phone';

// Drawn, not typed: the Unicode sun becomes a colour emoji on iOS.
const Moon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const Sun = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" />
  </svg>
);

// A theme switch, and only that: the knob carries the sun or the moon, so it
// can't be mistaken for the Full view button beside it.
const ThemeSwitch = ({ theme }) => {
  const dark = theme.theme === 'dark';
  return (
    <button
      type="button"
      className="pv-theme"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Dark mode on' : 'Dark mode off'}
      onClick={theme.toggle}
    >
      <span className="pv-theme-track">
        <span className="pv-theme-thumb">{dark ? <Moon /> : <Sun />}</span>
      </span>
    </button>
  );
};

// Treeherder's bars, as the full view has them: the logo bar, the repo bar,
// and the strip saying what's shown. Always one tap to the full view of the
// same thing.
const Nav = ({ repo, author, theme, back, backLabel, full, filter }) => (
  <header className="pv-bars">
    <div className="pv-topbar">
      <Link to={pushUrl({ repo, author })} aria-label="Your pushes">
        <img className="pv-logo" src={logo} alt="Treeherder" />
      </Link>
      <span className="pv-topbar-end">
        <ThemeSwitch theme={theme} />
        <span className="pv-topbar-divider" aria-hidden="true" />
        <a className="pv-full" href={full} onClick={chooseFullView}>
          Full view <span aria-hidden="true">↗</span>
        </a>
      </span>
    </div>
    {back && (
      <div className="pv-contextbar">
        <Link to={back} className="pv-back">
          {backLabel}
        </Link>
        <span className="pv-repo">{repo}</span>
      </div>
    )}
    {filter && <div className="pv-infobar">{filter}</div>}
  </header>
);

export default Nav;
