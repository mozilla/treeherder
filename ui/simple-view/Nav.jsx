import { Link } from 'react-router';

import logo from '../img/treeherder-logo.png';

import { pushUrl } from './helpers';
import { chooseFullView } from './phone';
import { NAV } from './constants';

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

const ThemeSwitch = ({ theme }) => {
  const dark = theme.theme === 'dark';
  return (
    <button
      type="button"
      className="sv-theme"
      role="switch"
      aria-checked={dark}
      aria-label={NAV.darkMode}
      title={NAV.darkModeState(dark)}
      onClick={theme.toggle}
    >
      <span className="sv-theme-track">
        <span className="sv-theme-thumb">{dark ? <Moon /> : <Sun />}</span>
      </span>
    </button>
  );
};

const Nav = ({ repo, author, theme, back, backLabel, full, filter }) => (
  <header className="sv-bars">
    <div className="sv-topbar">
      <span className="sv-topbar-start">
        <Link to={pushUrl({ repo, author })} aria-label={NAV.home}>
          <img className="sv-logo" src={logo} alt={NAV.logoAlt} />
        </Link>
        <span className="sv-beta">{NAV.beta}</span>
      </span>
      <span className="sv-topbar-end">
        <ThemeSwitch theme={theme} />
        <span className="sv-topbar-divider" aria-hidden="true" />
        <a className="sv-full" href={full} onClick={chooseFullView}>
          {NAV.fullView} <span aria-hidden="true">↗</span>
        </a>
      </span>
    </div>
    {back && (
      <div className="sv-contextbar">
        <Link to={back} className="sv-back">
          {backLabel}
        </Link>
        <span className="sv-repo">{repo}</span>
      </div>
    )}
    {filter && <div className="sv-infobar">{filter}</div>}
  </header>
);

export default Nav;
