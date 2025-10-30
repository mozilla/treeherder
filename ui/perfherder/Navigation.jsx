import React from 'react';
import PropTypes from 'prop-types';
import { Navbar, Nav, NavItem } from 'reactstrap';
import { Link } from 'react-router-dom';

import LogoMenu from '../shared/LogoMenu';
import Login from '../shared/auth/Login';
import HelpMenu from '../shared/HelpMenu';

const Navigation = ({ user, setUser, notify }) => (
  <Navbar expand fixed="top" className="top-navbar">
    <LogoMenu menuText="Perfherder" colorClass="text-info" />
    <Nav className="navbar navbar-inverse">
      <NavItem>
        <Link to="./graphs" className="nav-link btn-view-nav">
          Graphs
        </Link>
      </NavItem>
      <NavItem>
        <a
          href="https://perf.compare"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link btn-view-nav"
        >
          Compare
        </a>
      </NavItem>
      <NavItem>
        <Link
          to="./alerts?hideDwnToInv=1&page=1"
          className="nav-link btn-view-nav"
        >
          Alerts
        </Link>
      </NavItem>
      <NavItem>
        <Link
          to="./alerts?monitoredAlerts=1&page=1"
          className="nav-link btn-view-nav"
        >
          Monitoring
        </Link>
      </NavItem>
      <NavItem>
        <Link to="./tests" className="nav-link btn-view-nav">
          Tests
        </Link>
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
