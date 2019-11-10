import React from 'react';

export default function InfraMenu() {
  return (
    <span className="dropdown">
      <button
        id="infraLabel"
        type="button"
        title="Infrastructure status"
        data-toggle="dropdown"
        className="btn btn-view-nav nav-menu-btn dropdown-toggle"
      >
        Infra
      </button>
      <ul
        id="infra-dropdown"
        className="dropdown-menu nav-dropdown-menu-right container"
        role="menu"
        aria-labelledby="infraLabel"
      >
        <li>
          <a
            className="dropdown-item"
            href="https://wiki.mozilla.org/CIDuty"
            target="_blank"
            rel="noopener noreferrer"
          >
            CI Duty
          </a>
        </li>
        <li>
          <a
            className="dropdown-item"
            href="https://firefox-ci-tc.services.mozilla.com/provisioners"
            target="_blank"
            rel="noopener noreferrer"
          >
            Taskcluster Workers
          </a>
        </li>
        <li>
          <a
            className="dropdown-item"
            href="https://mozilla-releng.net/treestatus"
            target="_blank"
            rel="noopener noreferrer"
          >
            TreeStatus
          </a>
        </li>
      </ul>
    </span>
  );
}
