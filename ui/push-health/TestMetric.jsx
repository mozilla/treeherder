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
      setRegressionsOrderBy,
      setRegressionsGroupBy,
      setKnownIssuesOrderBy,
      setKnownIssuesGroupBy,
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
          hasRetriggerAll
          notify={notify}
          orderedBy={regressionsOrderBy}
          groupedBy={regressionsGroupBy}
          setOrderedBy={setRegressionsOrderBy}
          setGroupedBy={setRegressionsGroupBy}
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
          hasRetriggerAll
          notify={notify}
          orderedBy={knownIssuesOrderBy}
          groupedBy={knownIssuesGroupBy}
          setOrderedBy={setKnownIssuesOrderBy}
          setGroupedBy={setKnownIssuesGroupBy}
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
  setRegressionsOrderBy: PropTypes.func,
  setRegressionsGroupBy: PropTypes.func,
  setKnownIssuesOrderBy: PropTypes.func,
  setKnownIssuesGroupBy: PropTypes.func,
};

TestMetric.defaultProps = {
  regressionsOrderBy: 'count',
  regressionsGroupBy: 'path',
  knownIssuesOrderBy: 'count',
  knownIssuesGroupBy: 'path',
  setRegressionsOrderBy: () => {},
  setRegressionsGroupBy: () => {},
  setKnownIssuesOrderBy: () => {},
  setKnownIssuesGroupBy: () => {},
};
