import React from 'react';
import PropTypes from 'prop-types';

import { thEvents } from '../../js/constants';
import TreeStatusModel from '../../models/treeStatus';
import BugLinkify from '../../shared/BugLinkify';

const statusInfoMap = {
    open: {
        icon: 'fa-circle-o',
        color: 'tree-open',
        btnClass: 'btn-view-nav',
    },
    'approval required': {
        icon: 'fa-lock',
        color: 'tree-approval',
        btnClass: 'btn-view-nav',
    },
    closed: {
        icon: 'fa-times-circle',
        color: 'tree-closed',
        btnClass: 'btn-view-nav-closed',
    },
    unsupported: {
        icon: 'fa-question',
        color: 'tree-unavailable',
        btnClass: 'btn-view-nav',
    },
    'not retrieved yet': {
        icon: 'fa-spinner',
        pulseIcon: 'fa-pulse',
        color: 'tree-unavailable',
        btnClass: 'btn-view-nav',
    },
    error: {
        icon: 'fa-question',
        color: 'tree-unavailable',
        btnClass: 'btn-view-nav',
    },
};

export default class WatchedRepo extends React.Component {
  constructor(props) {
    super(props);

    const { $injector, watchedRepo } = this.props;
    this.$location = $injector.get('$location');
    this.thJobFilters = $injector.get('thJobFilters');
    this.$rootScope = $injector.get('$rootScope');
    this.ThRepositoryModel = $injector.get('ThRepositoryModel');

    const pushLog = this.ThRepositoryModel.getRepo(watchedRepo) ?
      this.ThRepositoryModel.getRepo(watchedRepo).pushlogURL :
      '';

    this.state = {
      status: 'not retrieved yet',
      reason: '',
      messageOfTheDay: '',
      statusInfo: {
        icon: 'fa-spinner',
        pulseIcon: 'fa-pulse',
        color: 'tree-unavailable',
        btnClass: 'btn-view-nav',
      },
      pushLog,
    };
  }

  componentDidMount() {
    const { watchedRepo } = this.props;

    this.unlistenRepositoriesLoaded = this.$rootScope.$on(thEvents.repositoriesLoaded, () => {
      this.setState({ pushLog: this.ThRepositoryModel.getRepo(watchedRepo).pushlogURL });
    });

    TreeStatusModel.get(watchedRepo).then((data) => {
      const treeStatus = data.result;

      this.setState({
        status: treeStatus.status,
        reason: treeStatus.reason,
        messageOfTheDay: treeStatus.message_of_the_day,
        statusInfo: statusInfoMap[treeStatus.status],
      });
    });
  }

  componentWillUnmount() {
    this.unlistenRepositoriesLoaded();
  }

  getRepoUrl() {
    const { repoName, watchedRepo } = this.props;
    const selectedJob = this.$location.search().selectedJob;
    const url = this.$location.absUrl().replace(`&selectedJob=${selectedJob}`, '');

    return url.replace(`repo=${repoName}`, `repo=${watchedRepo}`);
  }

  render() {
    const { watchedRepo, repoName, unwatchRepo } = this.props;
    const { status, messageOfTheDay, reason, statusInfo, pushLog } = this.state;
    const activeClass = watchedRepo === repoName ? 'active' : '';
    const { btnClass, icon, color } = statusInfo;
    const pulseIcon = statusInfo.pulseIcon || '';
    const treeStatusName = TreeStatusModel.getTreeStatusName(watchedRepo);
    const changeRepoUrl = this.getRepoUrl();

    return (
      <span className="btn-group">
        <a
          href={changeRepoUrl}
          className={`watched-repo-main-btn btn btn-sm ${btnClass} ${activeClass}`}
          type="button"
          title={status}
        >
          <i className={`fa ${icon} ${pulseIcon} ${color}`} /> {watchedRepo}
        </a>
        <button
          className={`watched-repo-info-btn btn btn-sm btn-view-nav ${activeClass}`}
          type="button"
          title={`${watchedRepo} info`}
          data-toggle="dropdown"
        ><span className="fa fa-info-circle" /></button>
        {watchedRepo !== repoName && <button
          className={`watched-repo-unwatch-btn btn btn-sm btn-view-nav ${activeClass}`}
          onClick={() => unwatchRepo(watchedRepo)}
          title={`Unwatch ${watchedRepo}`}
        ><span className="fa fa-times" /></button>}

        <ul className="dropdown-menu" role="menu">
          {status === 'unsupported' && <React.Fragment>
            <li className="watched-repo-dropdown-item">
              <span>{watchedRepo} is not listed on <a
                href="https://mozilla-releng.net/treestatus"
                target="_blank"
                rel="noopener noreferrer"
              >Tree Status</a></span>
            </li>
            <li className="dropdown-divider" />
          </React.Fragment>}
          {!!reason && <li className="watched-repo-dropdown-item">
            <span><BugLinkify>{reason}</BugLinkify></span>
          </li>}
          {!!reason && !!messageOfTheDay && <li className="dropdown-divider" />}
          {!!messageOfTheDay && <li className="watched-repo-dropdown-item">
            <span><BugLinkify>{messageOfTheDay}</BugLinkify></span>
          </li>}
          {(!!reason || !!messageOfTheDay) && <li className="dropdown-divider" />}
          <li className="watched-repo-dropdown-item">
            <a
              href={`https://mozilla-releng.net/treestatus/show/${treeStatusName}`}
              className="dropdown-item"
              target="_blank"
              rel="noopener noreferrer"
            >Tree Status</a>
          </li>
          <li className="watched-repo-dropdown-item">
            <a
              href={pushLog}
              className="dropdown-item"
              target="_blank"
              rel="noopener noreferrer"
            >Pushlog</a>
          </li>
        </ul>
      </span>
    );
  }
}

WatchedRepo.propTypes = {
  $injector: PropTypes.object.isRequired,
  watchedRepo: PropTypes.string.isRequired,
  unwatchRepo: PropTypes.func.isRequired,
  repoName: PropTypes.string,
};

WatchedRepo.defaultProps = {
  repoName: 'mozilla-inbound',
};
