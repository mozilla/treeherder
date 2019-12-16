import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Navbar } from 'reactstrap';

import LogoMenu from '../shared/LogoMenu';
import { getJobsUrl } from '../helpers/url';
import Login from '../shared/auth/Login';

import { resultColorMap } from './helpers';

export default class Navigation extends React.PureComponent {
  render() {
    const { user, setUser, result, notify, repo, revision } = this.props;
    const overallResult = result ? resultColorMap[result] : 'none';

    return (
      <Navbar dark color="dark">
        <LogoMenu menuText="Push Health" />
        <h4>
          <Badge color={overallResult}>
            <a
              href={getJobsUrl({ repo, revision })}
              className="text-white"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span title="repository">{repo}</span> -
              <span title="revision" className="ml-1">
                {revision}
              </span>
            </a>
          </Badge>
        </h4>
        <Login user={user} setUser={setUser} notify={notify} />
      </Navbar>
    );
  }
}

Navigation.propTypes = {
  user: PropTypes.object.isRequired,
  setUser: PropTypes.func.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  result: PropTypes.string,
};

Navigation.defaultProps = {
  result: '',
};
