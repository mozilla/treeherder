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
import {
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';

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
    href: 'https://whatsdeployed.io/s-dqv',
    icon: faQuestion,
    text: "What's Deployed?",
  },
];

const HelpMenu = () => (
  <UncontrolledDropdown>
    <DropdownToggle className="btn-view-nav nav-menu-btn" nav caret>
      <FontAwesomeIcon
        icon={faQuestionCircle}
        className="lightgray mr-1"
        title="Treeherder help"
      />
    </DropdownToggle>
    <DropdownMenu right className="icon-menu">
      {menuItems.map(item => (
        <DropdownItem
          tag="a"
          target="_blank"
          rel="noopener noreferrer"
          href={item.href}
          key={item.text}
        >
          <FontAwesomeIcon
            icon={item.icon}
            fixedWidth
            className="midgray mr-2"
          />
          {item.text}
        </DropdownItem>
      ))}
    </DropdownMenu>
  </UncontrolledDropdown>
);

export default HelpMenu;
