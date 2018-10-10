import React from 'react';
import PropTypes from 'prop-types';
import { Collapse, Navbar, Nav, UncontrolledDropdown, DropdownToggle } from 'reactstrap';

import DropdownMenuItems from './DropdownMenuItems';
import { treeOptions } from './constants';

export default class Navigation extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isOpen: false };

    this.toggle = this.toggle.bind(this);
  }

  toggle() {
    this.setState({ isOpen: !this.state.isOpen });
  }

  render() {
    return (
      <Navbar expand fixed="top" className="top-navbar">
        <span className="lightorange">Intermittent Failures View </span>
        <Collapse isOpen={this.state.isOpen} navbar>
          <Nav navbar />
          <UncontrolledDropdown>
            <DropdownToggle className="btn-navbar navbar-link" nav caret>
              Tree
            </DropdownToggle>
            <DropdownMenuItems
              options={treeOptions}
              updateData={tree => this.props.updateState({ tree })}
              default={this.props.tree}
            />
          </UncontrolledDropdown>
        </Collapse>
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
};

Navigation.defaultProps = {
  tree: null,
};
