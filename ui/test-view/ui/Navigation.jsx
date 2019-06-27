import React from 'react';
import { Nav, Navbar, Collapse } from 'reactstrap';

import logoUrl from '../../img/treeherder-logo.png';

export default class Navigation extends React.Component {
  constructor(props) {
    super(props);
    this.state = { isOpen: false };
  }

  toggle() {
    this.setState(prevState => ({ isOpen: !prevState.isOpen }));
  }

  render() {
    const { isOpen } = this.state;
    return (
      <Navbar expand fixed="top" className="th-top-navbar">
        <a id="th-logo" href="/">
          <img src={logoUrl} alt="Treeherder" />
        </a>
        <Collapse isOpen={isOpen} navbar>
          <Nav navbar className="mr-auto" />
        </Collapse>
      </Navbar>
    );
  }
}
