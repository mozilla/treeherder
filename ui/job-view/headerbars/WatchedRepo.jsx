import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle } from '@fortawesome/free-regular-svg-icons';
import {
  faInfoCircle,
  faLock,
  faQuestion,
  faSpinner,
  faTimes,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons';

import TreeStatusModel from '../../models/treeStatus';
import BugLinkify from '../../shared/BugLinkify';
import { getRepoUrl } from '../../helpers/location';

const statusInfoMap = {
  open: {
    icon: faCircle,
    color: 'tree-open',
    btnClass: 'btn-view-nav',
  },
  'approval required': {
    icon: faLock,
    color: 'tree-approval',
    btnClass: 'btn-view-nav',
  },
  closed: {
    icon: faTimesCircle,
    color: 'tree-closed',
    btnClass: 'btn-view-nav-closed',
  },
  unsupported: {
    icon: faQuestion,
    color: 'tree-unavailable',
    btnClass: 'btn-view-nav',
  },
  'not retrieved yet': {
    icon: faSpinner,
    pulseIcon: true,
    color: 'tree-unavailable',
    btnClass: 'btn-view-nav',
  },
  error: {
    icon: faQuestion,
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
        icon: faSpinner,
        pulseIcon: true,
        color: 'tree-unavailable',
        btnClass: 'btn-view-nav',
      },
    };
  }

  componentDidMount() {
    this.updateTreeStatus();
    // update the TreeStatus every 2 minutes
    this.treeStatusIntervalId = setInterval(
      this.updateTreeStatus,
      2 * 60 * 1000,
    );
  }

  componentWillUnmount() {
    clearInterval(this.treeStatusIntervalId);
  }

  updateTreeStatus = () => {
    const { repo, repoName, setCurrentRepoTreeStatus } = this.props;
    const watchedRepoName = repo.name;

    // Treestatus only supports hg repos.
    // Instead of fetching 404 responses, assume other dvcs types are unsupported
    if (repo.dvcs_type !== 'hg') {
      this.setState({
        status: 'unsupported',
        reason: '',
        messageOfTheDay: '',
        statusInfo: statusInfoMap.unsupported,
      });
      clearInterval(this.treeStatusIntervalId);
    } else {
      TreeStatusModel.get(watchedRepoName).then(data => {
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

        if (treeStatus.status === 'unsupported') {
          clearInterval(this.treeStatusIntervalId);
        }
      });
    }
  };

  render() {
    const { repoName, unwatchRepo, repo } = this.props;
    const { status, messageOfTheDay, reason, statusInfo } = this.state;
    const watchedRepo = repo.name;
    const activeClass = watchedRepo === repoName ? 'active' : '';
    const { btnClass, icon, color } = statusInfo;
    const pulseIcon = statusInfo.pulseIcon || null;
    const treeStatusName = TreeStatusModel.getTreeStatusName(watchedRepo);
    const changeRepoUrl = getRepoUrl(watchedRepo);

    return (
      <span className="btn-group">
        <a
          href={changeRepoUrl}
          className={`watched-repo-main-btn btn btn-sm ${btnClass} ${activeClass}`}
          title={status}
        >
          <FontAwesomeIcon
            icon={icon}
            size="sm"
            className={color}
            pulse={pulseIcon}
          />{' '}
          {watchedRepo}
        </a>
        <button
          className={`watched-repo-info-btn btn btn-sm btn-view-nav ${activeClass}`}
          type="button"
          title={`${watchedRepo} info`}
          aria-label={`${watchedRepo} info`}
          data-toggle="dropdown"
        >
          <FontAwesomeIcon icon={faInfoCircle} title={`${watchedRepo} info`} />
        </button>
        {watchedRepo !== repoName && (
          <button
            className={`watched-repo-unwatch-btn btn btn-sm btn-view-nav ${activeClass}`}
            type="button"
            onClick={() => unwatchRepo(watchedRepo)}
            title={`Unwatch ${watchedRepo}`}
            aria-label={`Unwatch ${watchedRepo}`}
          >
            <FontAwesomeIcon icon={faTimes} title="Unwatch" />
          </button>
        )}

        <ul className="dropdown-menu" role="menu">
          {status === 'unsupported' && (
            <React.Fragment>
              <li className="watched-repo-dropdown-item">
                <span>
                  {watchedRepo} is not listed on{' '}
                  <a
                    href="https://mozilla-releng.net/treestatus"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Tree Status
                  </a>
                </span>
              </li>
              <li className="dropdown-divider" />
            </React.Fragment>
          )}
          {!!reason && (
            <li className="watched-repo-dropdown-item">
              <span>
                <BugLinkify>{reason}</BugLinkify>
              </span>
            </li>
          )}
          {!!reason && !!messageOfTheDay && <li className="dropdown-divider" />}
          {!!messageOfTheDay && (
            <li className="watched-repo-dropdown-item">
              <span>
                <BugLinkify>{messageOfTheDay}</BugLinkify>
              </span>
            </li>
          )}
          {(!!reason || !!messageOfTheDay) && (
            <li className="dropdown-divider" />
          )}
          <li className="watched-repo-dropdown-item">
            <a
              href={`https://treestatus.mozilla-releng.net/static/ui/treestatus/show/${treeStatusName}`}
              className="dropdown-item"
              target="_blank"
              rel="noopener noreferrer"
            >
              Tree Status
            </a>
          </li>
          <li className="watched-repo-dropdown-item">
            <a
              href={repo.pushLogUrl}
              className="dropdown-item"
              target="_blank"
              rel="noopener noreferrer"
            >
              Pushlog
            </a>
          </li>
        </ul>
      </span>
    );
  }
}

WatchedRepo.propTypes = {
  repoName: PropTypes.string.isRequired,
  unwatchRepo: PropTypes.func.isRequired,
  repo: PropTypes.object.isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
};
