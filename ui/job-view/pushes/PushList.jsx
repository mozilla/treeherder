import React from 'react';
import PropTypes from 'prop-types';

import ErrorBoundary from '../../shared/ErrorBoundary';
import { withPushes } from '../context/Pushes';

import Push from './Push';
import PushLoadErrors from './PushLoadErrors';

class PushList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      notificationSupported: 'Notification' in window,
    };
  }

  setWindowTitle() {
    const { allUnclassifiedFailureCount, repoName } = this.props;

    document.title = `[${allUnclassifiedFailureCount}] ${repoName}`;
  }

  render() {
    const {
      user,
      repoName,
      revision,
      currentRepo,
      filterModel,
      pushList,
      loadingPushes,
      getNextPushes,
      jobsLoaded,
      duplicateJobsVisible,
      groupCountsExpanded,
    } = this.props;
    const { notificationSupported } = this.state;
    const { isLoggedIn } = user;

    if (!revision) {
      this.setWindowTitle();
    }

    return (
      <div>
        {jobsLoaded && <span className="hidden ready" />}
        {repoName &&
          pushList.map(push => (
            <ErrorBoundary
              errorClasses="pl-2 border-top border-bottom border-dark d-block"
              message={`Error on push with revision ${push.revision}: `}
              key={push.id}
            >
              <Push
                push={push}
                isLoggedIn={isLoggedIn || false}
                currentRepo={currentRepo}
                repoName={repoName}
                filterModel={filterModel}
                notificationSupported={notificationSupported}
                duplicateJobsVisible={duplicateJobsVisible}
                groupCountsExpanded={groupCountsExpanded}
                isOnlyRevision={push.revision === revision}
              />
            </ErrorBoundary>
          ))}
        {loadingPushes && (
          <div
            className="progress active progress-bar progress-bar-striped"
            role="progressbar"
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
            {[10, 20, 50].map(count => (
              <div
                className="btn btn-light-bordered"
                onClick={() => getNextPushes(count)}
                key={count}
              >
                {count}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}

PushList.propTypes = {
  repoName: PropTypes.string.isRequired,
  user: PropTypes.object.isRequired,
  filterModel: PropTypes.object.isRequired,
  pushList: PropTypes.array.isRequired,
  getNextPushes: PropTypes.func.isRequired,
  loadingPushes: PropTypes.bool.isRequired,
  jobsLoaded: PropTypes.bool.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  allUnclassifiedFailureCount: PropTypes.number.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.object,
};

PushList.defaultProps = {
  revision: null,
  currentRepo: {},
};

export default withPushes(PushList);
