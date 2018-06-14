import React from 'react';
import PropTypes from 'prop-types';

import Login from '../../shared/Login';
import LogoMenu from './LogoMenu';
import NotificationsMenu from './NotificationsMenu';
import InfraMenu from './InfraMenu';
import ReposMenu from './ReposMenu';
import TiersMenu from './TiersMenu';
import FiltersMenu from './FiltersMenu';
import HelpMenu from './HelpMenu';
import SecondaryNavBar from './SecondaryNavBar';

export default function PrimaryNavBar(props) {
  const {
    user, setUser, repos, updateButtonClick, serverChanged,
    filterModel, $injector, setCurrentRepoTreeStatus, duplicateJobsVisible,
    groupCountsExpanded,
  } = props;

  return (
    <div id="global-navbar-container">
      <div id="th-global-top-nav-panel">
        <nav id="th-global-navbar" className="navbar navbar-dark">
          <div id="th-global-navbar-top">
            <LogoMenu />
            <span className="navbar-right">
              <NotificationsMenu />
              <InfraMenu />
              <ReposMenu repos={repos} />
              <TiersMenu filterModel={filterModel} />
              <FiltersMenu filterModel={filterModel} />
              <HelpMenu />
              <Login user={user} setUser={setUser} />
            </span>
          </div>
          <SecondaryNavBar
            updateButtonClick={updateButtonClick}
            serverChanged={serverChanged}
            $injector={$injector}
            filterModel={filterModel}
            repos={repos}
            setCurrentRepoTreeStatus={setCurrentRepoTreeStatus}
            duplicateJobsVisible={duplicateJobsVisible}
            groupCountsExpanded={groupCountsExpanded}
          />
        </nav>
      </div>
    </div>
  );
}

PrimaryNavBar.propTypes = {
  $injector: PropTypes.object.isRequired,
  filterModel: PropTypes.object.isRequired,
  repos: PropTypes.array.isRequired,
  updateButtonClick: PropTypes.func.isRequired,
  serverChanged: PropTypes.bool.isRequired,
  setUser: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
};
