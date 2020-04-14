import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Navbar, Nav } from 'reactstrap';

import LogoMenu from '../shared/LogoMenu';
import { getJobsUrl } from '../helpers/url';
import Login from '../shared/auth/Login';

import { resultColorMap } from './helpers';

export default class Navigation extends React.PureComponent {
  render() {
    const {
      user,
      setUser,
      result,
      notify,
      repo,
      revision,
      children,
    } = this.props;
    const overallResult = result ? resultColorMap[result] : 'none';

    return (
      <React.Fragment>
        <Navbar dark color="dark" sticky="top" className="flex-column">
          <Nav className="w-100 justify-content-between">
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
          </Nav>
          {children}
        </Navbar>
      </React.Fragment>
    );
  }
}

Navigation.propTypes = {
  user: PropTypes.shape({}).isRequired,
  setUser: PropTypes.func.isRequired,
  repo: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  result: PropTypes.string,
  children: PropTypes.element,
};

Navigation.defaultProps = {
  result: '',
  children: null,
};
