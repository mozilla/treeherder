import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import {
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';

import { getRepoUrl } from '../../helpers/location';

const GROUP_ORDER = [
  'development',
  'release-stabilization',
  'project repositories',
  'comm-repositories',
  'qa automation tests',
  'ci',
  'servo',
  'mobile',
  'other',
];

const DEV_GROUP_ORDER = {
  'mozilla-central': 1,
  'mozilla-inbound': 2,
  autoland: 3,
  try: 4,
};

export default function ReposMenu(props) {
  const { repos } = props;
  const groups = repos.reduce(
    (acc, repo, idx, arr, group = repo => repo.repository_group.name) => ({
      ...acc,
      [group(repo)]: [...(acc[group(repo)] || []), repo],
    }),
    {},
  );
  const groupedRepos = GROUP_ORDER.map(name => ({
    name,
    repos: groups[name]
      ? groups[name].sort((a, b) =>
          DEV_GROUP_ORDER[a.name] > DEV_GROUP_ORDER[b.name] ? 1 : -1,
        )
      : null,
  }));

  return (
    <UncontrolledDropdown>
      <DropdownToggle
        id="repoLabel"
        className="btn-view-nav nav-menu-btn"
        nav
        caret
        title="Watch a repo"
      >
        Repos
      </DropdownToggle>
      <DropdownMenu right id="repo-dropdown">
        <ul
          className="checkbox-dropdown-menu row"
          role="menu"
          aria-labelledby="repoLabel"
          aria-haspopup="true"
          aria-expanded="false"
        >
          {groupedRepos.map(group => (
            <DropdownItem
              className="repogroup dropdown-item col"
              key={group.name}
            >
              <li
                role="presentation"
                className="dropdown-header"
                title={group.name}
              >
                {group.name}{' '}
                <FontAwesomeIcon icon={faInfoCircle} title={group.name} />
              </li>
              {!!group.repos &&
                group.repos.map(repo => (
                  <li key={repo.name}>
                    <a
                      title="Open repo"
                      className="dropdown-link"
                      href={getRepoUrl(repo.name)}
                    >
                      {repo.name}
                    </a>
                  </li>
                ))}
            </DropdownItem>
          ))}
        </ul>
      </DropdownMenu>
    </UncontrolledDropdown>
  );
}

ReposMenu.propTypes = {
  repos: PropTypes.array.isRequired,
};
