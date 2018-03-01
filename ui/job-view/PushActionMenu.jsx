import React from "react";
import PropTypes from 'prop-types';
import { getUrlParam } from "../helpers/locationHelper";

export default class PushActionMenu extends React.PureComponent {

  constructor(props) {
    super(props);
    const { $injector } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.thEvents = $injector.get('thEvents');
    this.thNotify = $injector.get('thNotify');
    this.ThResultSetStore = $injector.get('ThResultSetStore');
    this.ThResultSetModel = $injector.get('ThResultSetModel');
    this.ThModelErrors = $injector.get('ThModelErrors');
    this.ThTaskclusterErrors = $injector.get('ThTaskclusterErrors');

    // customPushActions uses $uibModal which doesn't work well in the
    // unit tests.  So if we fail to inject here, that's OK.
    // Bug 1437736
    try {
      this.customPushActions = $injector.get('customPushActions');
    } catch (ex) {
      this.customPushActions = {};
    }

    this.revision = this.props.revision;
    this.pushId = this.props.pushId;
    this.repoName = this.props.repoName;

    this.triggerMissingJobs = this.triggerMissingJobs.bind(this);
    this.triggerAllTalosJobs = this.triggerAllTalosJobs.bind(this);

    // Trigger missing jobs is dangerous on repos other than these (see bug 1335506)
    this.triggerMissingRepos = ['mozilla-inbound', 'autoland'];
  }

  getRangeChangeUrl(param, revision) {
    let url = window.location.href;
    url = url.replace(`&${param}=${getUrlParam(param)}`, "");
    return `${url}&${param}=${revision}`;
  }

  triggerMissingJobs() {
    if (!window.confirm(`This will trigger all missing jobs for revision ${this.revision}!\n\nClick "OK" if you want to proceed.`)) {
      return;
    }

    this.ThResultSetStore.getGeckoDecisionTaskId(this.pushId)
      .then((decisionTaskID) => {
        this.ThResultSetModel.triggerMissingJobs(decisionTaskID)
          .then((msg) => {
            this.thNotify.send(msg, "success");
          }, (e) => {
            this.thNotify.send(
              this.ThModelErrors.format(e, "The action 'trigger missing jobs' failed"),
              'danger',
              { sticky: true }
            );
          });
      });
  }

  triggerAllTalosJobs() {
    if (!window.confirm(`This will trigger all Talos jobs for revision  ${this.revision}!\n\nClick "OK" if you want to proceed.`)) {
      return;
    }

    let times = parseInt(window.prompt("Enter number of instances to have for each talos job", 6));
    while (times < 1 || times > 6 || isNaN(times)) {
      times = window.prompt("We only allow instances of each talos job to be between 1 to 6 times. Enter again", 6);
    }

    this.ThResultSetStore.getGeckoDecisionTaskId(this.pushId)
      .then((decisionTaskID) => {
        this.ThResultSetModel.triggerAllTalosJobs(times, decisionTaskID)
          .then((msg) => {
            this.thNotify.send(msg, "success");
          }, (e) => {
            this.thNotify.send(
              this.ThTaskclusterErrors.format(e),
              'danger',
              { sticky: true }
            );
          });
      });
  }

  render() {
    const { loggedIn, isStaff, repoName, revision, pushId, runnableVisible,
            hideRunnableJobsCb, showRunnableJobsCb } = this.props;

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
          {runnableVisible ?
            <li
              title="Hide Runnable Jobs"
              className="dropdown-item"
              onClick={() => hideRunnableJobsCb()}
            >Hide Runnable Jobs</li> :
            <li
              title={loggedIn ? 'Add new jobs to this push' : 'Must be logged in'}
              className={loggedIn ? 'dropdown-item' : 'dropdown-item disabled'}
              onClick={() => showRunnableJobsCb()}
            >Add new jobs</li>
          }
          <li><a
            target="_blank"
            rel="noopener"
            className="dropdown-item"
            href={`https://secure.pub.build.mozilla.org/buildapi/self-serve/${repoName}/rev/${revision}`}
          >BuildAPI</a></li>
          {isStaff && this.triggerMissingRepos.includes(repoName) &&
            <li
              className="dropdown-item"
              onClick={() => this.triggerMissingJobs(revision)}
            >Trigger missing jobs</li>
          }
          {isStaff &&
            <li
              className="dropdown-item"
              onClick={() => this.triggerAllTalosJobs(revision)}
            >Trigger all Talos jobs</li>
          }
          <li><a
            target="_blank"
            rel="noopener"
            className="dropdown-item"
            href={`https://bugherder.mozilla.org/?cset=${revision}&tree=${repoName}`}
            title="Use Bugherder to mark the bugs in this push"
          >Mark with Bugherder</a></li>
          <li
            className="dropdown-item"
            onClick={() => this.customPushActions.open(repoName, pushId)}
            title="View/Edit/Submit Action tasks for this push"
          >Custom Push Action...</li>
          <li><a
            className="dropdown-item"
            href={this.getRangeChangeUrl('tochange', revision)}
          >Set as top of range</a></li>
          <li><a
            className="dropdown-item"
            href={this.getRangeChangeUrl('fromchange', revision)}
          >Set as bottom of range</a></li>
        </ul>
      </span>
    );
  }
}

PushActionMenu.propTypes = {
  runnableVisible: PropTypes.bool.isRequired,
  isStaff: PropTypes.bool.isRequired,
  loggedIn: PropTypes.bool.isRequired,
  revision: PropTypes.string.isRequired,
};
