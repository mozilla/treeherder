import React from 'react';
import { Dropdown } from 'react-bootstrap';

import { prodFirefoxRootUrl } from '../../taskcluster-auth-callback/constants';
import { treeStatusUiUrl } from '../../models/treeStatus';

const InfraMenu = () => (
  <Dropdown>
    <Dropdown.Toggle
      className="btn-view-nav nav-menu-btn"
      title="Infrastructure status"
      caret
    >
      Infra
    </Dropdown.Toggle>
    <Dropdown.Menu align="end">
      <Dropdown.Item
        href={`${prodFirefoxRootUrl}/provisioners`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Taskcluster Workers
      </Dropdown.Item>
      <Dropdown.Item
        href={`${treeStatusUiUrl()}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        TreeStatus
      </Dropdown.Item>
    </Dropdown.Menu>
  </Dropdown>
);

export default InfraMenu;
