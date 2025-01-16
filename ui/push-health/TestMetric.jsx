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
      knownIssuesOrderBy,
      knownIssuesGroupBy,
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
    const { needInvestigation, knownIssues } = details;
    let filteredNeedInvestigation = needInvestigation;
    let filteredKnownIssues = knownIssues;

    if (searchStr.length) {
      filteredNeedInvestigation = filterTests(needInvestigation, searchStr);
      filteredKnownIssues = filterTests(knownIssues, searchStr);
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
        <ClassificationGroup
          jobs={jobs}
          tests={filteredKnownIssues}
          name="Known Issues"
          repo={repo}
          currentRepo={currentRepo}
          revision={revision}
          className="mb-5"
          icon={faExclamationTriangle}
          iconColor={
            filteredKnownIssues.length ? 'warning' : 'darker-secondary'
          }
          expanded={testGroup === 'ki'}
          testGroup={testGroup}
          selectedTest={selectedTest}
          hasRetriggerAll
          notify={notify}
          selectedTaskId={selectedTaskId}
          orderedBy={knownIssuesOrderBy}
          groupedBy={knownIssuesGroupBy}
          selectedJobName={selectedJobName}
          setOrderedBy={(knownIssuesOrderBy) =>
            updateParamsAndState({ knownIssuesOrderBy, testGroup: 'ki' })
          }
          setGroupedBy={(knownIssuesGroupBy) =>
            updateParamsAndState({ knownIssuesGroupBy, testGroup: 'ki' })
          }
          updateParamsAndState={(stateObj) => {
            stateObj.testGroup = 'ki';
            updateParamsAndState(stateObj);
          }}
          investigateTest={(test) => investigateTest(test, 'knownIssues')}
          unInvestigateTest={(test) => unInvestigateTest(test, 'knownIssues')}
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
      knownIssues: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
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
  knownIssuesOrderBy: PropTypes.string,
  knownIssuesGroupBy: PropTypes.string,
  updateParamsAndState: PropTypes.func.isRequired,
};

TestMetric.defaultProps = {
  regressionsOrderBy: 'count',
  regressionsGroupBy: 'path',
  knownIssuesOrderBy: 'count',
  knownIssuesGroupBy: 'path',
  testGroup: '',
};
