import React from 'react';
import PropTypes from 'prop-types';
import { UncontrolledDropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap';

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
      hasBoundaryError: false,
      boundaryError: '',
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

  componentDidCatch(error) {
    this.setState({
      hasBoundaryError: true,
      boundaryError: error,
    });
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
    const {
      status, messageOfTheDay, reason, statusInfo, hasBoundaryError,
      boundaryError,
    } = this.state;
    const watchedRepo = repo.name;
    const activeClass = watchedRepo === repoName ? 'active' : '';
    const { btnClass, icon, color } = statusInfo;
    const pulseIcon = statusInfo.pulseIcon || '';
    const treeStatusName = TreeStatusModel.getTreeStatusName(watchedRepo);
    const changeRepoUrl = getRepoUrl(watchedRepo);

    if (hasBoundaryError) {
      return (
        <span
          className="btn-view-nav pl-1 pr-1 border-right"
          title={boundaryError.toString()}
        >Error getting {watchedRepo} info</span>
      );
    }
    return (
      <UncontrolledDropdown>
        <a
          href={changeRepoUrl}
          className={`watched-repo-main-btn btn btn-sm ${btnClass} ${activeClass}`}
          title={status}
        >
          <i className={`fa ${icon} ${pulseIcon} ${color}`} /> {watchedRepo}
        </a>
        <DropdownToggle
          tag="span"
        >
          <button
            className={`watched-repo-info-btn btn btn-sm btn-view-nav ${btnClass} ${activeClass}`}
            type="button"
            title={`${watchedRepo} info`}
            aria-label={`${watchedRepo} info`}
          ><span className="fa fa-info-circle" /></button>
          {watchedRepo !== repoName && <button
            className={`watched-repo-unwatch-btn btn btn-sm btn-view-nav ${btnClass} ${activeClass}`}
            onClick={() => unwatchRepo(watchedRepo)}
          ><span className="fa fa-times" /></button>}
        </DropdownToggle>
        <DropdownMenu right className={'watched-repo-menu'}>
          {status === 'unsupported' && <React.Fragment>
            <DropdownItem header>
              <span>{watchedRepo} is not listed on <a
                href="https://mozilla-releng.net/treestatus"
                target="_blank"
                rel="noopener noreferrer"
              >Tree Status</a></span>
            </DropdownItem>
            <DropdownItem divider />
          </React.Fragment>}
          {!!reason && <DropdownItem header>
            <span><BugLinkify>{reason}</BugLinkify></span>
          </DropdownItem>}
          {!!reason && !!messageOfTheDay && <DropdownItem divider />}
          {!!messageOfTheDay && <DropdownItem>
            <span><BugLinkify>{messageOfTheDay}</BugLinkify></span>
          </DropdownItem>}
          {(!!reason || !!messageOfTheDay) && <DropdownItem divider />}
          <DropdownItem
            tag="a"
            target="_blank"
            rel="noopener noreferrer"
            href={`https://mozilla-releng.net/treestatus/show/${treeStatusName}`}
          >
            <span>Tree Status</span>
          </DropdownItem>
          <DropdownItem
            tag="a"
            target="_blank"
            rel="noopener noreferrer"
            href={repo.pushLogUrl}
          >
            <span>Pushlog</span>
          </DropdownItem>
        </DropdownMenu>
      </UncontrolledDropdown>
    );
  }
}

WatchedRepo.propTypes = {
  repoName: PropTypes.string.isRequired,
  unwatchRepo: PropTypes.func.isRequired,
  repo: PropTypes.object.isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
};
