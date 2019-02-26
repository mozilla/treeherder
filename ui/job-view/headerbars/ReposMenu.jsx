import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

import { getRepoUrl } from '../../helpers/location';

const GROUP_ORDER = [
  'development',
  'release-stabilization',
  'project repositories',
  'comm-repositories',
  'qa automation tests',
  'ci',
  'servo',
  'other',
];

export default function ReposMenu(props) {
  const { repos } = props;
  const groups = repos.reduce(
    (acc, repo, idx, arr, group = repo => repo.repository_group.name) => ({
      ...acc,
      [group(repo)]: [...(acc[group(repo)] || []), repo],
    }),
    {},
  );
  const groupedRepos = GROUP_ORDER.map(name => ({ name, repos: groups[name] }));

  return (
    <span>
      <span className="dropdown">
        <button
          id="repoLabel"
          type="button"
          title="Watch a repo"
          data-toggle="dropdown"
          className="btn btn-view-nav nav-menu-btn dropdown-toggle"
        >
          Repos
        </button>
        <span
          id="repo-dropdown"
          className="dropdown-menu nav-dropdown-menu-right container"
        >
          <ul
            className="checkbox-dropdown-menu row"
            role="menu"
            aria-labelledby="repoLabel"
            aria-haspopup="true"
            aria-expanded="false"
          >
            {groupedRepos.map(group => (
              <span className="repogroup dropdown-item col" key={group.name}>
                <li
                  role="presentation"
                  className="dropdown-header"
                  title={group.name}
                >
                  {group.name} <FontAwesomeIcon icon={faInfoCircle} />
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
              </span>
            ))}
          </ul>
        </span>
      </span>
    </span>
  );
}

ReposMenu.propTypes = {
  repos: PropTypes.array.isRequired,
};
