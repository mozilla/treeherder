import React from 'react';
import PropTypes from 'prop-types';

export default class ReposMenu extends React.Component {
  getRepoUrl(newRepoName) {
    const { history } = this.props;
    const location = history.location;
    const params = new URLSearchParams(location.hash.substring(location.hash.indexOf('?')));

    params.delete('selectedJob');
    params.set('repo', newRepoName);
    return `/#/jobs?${params.toString()}`;
  }

  render() {
    const { groupedRepos } = this.props;

    return (
      <span>
        <span className="dropdown">
          <button
            id="repoLabel"
            title="Watch a repo"
            data-toggle="dropdown"
            className="btn btn-view-nav nav-menu-btn dropdown-toggle"
          >Repos</button>
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
                  >{group.name} <span
                    className="fa fa-info-circle"
                  />
                  </li>
                  {group.repos.map(repo => (<li key={repo.name}>
                    <a
                      title="Open repo"
                      className="dropdown-link"
                      href={this.getRepoUrl(repo.name)}
                    >{repo.name}</a>
                  </li>))}
                </span>
              ))}
            </ul>
          </span>
        </span>
      </span>
    );
  }
}

ReposMenu.propTypes = {
  groupedRepos: PropTypes.array.isRequired,
  history: PropTypes.object.isRequired,
};
