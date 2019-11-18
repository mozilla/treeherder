import React from 'react';
import PropTypes from 'prop-types';

import ClassificationGroup from './ClassificationGroup';
import UnsupportedGroup from './UnsupportedGroup';

export default class TestFailures extends React.PureComponent {
  render() {
    const { failures, repo, revision, user, notify, currentRepo } = this.props;
    const { needInvestigation, intermittent, unsupported } = failures;
    const needInvestigationLength = Object.keys(needInvestigation).length;

    return (
      <div className="border-bottom border-secondary">
        <ClassificationGroup
          group={needInvestigation}
          name="Need Investigation"
          repo={repo}
          currentRepo={currentRepo}
          revision={revision}
          className="mb-5"
          headerColor={needInvestigationLength ? 'danger' : 'secondary'}
          user={user}
          hasRetriggerAll
          notify={notify}
        />
        <ClassificationGroup
          group={intermittent}
          name="Known Intermittent"
          repo={repo}
          currentRepo={currentRepo}
          revision={revision}
          className="mb-5"
          headerColor="secondary"
          expanded={false}
          user={user}
          notify={notify}
        />
        <UnsupportedGroup
          group={unsupported}
          name="Unsupported"
          repo={repo}
          revision={revision}
          className="mb-5"
          headerColor="warning"
        />
      </div>
    );
  }
}

TestFailures.propTypes = {
  failures: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.object.isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
};
