import React from 'react';
import PropTypes from 'prop-types';

import TreeStatusModel from '../../models/treeStatus';
import BugLinkify from '../../shared/BugLinkify';
import { getRepoUrl } from '../../helpers/url';

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

    const { $injector } = this.props;
    this.thJobFilters = $injector.get('thJobFilters');
    this.$rootScope = $injector.get('$rootScope');

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
    };
  }

  componentDidMount() {
    this.updateTreeStatus = this.updateTreeStatus.bind(this);

    this.updateTreeStatus();
    // update the TreeStatus every 2 minutes
    this.treeStatusIntervalId = setInterval(this.updateTreeStatus, 2 * 60 * 1000);
  }

  componentWillUnmount() {
    clearInterval(this.treeStatusIntervalId);
  }

  updateTreeStatus() {
    const { repo, repoName, setCurrentRepoTreeStatus } = this.props;
    const watchedRepoName = repo.name;

    TreeStatusModel.get(watchedRepoName).then((data) => {
      const treeStatus = data.result;

      if (watchedRepoName === repoName) {
        setCurrentRepoTreeStatus(treeStatus.status);
      }

      this.setState({
        status: treeStatus.status,
        reason: treeStatus.reason,
        messageOfTheDay: treeStatus.message_of_the_day,
        statusInfo: statusInfoMap[treeStatus.status],
      });
    });
  }

  render() {
    const { repoName, unwatchRepo, repo } = this.props;
    const { status, messageOfTheDay, reason, statusInfo } = this.state;
    const watchedRepo = repo.name;
    const activeClass = watchedRepo === repoName ? 'active' : '';
    const { btnClass, icon, color } = statusInfo;
    const pulseIcon = statusInfo.pulseIcon || '';
    const treeStatusName = TreeStatusModel.getTreeStatusName(watchedRepo);
    const changeRepoUrl = getRepoUrl(watchedRepo);

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
          aria-label={`${watchedRepo} info`}
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
              href={repo.pushLogUrl}
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
  repoName: PropTypes.string.isRequired,
  unwatchRepo: PropTypes.func.isRequired,
  repo: PropTypes.object.isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
};
