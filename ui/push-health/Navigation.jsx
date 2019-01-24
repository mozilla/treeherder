import React from 'react';
import PropTypes from 'prop-types';
import { Navbar } from 'reactstrap';

import LogoMenu from '../shared/LogoMenu';
import Login from '../shared/auth/Login';

export default class Navigation extends React.PureComponent {
  render() {
    const { user, setUser } = this.props;

    return (
      <Navbar dark color="dark">
        <LogoMenu menuText="Push Health" />
        <Login user={user} setUser={setUser} />
      </Navbar>
    );
  }
}

Navigation.propTypes = {
  user: PropTypes.object.isRequired,
  setUser: PropTypes.func.isRequired,
};
