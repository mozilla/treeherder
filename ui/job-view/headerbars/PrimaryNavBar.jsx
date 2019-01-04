import React from 'react';
import PropTypes from 'prop-types';
import isEqual from 'lodash/isEqual';

import Logo from '../../img/treeherder-logo.png';
import Login from '../../shared/auth/Login';
import LogoMenu from '../../shared/LogoMenu';

import NotificationsMenu from './NotificationsMenu';
import InfraMenu from './InfraMenu';
import ReposMenu from './ReposMenu';
import TiersMenu from './TiersMenu';
import FiltersMenu from './FiltersMenu';
import HelpMenu from './HelpMenu';
import SecondaryNavBar from './SecondaryNavBar';

export default class PrimaryNavBar extends React.Component {
  shouldComponentUpdate(prevProps) {
    const { filterModel, repos, user } = this.props;

    return (
      prevProps.filterModel !== filterModel ||
      !isEqual(prevProps.user, user) ||
      !isEqual(prevProps.repos, repos)
    );
  }

  render() {
    const {
      user,
      setUser,
      repos,
      updateButtonClick,
      serverChanged,
      filterModel,
      setCurrentRepoTreeStatus,
      duplicateJobsVisible,
      groupCountsExpanded,
      toggleFieldFilterVisible,
    } = this.props;

    return (
      <div id="global-navbar-container">
        <div id="th-global-top-nav-panel">
          <nav id="th-global-navbar" className="navbar navbar-dark">
            <div id="th-global-navbar-top">
              <LogoMenu menuText="Treeherder" menuImage={Logo} />
              <span className="navbar-right">
                <NotificationsMenu />
                <InfraMenu />
                <ReposMenu repos={repos} />
                <TiersMenu filterModel={filterModel} />
                <FiltersMenu filterModel={filterModel} user={user} />
                <HelpMenu />
                <Login user={user} setUser={setUser} />
              </span>
            </div>
            <SecondaryNavBar
              updateButtonClick={updateButtonClick}
              serverChanged={serverChanged}
              filterModel={filterModel}
              repos={repos}
              setCurrentRepoTreeStatus={setCurrentRepoTreeStatus}
              duplicateJobsVisible={duplicateJobsVisible}
              groupCountsExpanded={groupCountsExpanded}
              toggleFieldFilterVisible={toggleFieldFilterVisible}
            />
          </nav>
        </div>
      </div>
    );
  }
}

PrimaryNavBar.propTypes = {
  filterModel: PropTypes.object.isRequired,
  repos: PropTypes.array.isRequired,
  updateButtonClick: PropTypes.func.isRequired,
  serverChanged: PropTypes.bool.isRequired,
  setUser: PropTypes.func.isRequired,
  user: PropTypes.object.isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  toggleFieldFilterVisible: PropTypes.func.isRequired,
};
