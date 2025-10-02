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
import { Button, Dropdown } from 'react-bootstrap';
import { Link } from 'react-router-dom';

import TreeStatusModel, { treeStatusUiUrl } from '../../models/treeStatus';
import BugLinkify from '../../shared/BugLinkify';
import { updateRepoParams } from '../../helpers/location';

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

  updateTreeStatus = (mustBeCurrentRepo = false) => {
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
      setCurrentRepoTreeStatus('unsupported');
      clearInterval(this.treeStatusIntervalId);
    } else {
      TreeStatusModel.get(watchedRepoName).then((data) => {
        const treeStatus = data.result;

        if (mustBeCurrentRepo || watchedRepoName === repoName) {
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

    return (
      <div className="btn-group" role="group">
        <Link
          to={updateRepoParams(watchedRepo)}
          className={`btn btn-sm btn-view-nav ${btnClass} ${activeClass} btn-watched-repo`}
          title={status}
        >
          <FontAwesomeIcon
            icon={icon}
            size="sm"
            className={color}
            pulse={pulseIcon}
          />{' '}
          {watchedRepo}
        </Link>
        <Dropdown>
          <Dropdown.Toggle className={`btn-view-nav ${activeClass} no-caret`}>
            <FontAwesomeIcon
              icon={faInfoCircle}
              title={`${watchedRepo} info`}
            />
          </Dropdown.Toggle>
          {watchedRepo !== repoName && (
            <Button
              className={`btn-view-nav ${activeClass}`}
              onClick={() => unwatchRepo(watchedRepo)}
              size="sm"
            >
              <FontAwesomeIcon
                icon={faTimes}
                title={`Unwatch ${watchedRepo}`}
              />
            </Button>
          )}
          <Dropdown.Menu>
            {status === 'unsupported' && (
              <React.Fragment>
                <Dropdown.Item
                  tag="a"
                  href={`${treeStatusUiUrl()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {watchedRepo} is not listed on Tree Status
                </Dropdown.Item>
                <Dropdown.Item divider />
              </React.Fragment>
            )}
            {!!reason && (
              <React.Fragment>
                <Dropdown.Item tag="a">
                  <BugLinkify>{reason}</BugLinkify>
                </Dropdown.Item>
                <Dropdown.Item divider />
              </React.Fragment>
            )}

            {!!messageOfTheDay && (
              <React.Fragment>
                <Dropdown.Item tag="a">
                  <BugLinkify>{messageOfTheDay}</BugLinkify>
                </Dropdown.Item>
                <Dropdown.Item divider />
              </React.Fragment>
            )}
            <Dropdown.Item
              tag="a"
              href={`${treeStatusUiUrl()}${watchedRepo}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Tree Status
            </Dropdown.Item>
            <Dropdown.Item
              tag="a"
              href={repo.pushLogUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Pushlog
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    );
  }
}

WatchedRepo.propTypes = {
  repoName: PropTypes.string.isRequired,
  unwatchRepo: PropTypes.func.isRequired,
  repo: PropTypes.shape({
    name: PropTypes.string,
    dvcs_type: PropTypes.string,
    pushLogUrl: PropTypes.string,
  }).isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
};
