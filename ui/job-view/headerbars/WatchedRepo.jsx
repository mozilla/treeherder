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
import {
  ButtonGroup,
  Button,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';

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
    const changeRepoUrl = getRepoUrl(watchedRepo);

    return (
      <ButtonGroup>
        <Button
          href={changeRepoUrl}
          className={`btn-view-nav ${btnClass} ${activeClass}`}
          title={status}
          size="sm"
        >
          <FontAwesomeIcon
            icon={icon}
            size="sm"
            className={color}
            pulse={pulseIcon}
          />{' '}
          {watchedRepo}
        </Button>
        <UncontrolledDropdown>
          <DropdownToggle className={`btn-view-nav ${activeClass}`}>
            <FontAwesomeIcon
              icon={faInfoCircle}
              title={`${watchedRepo} info`}
            />
          </DropdownToggle>
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
          <DropdownMenu>
            {status === 'unsupported' && (
              <React.Fragment>
                <DropdownItem
                  tag="a"
                  href="https://mozilla-releng.net/treestatus"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {watchedRepo} is not listed on Tree Status
                </DropdownItem>
                <DropdownItem divider />
              </React.Fragment>
            )}
            {!!reason && (
              <React.Fragment>
                <DropdownItem tag="a">
                  <BugLinkify>{reason}</BugLinkify>
                </DropdownItem>
                <DropdownItem divider />
              </React.Fragment>
            )}

            {!!messageOfTheDay && (
              <React.Fragment>
                <DropdownItem tag="a">
                  <BugLinkify>{messageOfTheDay}</BugLinkify>
                </DropdownItem>
                <DropdownItem divider />
              </React.Fragment>
            )}
            <DropdownItem
              tag="a"
              href={`https://treestatus.mozilla-releng.net/static/ui/treestatus/show/${watchedRepo}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Tree Status
            </DropdownItem>
            <DropdownItem
              tag="a"
              href={repo.pushLogUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Pushlog
            </DropdownItem>
          </DropdownMenu>
        </UncontrolledDropdown>
      </ButtonGroup>
    );
  }
}

WatchedRepo.propTypes = {
  repoName: PropTypes.string.isRequired,
  unwatchRepo: PropTypes.func.isRequired,
  repo: PropTypes.object.isRequired,
  setCurrentRepoTreeStatus: PropTypes.func.isRequired,
};
