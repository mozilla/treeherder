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
  faCalculator,
  faCode,
  faQuestion,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';
import { Dropdown } from 'react-bootstrap';

const menuItems = [
  {
    href: '/userguide',
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
    href: '/push-health/usage',
    icon: faCalculator,
    text: 'Push Health Try Usage',
  },
  {
    href: 'https://whatsdeployed.io/s/BIY/Mozilla/Treeherder',
    icon: faQuestion,
    text: "What's Deployed?",
  },
];

const HelpMenu = () => (
  <Dropdown>
    <Dropdown.Toggle className="btn-view-nav nav-menu-btn">
      Help
    </Dropdown.Toggle>
    <Dropdown.Menu align="end" className="icon-menu">
      {menuItems.map((item) => (
        <Dropdown.Item
          as="a"
          target="_blank"
          rel="noopener noreferrer"
          href={item.href}
          key={item.text}
        >
          <FontAwesomeIcon
            icon={item.icon}
            fixedWidth
            className="midgray me-2"
          />
          {item.text}
        </Dropdown.Item>
      ))}
    </Dropdown.Menu>
  </Dropdown>
);

export default HelpMenu;
