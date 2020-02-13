import React from 'react';
import PropTypes from 'prop-types';
import {
  Collapse,
  Navbar,
  Nav,
  UncontrolledDropdown,
  DropdownToggle,
} from 'reactstrap';

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
    this.setState(prevState => ({ isOpen: !prevState.isOpen }));
  };

  render() {
    const { updateState, tree, user, setUser, notify } = this.props;
    return (
      <Navbar expand fixed="top" className="top-navbar">
        <LogoMenu
          menuText="Intermittent Failures View"
          colorClass="lightorange"
        />
        <Collapse isOpen={this.state.isOpen} navbar>
          <Nav navbar />
          <UncontrolledDropdown>
            <DropdownToggle className="btn-navbar navbar-link" nav caret>
              Tree
            </DropdownToggle>
            <DropdownMenuItems
              options={treeOptions}
              updateData={tree => updateState({ tree })}
              selectedItem={tree}
            />
          </UncontrolledDropdown>
        </Collapse>
        <Navbar className="ml-auto">
          <HelpMenu />
          <Login user={user} setUser={setUser} notify={notify} />
        </Navbar>
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

Navigation.defaultProps = {
  tree: null,
};
