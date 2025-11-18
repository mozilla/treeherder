import React from 'react';
import PropTypes from 'prop-types';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

import ClassificationGroup from './ClassificationGroup';
import { filterTests } from './helpers';

export default class TestMetric extends React.PureComponent {
  render() {
    const {
      data,
      repo,
      revision,
      notify,
      currentRepo,
      searchStr,
      jobs,
      regressionsOrderBy,
      regressionsGroupBy,
      updateParamsAndState,
      selectedJobName,
      selectedTaskId,
      selectedTest,
      testGroup,
      investigateTest,
      unInvestigateTest,
      updatePushHealth,
    } = this.props;
    const { details } = data;
    const { needInvestigation } = details;
    let filteredNeedInvestigation = needInvestigation;

    if (searchStr.length) {
      filteredNeedInvestigation = filterTests(needInvestigation, searchStr);
    }

    return (
      <div className="border-bottom border-secondary">
        <ClassificationGroup
          jobs={jobs}
          tests={filteredNeedInvestigation}
          name="Possible Regressions"
          repo={repo}
          currentRepo={currentRepo}
          revision={revision}
          className="mb-5"
          icon={faExclamationTriangle}
          iconColor={
            filteredNeedInvestigation.length ? 'danger' : 'darker-secondary'
          }
          expanded={testGroup === 'pr'}
          testGroup={testGroup}
          selectedTest={selectedTest}
          hasRetriggerAll
          notify={notify}
          orderedBy={regressionsOrderBy}
          groupedBy={regressionsGroupBy}
          selectedJobName={selectedJobName}
          selectedTaskId={selectedTaskId}
          setOrderedBy={(regressionsOrderBy) =>
            updateParamsAndState({ regressionsOrderBy, testGroup: 'pr' })
          }
          setGroupedBy={(regressionsGroupBy) =>
            updateParamsAndState({ regressionsGroupBy, testGroup: 'pr' })
          }
          updateParamsAndState={(stateObj) => {
            stateObj.testGroup = 'pr';
            updateParamsAndState(stateObj);
          }}
          investigateTest={(test) => investigateTest(test, 'needInvestigation')}
          unInvestigateTest={(test) =>
            unInvestigateTest(test, 'needInvestigation')
          }
          updatePushHealth={updatePushHealth}
        />
      </div>
    );
  }
}

TestMetric.propTypes = {
  data: PropTypes.shape({
    name: PropTypes.string.isRequired,
    result: PropTypes.string.isRequired,
    details: PropTypes.shape({
      needInvestigation: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    }).isRequired,
  }).isRequired,
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  searchStr: PropTypes.string.isRequired,
  testGroup: PropTypes.string,
  regressionsOrderBy: PropTypes.string,
  regressionsGroupBy: PropTypes.string,
  updateParamsAndState: PropTypes.func.isRequired,
};

TestMetric.defaultProps = {
  regressionsOrderBy: 'count',
  regressionsGroupBy: 'path',
  testGroup: '',
};
