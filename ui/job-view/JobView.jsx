import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import treeherder from '../js/treeherder';
import DetailsPanel from './details/DetailsPanel';
import PushList from './PushList';

const JobView = (props) => {
  const { user, repoName, revision, currentRepo, selectedJob, $injector } = props;

  return (
    <React.Fragment>
      <div id="th-global-content" className="th-global-content">
        <span className="th-view-content">
          <PushList
            user={user}
            repoName={repoName}
            revision={revision}
            currentRepo={currentRepo}
            $injector={$injector}
          />
        </span>
      </div>
      <DetailsPanel
        className={selectedJob ? '' : 'hidden'}
        currentRepo={currentRepo}
        repoName={repoName}
        selectedJob={selectedJob}
        user={user}
        $injector={$injector}
      />
    </React.Fragment>
  );
};

JobView.propTypes = {
  $injector: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  revision: PropTypes.string,
  currentRepo: PropTypes.object,
  selectedJob: PropTypes.object,
};

// Sometime of these props are not ready by the time this renders, so
// need some defaults for them.
JobView.defaultProps = {
  revision: null,
  selectedJob: null,
  currentRepo: {},
};

treeherder.component('jobView', react2angular(
  JobView,
  ['repoName', 'user', 'revision', 'currentRepo', 'selectedJob'],
  ['$injector']));
