
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import { updateRepoParams } from '../../helpers/location';

const GROUP_ORDER = [
  'development',
  'release-stabilization',
  'project repositories',
  'comm-repositories',
  'ci',
  'servo',
  'mobile',
  'other',
];

const DEV_GROUP_ORDER = {
  'mozilla-central': 1,
  autoland: 3,
  try: 4,
};

export default function ReposMenu(props) {
  const { repos } = props;
  const groups = repos.reduce(
    (acc, repo, _idx, _arr, group = (repo) => repo.repository_group.name) => ({
      ...acc,
      [group(repo)]: [...(acc[group(repo)] || []), repo],
    }),
    {},
  );
  const groupedRepos = GROUP_ORDER.map((name) => ({
    name,
    repos: groups[name]
      ? groups[name].sort((a, b) =>
          DEV_GROUP_ORDER[a.name] > DEV_GROUP_ORDER[b.name] ? 1 : -1,
        )
      : null,
  }));

  return (
    <Dropdown
      aria-controls="repo-dropdown"
      aria-expanded="false"
      aria-haspopup="menu"
    >
      <Dropdown.Toggle
        id="repoLabel"
        className="btn-view-nav nav-menu-btn"
        title="Watch a repo"
      >
        Repos
      </Dropdown.Toggle>
      <Dropdown.Menu align="end" id="repo-dropdown">
        <ul
          className="checkbox-dropdown-menu row"
          aria-labelledby="repoLabel"
        >
          {groupedRepos.map((group) => (
            <Dropdown.Item
              as="div"
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
                group.repos.map((repo) => (
                  <li key={repo.name}>
                    <Link
                      className="dropdown-link"
                      to={{ search: updateRepoParams(repo.name) }}
                    >
                      {repo.name}
                    </Link>
                  </li>
                ))}
            </Dropdown.Item>
          ))}
        </ul>
      </Dropdown.Menu>
    </Dropdown>
  );
}

ReposMenu.propTypes = {
  repos: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};
