import React from 'react';
import PropTypes from 'prop-types';

import { getUrlParam } from '../../helpers/location';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import CustomJobActions from '../CustomJobActions';
import PushModel from '../../models/push';
import { withPushes } from '../context/Pushes';
import { withNotifications } from '../../shared/context/Notifications';

// Trigger missing jobs is dangerous on repos other than these (see bug 1335506)
const triggerMissingRepos = ['mozilla-inbound', 'autoland'];

class PushActionMenu extends React.PureComponent {
  constructor(props) {
    super(props);

    const { revision } = this.props;

    this.state = {
      topOfRangeUrl: this.getRangeChangeUrl('tochange', revision),
      bottomOfRangeUrl: this.getRangeChangeUrl('fromchange', revision),
      customJobActionsShowing: false,
    };
  }

  componentDidMount() {
    window.addEventListener('hashchange', this.handleUrlChanges, false);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.handleUrlChanges, false);
  }

  getRangeChangeUrl(param, revision) {
    let url = window.location.href;
    url = url.replace(`&${param}=${getUrlParam(param)}`, '');
    url = url.replace(`&${'selectedJob'}=${getUrlParam('selectedJob')}`, '');
    return `${url}&${param}=${revision}`;
  }

  handleUrlChanges = () => {
    const { revision } = this.props;

    this.setState({
      topOfRangeUrl: this.getRangeChangeUrl('tochange', revision),
      bottomOfRangeUrl: this.getRangeChangeUrl('fromchange', revision),
    });
  };

  triggerMissingJobs = () => {
    const { getGeckoDecisionTaskId, notify, revision, pushId } = this.props;

    if (
      !window.confirm(
        `This will trigger all missing jobs for revision ${revision}!\n\nClick "OK" if you want to proceed.`,
      )
    ) {
      return;
    }

    getGeckoDecisionTaskId(pushId)
      .then(decisionTaskID => {
        PushModel.triggerMissingJobs(decisionTaskID)
          .then(msg => {
            notify(msg, 'success');
          })
          .catch(e => {
            notify(formatTaskclusterError(e), 'danger', { sticky: true });
          });
      })
      .catch(e => {
        notify(formatTaskclusterError(e), 'danger', { sticky: true });
      });
  };

  triggerAllTalosJobs = () => {
    const { getGeckoDecisionTaskId, notify, revision, pushId } = this.props;

    if (
      !window.confirm(
        `This will trigger all Talos jobs for revision  ${revision}!\n\nClick "OK" if you want to proceed.`,
      )
    ) {
      return;
    }

    let times = parseInt(
      window.prompt('Enter number of instances to have for each talos job', 6),
      10,
    );
    while (times < 1 || times > 6 || Number.isNaN(times)) {
      times = window.prompt(
        'We only allow instances of each talos job to be between 1 to 6 times. Enter again',
        6,
      );
    }

    getGeckoDecisionTaskId(pushId)
      .then(decisionTaskID => {
        PushModel.triggerAllTalosJobs(times, decisionTaskID)
          .then(msg => {
            notify(msg, 'success');
          })
          .catch(e => {
            notify(formatTaskclusterError(e), 'danger', { sticky: true });
          });
      })
      .catch(e => {
        notify(formatTaskclusterError(e), 'danger', { sticky: true });
      });
  };

  toggleCustomJobActions = () => {
    const { customJobActionsShowing } = this.state;

    this.setState({ customJobActionsShowing: !customJobActionsShowing });
  };

  render() {
    const {
      isLoggedIn,
      repoName,
      revision,
      runnableVisible,
      hideRunnableJobs,
      showRunnableJobs,
      pushId,
    } = this.props;
    const {
      topOfRangeUrl,
      bottomOfRangeUrl,
      customJobActionsShowing,
    } = this.state;

    return (
      <span className="btn-group dropdown" dropdown="true">
        <button
          dropdown-toggle="true"
          className="btn btn-sm btn-push dropdown-toggle"
          type="button"
          title="Action menu"
          data-hover="dropdown"
          data-toggle="dropdown"
          data-delay="1000"
        >
          <span className="caret" />
        </button>

        <ul className="dropdown-menu pull-right">
          {runnableVisible ? (
            <li
              title="Hide Runnable Jobs"
              className="dropdown-item"
              onClick={hideRunnableJobs}
            >
              Hide Runnable Jobs
            </li>
          ) : (
            <li
              title={
                isLoggedIn ? 'Add new jobs to this push' : 'Must be logged in'
              }
              className={
                isLoggedIn ? 'dropdown-item' : 'dropdown-item disabled'
              }
              onClick={showRunnableJobs}
            >
              Add new jobs
            </li>
          )}
          {triggerMissingRepos.includes(repoName) && (
            <li
              title={
                isLoggedIn
                  ? 'Trigger all jobs that were optimized away'
                  : 'Must be logged in'
              }
              className={
                isLoggedIn ? 'dropdown-item' : 'dropdown-item disabled'
              }
              onClick={() => this.triggerMissingJobs(revision)}
            >
              Trigger missing jobs
            </li>
          )}
          <li
            title={
              isLoggedIn
                ? 'Trigger all talos performance tests'
                : 'Must be logged in'
            }
            className={isLoggedIn ? 'dropdown-item' : 'dropdown-item disabled'}
            onClick={() => this.triggerAllTalosJobs(revision)}
          >
            Trigger all Talos jobs
          </li>
          <li>
            <a
              target="_blank"
              rel="noopener noreferrer"
              className="dropdown-item"
              href={`https://bugherder.mozilla.org/?cset=${revision}&tree=${repoName}`}
              title="Use Bugherder to mark the bugs in this push"
            >
              Mark with Bugherder
            </a>
          </li>
          <li
            className="dropdown-item"
            onClick={this.toggleCustomJobActions}
            title="View/Edit/Submit Action tasks for this push"
          >
            Custom Push Action...
          </li>
          <li>
            <a
              className="dropdown-item top-of-range-menu-item"
              href={topOfRangeUrl}
            >
              Set as top of range
            </a>
          </li>
          <li>
            <a
              className="dropdown-item bottom-of-range-menu-item"
              href={bottomOfRangeUrl}
            >
              Set as bottom of range
            </a>
          </li>
        </ul>
        {customJobActionsShowing && (
          <CustomJobActions
            job={null}
            pushId={pushId}
            isLoggedIn={isLoggedIn}
            toggle={this.toggleCustomJobActions}
          />
        )}
      </span>
    );
  }
}

PushActionMenu.propTypes = {
  runnableVisible: PropTypes.bool.isRequired,
  isLoggedIn: PropTypes.bool.isRequired,
  revision: PropTypes.string.isRequired,
  repoName: PropTypes.string.isRequired,
  pushId: PropTypes.number.isRequired,
  hideRunnableJobs: PropTypes.func.isRequired,
  showRunnableJobs: PropTypes.func.isRequired,
  getGeckoDecisionTaskId: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};

export default withNotifications(withPushes(PushActionMenu));
