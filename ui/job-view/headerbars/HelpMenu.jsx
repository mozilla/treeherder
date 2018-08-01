import React from 'react';

const menuItems = [
  {
    href: '/userguide.html',
    icon: 'fa-question-circle',
    text: 'User Guide',
  },
  {
    href: 'https://treeherder.readthedocs.io/',
    icon: 'fa-file-code-o',
    text: 'Development Documentation',
  },
  {
    href: '/docs/',
    icon: 'fa-code',
    text: 'API Reference',
  },
  {
    href: 'https://wiki.mozilla.org/EngineeringProductivity/Projects/Treeherder',
    icon: 'fa-file-word-o',
    text: 'Project Wiki',
  },
  {
    href: 'https://groups.google.com/forum/#!forum/mozilla.tools.treeherder',
    icon: 'fa-envelope-o',
    text: 'Mailing List',
  },
  {
    href: 'https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree+Management&component=Treeherder',
    icon: 'fa-bug',
    text: 'Report a Bug',
  },
  {
    href: 'https://github.com/mozilla/treeherder',
    icon: 'fa-github',
    text: 'Source',
  },
  {
    href: 'https://whatsdeployed.io/?owner=mozilla&amp;repo=treeherder&amp;name[]=Stage&amp;url[]=https://treeherder.allizom.org/revision.txt&amp;name[]=Prod&amp;url[]=https://treeherder.mozilla.org/revision.txt',
    icon: 'fa-question',
    text: 'What\'s Deployed?',
  },
];

export default function HelpMenu() {
  return (
    <span id="help-menu" className="dropdown">
      <button
        id="helpLabel"
        title="Treeherder help"
        aria-label="Treeherder help"
        data-toggle="dropdown"
        className="btn btn-view-nav nav-help-btn dropdown-toggle"
      >
        <span className="fa fa-question-circle lightgray nav-help-icon" />
      </button>
      <ul
        className="dropdown-menu nav-dropdown-menu-right icon-menu"
        role="menu"
        aria-labelledby="helpLabel"
      >
        {menuItems.map(item => (<li key={item.text}>
          <a href={item.href} target="_blank" rel="noopener noreferrer" className="dropdown-item">
            <span className={`fa ${item.icon} midgray`} />{item.text}
          </a>
        </li>))}
      </ul>
    </span>
  );
}
