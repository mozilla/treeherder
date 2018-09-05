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
    user, setUser, repos, pinJobs, updateButtonClick, serverChanged,
    filterModel, $injector, setCurrentRepoTreeStatus,
  } = props;

  return (
    <div id="global-navbar-container">
      <div id="th-global-top-nav-panel">
        <nav id="th-global-navbar" className="navbar navbar-dark">
          <div id="th-global-navbar-top">
            <LogoMenu />
            <span className="navbar-right">
              <NotificationsMenu $injector={$injector} />
              <InfraMenu />
              <ReposMenu repos={repos} />
              <TiersMenu
                filterModel={filterModel}
              />
              <FiltersMenu
                pinJobs={pinJobs}
                filterModel={filterModel}
              />
              <HelpMenu />
              <Login
                user={user}
                setUser={setUser}
                $injector={$injector}
              />
            </span>
          </div>
          <SecondaryNavBar
            updateButtonClick={updateButtonClick}
            serverChanged={serverChanged}
            $injector={$injector}
            filterModel={filterModel}
            repos={repos}
            setCurrentRepoTreeStatus={setCurrentRepoTreeStatus}
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
  pinJobs: PropTypes.func.isRequired,
  serverChanged: PropTypes.bool.isRequired,
  setUser: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
};
