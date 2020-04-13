import React from 'react';
import PropTypes from 'prop-types';
import { Navbar, Nav, NavItem, NavLink } from 'reactstrap';

import LogoMenu from '../shared/LogoMenu';
import Login from '../shared/auth/Login';
import HelpMenu from '../shared/HelpMenu';

const Navigation = ({ user, setUser, notify }) => (
  <Navbar expand fixed="top" className="top-navbar">
    <LogoMenu menuText="Perfherder" colorClass="text-info" />
    <Nav className="navbar navbar-inverse">
      <NavItem>
        <NavLink href="#/graphs" className="btn-view-nav">
          Graphs
        </NavLink>
      </NavItem>
      <NavItem>
        <NavLink href="#/comparechooser" className="btn-view-nav">
          Compare
        </NavLink>
      </NavItem>
      <NavItem>
        <NavLink href="#/alerts?hideDwnToInv=1" className="btn-view-nav">
          Alerts
        </NavLink>
      </NavItem>
      <NavItem>
        <NavLink href="#/tests" className="btn-view-nav">
          Tests
        </NavLink>
      </NavItem>
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
  notify: PropTypes.func.isRequired,
};

export default Navigation;
