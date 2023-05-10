import React from 'react';
import {
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';

import { prodFirefoxRootUrl } from '../../taskcluster-auth-callback/constants';

const InfraMenu = () => (
  <UncontrolledDropdown>
    <DropdownToggle
      className="btn-view-nav nav-menu-btn"
      title="Infrastructure status"
      caret
    >
      Infra
    </DropdownToggle>
    <DropdownMenu right>
      <DropdownItem
        href={`${prodFirefoxRootUrl}/provisioners`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Taskcluster Workers
      </DropdownItem>
      <DropdownItem
        href="https://treestatus.mozilla-releng.net"
        target="_blank"
        rel="noopener noreferrer"
      >
        TreeStatus
      </DropdownItem>
    </DropdownMenu>
  </UncontrolledDropdown>
);

export default InfraMenu;
