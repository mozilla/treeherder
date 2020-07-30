import React from 'react';
import PropTypes from 'prop-types';
import {
  faExclamationTriangle,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';

import ClassificationGroup from './ClassificationGroup';
import { filterTests } from './helpers';
import PassingPaths from './PassingPaths';
import MainHeading from './MainHeading';

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
      showParentMatches,
      regressionsOrderBy,
      regressionsGroupBy,
      knownIssuesOrderBy,
      knownIssuesGroupBy,
      updateParamsAndState,
      selectedJobName,
      selectedTaskId,
      selectedTest,
      testGroup,
    } = this.props;
    const { details } = data;
    const { needInvestigation, knownIssues } = details;
    let filteredNeedInvestigation = needInvestigation;
    let filteredKnownIssues = knownIssues;

    if (searchStr.length || !showParentMatches) {
      filteredNeedInvestigation = filterTests(
        needInvestigation,
        searchStr,
        showParentMatches,
      );
      filteredKnownIssues = filterTests(
        knownIssues,
        searchStr,
        showParentMatches,
      );
    }

    return (
      <div>
        <MainHeading
          name="Possible Regressions"
          stateIcon={faExclamationTriangle}
          iconColor={
            filteredNeedInvestigation.length ? 'danger' : 'darker-secondary'
          }
          className="mb-5"
          expanded={testGroup === 'pr'}
          updateParamsAndState={updateParamsAndState}
          groupLength={filteredNeedInvestigation.length}
        >
          <ClassificationGroup
            jobs={jobs}
            tests={filteredNeedInvestigation}
            repo={repo}
            currentRepo={currentRepo}
            revision={revision}
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
          />
        </MainHeading>
        <MainHeading
          name="Known Issues"
          stateIcon={faExclamationTriangle}
          iconColor={
            filteredKnownIssues.length ? 'warning' : 'darker-secondary'
          }
          expanded={testGroup === 'ki'}
          updateParamsAndState={updateParamsAndState}
          className="mb-5"
          groupLength={filteredKnownIssues.length}
        >
          <ClassificationGroup
            jobs={jobs}
            tests={filteredKnownIssues}
            repo={repo}
            currentRepo={currentRepo}
            revision={revision}
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
          />
        </MainHeading>
        <MainHeading
          name="Passing Paths"
          stateIcon={faCheck}
          iconColor="success"
          expanded={testGroup === 'pp'}
          updateParamsAndState={(stateObj) => {
            stateObj.testGroup = 'pp';
            updateParamsAndState(stateObj);
          }}
        >
          <PassingPaths
            revision={revision}
            currentRepo={currentRepo}
            searchStr={searchStr}
          />
        </MainHeading>
      </div>
    );
  }
}

TestMetric.propTypes = {
  data: PropTypes.shape({
    name: PropTypes.string.isRequired,
    result: PropTypes.string.isRequired,
    details: PropTypes.shape({
      needInvestigation: PropTypes.array.isRequired,
      knownIssues: PropTypes.array.isRequired,
    }).isRequired,
  }).isRequired,
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  searchStr: PropTypes.string.isRequired,
  showParentMatches: PropTypes.bool.isRequired,
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
