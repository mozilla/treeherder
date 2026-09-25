import { Link } from 'react-router';

import { chooseFullView } from './phone';

// The way back, and always one tap to the full view of the same thing.
const Nav = ({ back, backLabel, full }) => (
  <nav className="pv-nav">
    {back ? (
      <Link to={back} className="pv-back">
        {backLabel}
      </Link>
    ) : (
      <span />
    )}
    <a className="pv-full" href={full} onClick={chooseFullView}>
      Full view
    </a>
  </nav>
);

export default Nav;
