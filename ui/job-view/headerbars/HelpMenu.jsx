import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub } from '@fortawesome/free-brands-svg-icons';
import {
  faEnvelope,
  faFileCode,
  faFileWord,
} from '@fortawesome/free-regular-svg-icons';
import {
  faBug,
  faCode,
  faQuestion,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';

const menuItems = [
  {
    href: '/userguide.html',
    icon: faQuestionCircle,
    text: 'User Guide',
  },
  {
    href: 'https://treeherder.readthedocs.io/',
    icon: faFileCode,
    text: 'Development Documentation',
  },
  {
    href: '/docs/',
    icon: faCode,
    text: 'API Reference',
  },
  {
    href:
      'https://wiki.mozilla.org/EngineeringProductivity/Projects/Treeherder',
    icon: faFileWord,
    text: 'Project Wiki',
  },
  {
    href: 'https://groups.google.com/forum/#!forum/mozilla.tools.treeherder',
    icon: faEnvelope,
    text: 'Mailing List',
  },
  {
    href:
      'https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&component=Treeherder',
    icon: faBug,
    text: 'Report a Bug',
  },
  {
    href: 'https://github.com/mozilla/treeherder',
    icon: faGithub,
    text: 'Source',
  },
  {
    href:
      'https://whatsdeployed.io/?owner=mozilla&repo=treeherder&name[]=Stage&url[]=https://treeherder.allizom.org/revision.txt&name[]=Prod&url[]=https://treeherder.mozilla.org/revision.txt',
    icon: faQuestion,
    text: "What's Deployed?",
  },
];

export default function HelpMenu() {
  return (
    <span id="help-menu" className="dropdown">
      <button
        id="helpLabel"
        type="button"
        title="Treeherder help"
        aria-label="Treeherder help"
        data-toggle="dropdown"
        className="btn btn-view-nav nav-help-btn dropdown-toggle"
      >
        <FontAwesomeIcon icon={faQuestionCircle} className="lightgray mr-1" />
      </button>
      <ul
        className="dropdown-menu nav-dropdown-menu-right icon-menu"
        role="menu"
        aria-labelledby="helpLabel"
      >
        {menuItems.map(item => (
          <li key={item.text}>
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="dropdown-item"
            >
              <FontAwesomeIcon
                icon={item.icon}
                fixedWidth
                className="midgray mr-2"
              />
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </span>
  );
}
