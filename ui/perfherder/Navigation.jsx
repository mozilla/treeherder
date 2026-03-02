
import PropTypes from 'prop-types';
import { Navbar, Nav } from 'react-bootstrap';
import { Link } from 'react-router';

import LogoMenu from '../shared/LogoMenu';
import Login from '../shared/auth/Login';
import HelpMenu from '../shared/HelpMenu';

const Navigation = ({ user, setUser, notify }) => (
  <Navbar
    expand
    fixed="top"
    className="top-navbar d-flex justify-content-between"
    style={{
      width: '100%',
      maxWidth: '100vw',
      paddingLeft: '0.5rem',
      paddingRight: '0.5rem',
    }}
  >
    <div
      className="d-flex align-items-center"
      style={{ flex: '1 1 auto', minWidth: 0 }}
    >
      <LogoMenu menuText="Perfherder" colorClass="text-info" />
      <Nav className="navbar navbar-inverse">
        <Nav.Item>
          <Link to="/perfherder/graphs" className="nav-link btn-view-nav">
            Graphs
          </Link>
        </Nav.Item>
        <Nav.Item>
          <a
            href="https://perf.compare"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-link btn-view-nav"
          >
            Compare
          </a>
        </Nav.Item>
        <Nav.Item>
          <Link
            to="/perfherder/alerts?hideDwnToInv=1&page=1"
            className="nav-link btn-view-nav"
          >
            Alerts
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link
            to="/perfherder/alerts?monitoredAlerts=1&page=1"
            className="nav-link btn-view-nav"
          >
            Monitoring
          </Link>
        </Nav.Item>
        <Nav.Item>
          <Link to="/perfherder/tests" className="nav-link btn-view-nav">
            Tests
          </Link>
        </Nav.Item>
      </Nav>
    </div>

    <div
      className="d-flex align-items-center gap-2"
      style={{ flex: '0 0 auto' }}
    >
      <HelpMenu />
      <Login user={user} setUser={setUser} notify={notify} />
    </div>
  </Navbar>
);

Navigation.propTypes = {
  user: PropTypes.shape({}).isRequired,
  setUser: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};

export default Navigation;
