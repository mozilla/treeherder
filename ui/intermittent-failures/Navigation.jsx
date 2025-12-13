import React from 'react';
import PropTypes from 'prop-types';
import { Navbar, Nav, Dropdown } from 'react-bootstrap';

import LogoMenu from '../shared/LogoMenu';
import Login from '../shared/auth/Login';
import HelpMenu from '../shared/HelpMenu';
import DropdownMenuItems from '../shared/DropdownMenuItems';

import { treeOptions } from './constants';

export default class Navigation extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isOpen: false };
  }

  toggle = () => {
    this.setState((prevState) => ({ isOpen: !prevState.isOpen }));
  };

  render() {
    const { updateState, tree = null, user, setUser, notify } = this.props;
    return (
      <Navbar
        expand={false}
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
          className="d-flex align-items-center gap-2"
          style={{ flex: '1 1 auto', minWidth: 0 }}
        >
          <LogoMenu
            menuText="Intermittent Failures View"
            colorClass="lightorange"
          />
          <Dropdown>
            <Dropdown.Toggle className="btn-navbar navbar-link" variant="dark">
              Tree
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <DropdownMenuItems
                options={treeOptions}
                updateData={(tree) => updateState({ tree })}
                selectedItem={tree}
              />
            </Dropdown.Menu>
          </Dropdown>
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
  }
}

Nav.propTypes = {
  caret: PropTypes.bool,
};

Navigation.propTypes = {
  tree: PropTypes.string,
  updateState: PropTypes.func.isRequired,
  user: PropTypes.shape({}).isRequired,
  setUser: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};
