import { Link } from 'react-router';

import logo from '../img/treeherder-logo.png';

import { pushUrl } from './helpers';
import { chooseFullView } from './phone';

const ThemeSwitch = ({ theme }) => {
  const dark = theme.theme === 'dark';
  return (
    <button
      type="button"
      className="pv-theme"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={theme.toggle}
    >
      <span className="pv-theme-track">
        <span className="pv-theme-thumb" />
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
        <a className="pv-full" href={full} onClick={chooseFullView}>
          Full view
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
