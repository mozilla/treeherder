import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { connect } from 'react-redux';
import intersection from 'lodash/intersection';
import isEqual from 'lodash/isEqual';

import ErrorBoundary from '../../shared/ErrorBoundary';
import { notify } from '../redux/stores/notifications';
import {
  clearSelectedJob,
  setSelectedJobFromQueryString,
} from '../redux/stores/selectedJob';
import { fetchPushes, updateRange, pollPushes } from '../redux/stores/pushes';
import { updatePushParams } from '../../helpers/location';

import Push from './Push';
import PushLoadErrors from './PushLoadErrors';

const PUSH_POLL_INTERVAL = 60000;

class PushList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      notificationSupported: 'Notification' in window,
    };
  }

  componentDidMount() {
    const { fetchPushes } = this.props;

    fetchPushes();
    this.poll();
  }

  componentDidUpdate(prevProps) {
    const {
      notify,
      jobMap,
      jobsLoaded,
      setSelectedJobFromQueryString,
    } = this.props;

    if (jobsLoaded && jobsLoaded !== prevProps.jobsLoaded) {
      setSelectedJobFromQueryString(notify, jobMap);
    }
    this.handleUrlChanges(prevProps);
  }

  componentWillUnmount() {
    if (this.pushIntervalId) {
      clearInterval(this.pushIntervalId);
      this.pushIntervalId = null;
    }
  }

  setWindowTitle() {
    const { allUnclassifiedFailureCount, repoName } = this.props;

    document.title = `[${allUnclassifiedFailureCount}] ${repoName}`;
  }

  getUrlRangeValues = (search) => {
    const params = [...new URLSearchParams(search)];

    return params.reduce((acc, [key, value]) => {
      return [
        'repo',
        'startdate',
        'enddate',
        'nojobs',
        'revision',
        'author',
      ].includes(key)
        ? { ...acc, [key]: value }
        : acc;
    }, {});
  };

  poll = () => {
    const { pollPushes } = this.props;

    this.pushIntervalId = setInterval(async () => {
      pollPushes();
    }, PUSH_POLL_INTERVAL);
  };

  handleUrlChanges = (prevProps) => {
    const { updateRange, router } = this.props;
    const oldRange = this.getUrlRangeValues(prevProps.router.location.search);
    const newRange = this.getUrlRangeValues(router.location.search);

    if (!isEqual(oldRange, newRange)) {
      updateRange(newRange);
    }
  };

  clearIfEligibleTarget(target) {
    // Target must be within the "push" area, but not be a dropdown-item or
    // a button/btn.
    // This will exclude the JobDetails and navbars.
    const globalContent = document.getElementById('th-global-content');
    const { clearSelectedJob, pinnedJobs } = this.props;
    const countPinnedJobs = Object.keys(pinnedJobs).length;
    const isEligible =
      globalContent.contains(target) &&
      target.tagName !== 'A' &&
      target.closest('button') === null &&
      !intersection(target.classList, ['btn', 'dropdown-item']).length;

    if (isEligible) {
      clearSelectedJob(countPinnedJobs);
    }
  }

  fetchNextPushes(count) {
    const { fetchPushes, router } = this.props;
    const params = updatePushParams(router.location);
    window.history.pushState(null, null, params);
    fetchPushes(count, true);
  }

  render() {
    const {
      repoName,
      revision,
      currentRepo,
      filterModel,
      pushList,
      loadingPushes,
      getAllShownJobs,
      jobsLoaded,
      duplicateJobsVisible,
      groupCountsExpanded,
      pushHealthVisibility,
    } = this.props;
    const { notificationSupported } = this.state;

    if (!revision) {
      this.setWindowTitle();
    }

    return (
      // Bug 1619873 - role="list" works better here than an interactive role
      /* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
      <div
        role="list"
        id="push-list"
        onClick={(evt) => this.clearIfEligibleTarget(evt.target)}
      >
        {jobsLoaded && <span className="hidden ready" />}
        {repoName &&
          pushList.map((push) => (
            <ErrorBoundary
              errorClasses="pl-2 border-top border-bottom border-dark d-block"
              message={`Error on push with revision ${push.revision}: `}
              key={push.id}
            >
              <Push
                role="listitem"
                push={push}
                currentRepo={currentRepo}
                filterModel={filterModel}
                notificationSupported={notificationSupported}
                duplicateJobsVisible={duplicateJobsVisible}
                groupCountsExpanded={groupCountsExpanded}
                isOnlyRevision={push.revision === revision}
                pushHealthVisibility={pushHealthVisibility}
                getAllShownJobs={getAllShownJobs}
              />
            </ErrorBoundary>
          ))}
        {loadingPushes && (
          <div
            className="progress active progress-bar progress-bar-striped"
            role="progressbar"
            aria-label="Loading tests"
          />
        )}
        {pushList.length === 0 && !loadingPushes && (
          <PushLoadErrors
            loadingPushes={loadingPushes}
            currentRepo={currentRepo}
            repoName={repoName}
            revision={revision}
          />
        )}
        <div className="card card-body get-next">
          <span>get next:</span>
          <div className="btn-group">
            {[10, 20, 50].map((count) => (
              <Button
                color="darker-secondary"
                outline
                className="btn-light-bordered"
                onClick={() => this.fetchNextPushes(count)}
                key={count}
                data-testid={`get-next-${count}`}
              >
                {count}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

PushList.propTypes = {
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  pushList: PropTypes.arrayOf(PropTypes.object).isRequired,
  fetchPushes: PropTypes.func.isRequired,
  pollPushes: PropTypes.func.isRequired,
  updateRange: PropTypes.func.isRequired,
  loadingPushes: PropTypes.bool.isRequired,
  jobsLoaded: PropTypes.bool.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  allUnclassifiedFailureCount: PropTypes.number.isRequired,
  pushHealthVisibility: PropTypes.string.isRequired,
  clearSelectedJob: PropTypes.func.isRequired,
  pinnedJobs: PropTypes.shape({}).isRequired,
  setSelectedJobFromQueryString: PropTypes.func.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  jobMap: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.shape({}),
  router: PropTypes.shape({}).isRequired,
};

PushList.defaultProps = {
  revision: null,
  currentRepo: {},
};

const mapStateToProps = ({
  pushes: {
    loadingPushes,
    jobsLoaded,
    jobMap,
    pushList,
    allUnclassifiedFailureCount,
  },
  pinnedJobs: { pinnedJobs },
  router,
}) => ({
  loadingPushes,
  jobsLoaded,
  jobMap,
  pushList,
  allUnclassifiedFailureCount,
  pinnedJobs,
  router,
});

export default connect(mapStateToProps, {
  notify,
  clearSelectedJob,
  setSelectedJobFromQueryString,
  fetchPushes,
  updateRange,
  pollPushes,
})(PushList);
