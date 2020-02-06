/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */

import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { getUrlParam } from '../../helpers/location';
import { formatTaskclusterError } from '../../helpers/errorMessage';
import CustomJobActions from '../CustomJobActions';
import PushModel from '../../models/push';
import { getPushHealthUrl, getCompareChooserUrl } from '../../helpers/url';
import { notify } from '../redux/stores/notifications';
import { thEvents } from '../../helpers/constants';

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
    window.addEventListener(thEvents.filtersUpdated, this.handleUrlChanges);
  }

  componentWillUnmount() {
    window.removeEventListener('hashchange', this.handleUrlChanges, false);
    window.removeEventListener(thEvents.filtersUpdated, this.handleUrlChanges);
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
    const {
      notify,
      revision,
      pushId,
      currentRepo,
      decisionTaskMap,
    } = this.props;
    const decisionTask = decisionTaskMap[pushId];

    if (
      !window.confirm(
        `This will trigger all missing jobs for revision ${revision}!\n\nClick "OK" if you want to proceed.`,
      )
    ) {
      return;
    }

    PushModel.triggerMissingJobs(
      pushId,
      notify,
      decisionTask,
      currentRepo,
    ).catch(e => {
      notify(formatTaskclusterError(e), 'danger', { sticky: true });
    });
  };

  triggerAllTalosJobs = () => {
    const {
      notify,
      revision,
      pushId,
      currentRepo,
      decisionTaskMap,
    } = this.props;
    const decisionTask = decisionTaskMap[pushId];

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

    PushModel.triggerAllTalosJobs(
      times,
      pushId,
      notify,
      decisionTask,
      currentRepo,
    )
      .then(msg => {
        notify(msg, 'success');
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
      revision,
      runnableVisible,
      hideRunnableJobs,
      showRunnableJobs,
      showFuzzyJobs,
      pushId,
      currentRepo,
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
          data-testid="push-action-menu-button"
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
          {true && (
            <li
              title={
                isLoggedIn
                  ? 'Add new jobs to this push via a fuzzy search'
                  : 'Must be logged in'
              }
              className={
                isLoggedIn ? 'dropdown-item' : 'dropdown-item disabled'
              }
              onClick={showFuzzyJobs}
            >
              Add new jobs (Search)
            </li>
          )}
          {triggerMissingRepos.includes(currentRepo.name) && (
            <li
              title={
                isLoggedIn
                  ? 'Trigger all jobs that were optimized away'
                  : 'Must be logged in'
              }
              className={
                isLoggedIn ? 'dropdown-item' : 'dropdown-item disabled'
              }
              onClick={this.triggerMissingJobs}
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
              href={`https://bugherder.mozilla.org/?cset=${revision}&tree=${currentRepo.name}`}
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
          <li className="dropdown-divider" />
          <li>
            <a
              className="dropdown-item"
              href={getPushHealthUrl({ repo: currentRepo.name, revision })}
              target="_blank"
              rel="noopener noreferrer"
              title="Enable Health Badges in the Health menu"
            >
              Push Health
            </a>
          </li>
          <li>
            <a
              className="dropdown-item"
              href={getCompareChooserUrl({
                newProject: currentRepo.name,
                newRevision: revision,
              })}
              target="_blank"
              rel="noopener noreferrer"
              title="Compare performance against another revision"
            >
              Compare Performance
            </a>
          </li>
        </ul>
        {customJobActionsShowing && (
          <CustomJobActions
            job={null}
            pushId={pushId}
            isLoggedIn={isLoggedIn}
            currentRepo={currentRepo}
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
  currentRepo: PropTypes.object.isRequired,
  decisionTaskMap: PropTypes.object.isRequired,
  pushId: PropTypes.number.isRequired,
  hideRunnableJobs: PropTypes.func.isRequired,
  showRunnableJobs: PropTypes.func.isRequired,
  showFuzzyJobs: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};

const mapStateToProps = ({ pushes: { decisionTaskMap } }) => ({
  decisionTaskMap,
});

export default connect(mapStateToProps, { notify })(PushActionMenu);
