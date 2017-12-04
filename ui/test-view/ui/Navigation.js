import React from 'react';
import { Nav, Navbar, Collapse } from 'reactstrap';
import logoUrl from '../../img/treeherder-logo.png';

export default class Navigation extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isOpen: false };
  }

  toggle() {
    this.setState({ isOpen: !this.state.isOpen });
  }

  render() {
    return (
      <Navbar expand fixed="top" className="th-top-navbar">
        <a id="th-logo" href="/">
          <img src={logoUrl} alt="Treeherder" />
        </a>
        <Collapse isOpen={this.state.isOpen} navbar>
          <Nav navbar className="mr-auto" />
        </Collapse>
      </Navbar>
    );
  }
}
