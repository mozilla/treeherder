import React from 'react';

import Logo from '../../img/treeherder-logo.png';

export default function LogoMenu() {
  return (
    <span className="dropdown">
      <button
        id="th-logo"
        title="Treeherder services"
        data-toggle="dropdown"
        className="btn btn-view-nav dropdown-toggle"
      >
        <img src={Logo} alt="Treeherder" />
      </button>
      <ul className="dropdown-menu" role="menu" aria-labelledby="th-logo">
        <li><a href="/perf.html" className="dropdown-item">Perfherder</a></li>
        <li><a href="/intermittent-failures.html" className="dropdown-item">Intermittent Failures</a></li>
      </ul>
    </span>
  );
}
