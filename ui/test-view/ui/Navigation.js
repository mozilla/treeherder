import React from 'react';
import { Badge, Nav, Navbar, NavbarToggler, NavbarBrand, Collapse } from 'reactstrap';
import logoUrl from '../img/logo.png';

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
      <Navbar toggleable fixed="top" light style={{ borderBottom: '1px solid #ddd', backgroundColor: '#fff' }}>
        <NavbarToggler right onClick={() => this.toggle()} />
        <NavbarBrand href="/">
          <img src={logoUrl} className="img-fluid" style={{ maxHeight: 26, verticalAlign: 'baseline' }} />
          <Badge size="sm" color="info" style={{ marginLeft: '1rem', verticalAlign: 'top', marginTop: '.25rem' }}>
            experimental
          </Badge>
        </NavbarBrand>
        <Collapse isOpen={this.state.isOpen} navbar>
          <Nav navbar className="mr-auto" />
        </Collapse>
      </Navbar>
    );
  }
}
