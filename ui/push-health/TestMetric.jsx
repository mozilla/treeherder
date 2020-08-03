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
      showParentMatches,
      regressionsOrderBy,
      regressionsGroupBy,
      knownIssuesOrderBy,
      knownIssuesGroupBy,
      updateParamsAndState,
      expandedDefaultMetric,
      defaultExpandedTest,
      defaultExpandedTab,
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
          defaultExpandedTab={defaultExpandedTab}
          defaultExpandedTest={defaultExpandedTest}
          hasRetriggerAll
          notify={notify}
          orderedBy={regressionsOrderBy}
          groupedBy={regressionsGroupBy}
          expandedDefaultMetric={expandedDefaultMetric}
          setOrderedBy={(regressionsOrderBy) =>
            updateParamsAndState({ regressionsOrderBy })
          }
          setGroupedBy={(setRegressionsGroupBy) =>
            updateParamsAndState({ setRegressionsGroupBy })
          }
          updateParamsAndState={(stateObj) => {
            stateObj.defaultExpandedTab = 'Possible Regressions';
            updateParamsAndState(stateObj);
          }}
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
          expanded={false}
          defaultExpandedTab={defaultExpandedTab}
          defaultExpandedTest={defaultExpandedTest}
          hasRetriggerAll
          notify={notify}
          expandedDefaultMetric={expandedDefaultMetric}
          orderedBy={knownIssuesOrderBy}
          groupedBy={knownIssuesGroupBy}
          setOrderedBy={(knownIssuesOrderBy) =>
            updateParamsAndState({ knownIssuesOrderBy })
          }
          setGroupedBy={(knownIssuesGroupBy) =>
            updateParamsAndState({ knownIssuesGroupBy })
          }
          updateParamsAndState={(stateObj) => {
            stateObj.defaultExpandedTab = 'Known Issues';
            updateParamsAndState(stateObj);
          }}
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
};
