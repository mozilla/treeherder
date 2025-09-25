import React from 'react';
import PropTypes from 'prop-types';
import { Navbar, Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import LogoMenu from '../shared/LogoMenu';
import Login from '../shared/auth/Login';
import HelpMenu from '../shared/HelpMenu';

const Navigation = ({ user, setUser, notify }) => (
  <Navbar expand sticky="top" className="top-navbar">
    <LogoMenu menuText="Push Health" />
    <Nav className="navbar navbar-inverse">
      <Nav.Item>
        <Link to="/push-health" className="menu-items nav-link btn-view-nav">
          My Pushes
        </Link>
      </Nav.Item>
    </Nav>
    <Navbar className="ml-auto">
      <HelpMenu />
      <Login user={user} setUser={setUser} notify={notify} />
    </Navbar>
  </Navbar>
);

Navigation.propTypes = {
  user: PropTypes.shape({}).isRequired,
  setUser: PropTypes.func.isRequired,
};

export default Navigation;
