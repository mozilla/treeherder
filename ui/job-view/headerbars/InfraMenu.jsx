import React from 'react';
import {
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';

const InfraMenu = () => (
  <UncontrolledDropdown>
    <DropdownToggle
      className="btn-view-nav nav-menu-btn"
      title="Infrastructure status"
      nav
      caret
    >
      Infra
    </DropdownToggle>
    <DropdownMenu right>
      <DropdownItem
        tag="a"
        href="https://wiki.mozilla.org/CIDuty"
        target="_blank"
        rel="noopener noreferrer"
      >
        CI Duty
      </DropdownItem>
      <DropdownItem
        href="https://firefox-ci-tc.services.mozilla.com/provisioners"
        target="_blank"
        rel="noopener noreferrer"
      >
        Taskcluster Workers
      </DropdownItem>
      <DropdownItem
        href="https://mozilla-releng.net/treestatus"
        target="_blank"
        rel="noopener noreferrer"
      >
        TreeStatus
      </DropdownItem>
    </DropdownMenu>
  </UncontrolledDropdown>
);

export default InfraMenu;
