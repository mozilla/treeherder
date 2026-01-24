
import PropTypes from 'prop-types';
import { Navbar, Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import LogoMenu from '../shared/LogoMenu';
import Login from '../shared/auth/Login';
import HelpMenu from '../shared/HelpMenu';

const Navigation = ({ user, setUser, notify }) => (
  <Navbar
    expand
    sticky="top"
    className="top-navbar d-flex justify-content-between"
    style={{
      width: '100%',
      maxWidth: '100vw',
      paddingLeft: '0.5rem',
      paddingRight: '0.5rem',
    }}
  >
    <div
      className="d-flex align-items-center gap-2"
      style={{ flex: '1 1 auto', minWidth: 0 }}
    >
      <LogoMenu menuText="Push Health" />
      <Nav className="navbar navbar-inverse">
        <Nav.Item>
          <Link to="/push-health" className="menu-items nav-link btn-view-nav">
            My Pushes
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
};

export default Navigation;
