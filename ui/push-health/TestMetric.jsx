import React from 'react';
import PropTypes from 'prop-types';

import ClassificationGroup from './ClassificationGroup';
import UnsupportedGroup from './UnsupportedGroup';
import Metric from './Metric';
import { filterTests } from './helpers';

export default class TestMetric extends React.PureComponent {
  render() {
    const {
      data,
      repo,
      revision,
      user,
      notify,
      currentRepo,
      expanded,
      setExpanded,
      searchStr,
      showParentMatches,
    } = this.props;
    const { name, result, details } = data;
    const { needInvestigation, intermittent, unsupported } = details;
    let filteredNeedInvestigation = needInvestigation;
    let filteredIntermittent = intermittent;

    if (searchStr.length || !showParentMatches) {
      filteredNeedInvestigation = filterTests(
        needInvestigation,
        searchStr,
        showParentMatches,
      );
      filteredIntermittent = filterTests(
        intermittent,
        searchStr,
        showParentMatches,
      );
    }

    return (
      <Metric
        name={name}
        result={result}
        expanded={expanded}
        setExpanded={setExpanded}
      >
        <div className="border-bottom border-secondary">
          <ClassificationGroup
            group={filteredNeedInvestigation}
            name="Need Investigation"
            repo={repo}
            currentRepo={currentRepo}
            revision={revision}
            className="mb-5"
            headerColor={
              filteredNeedInvestigation.length ? 'danger' : 'darker-secondary'
            }
            unfilteredLength={needInvestigation.length}
            user={user}
            hasRetriggerAll
            notify={notify}
          />
          <ClassificationGroup
            group={filteredIntermittent}
            name="Known Intermittent"
            repo={repo}
            currentRepo={currentRepo}
            revision={revision}
            className="mb-5"
            headerColor="darker-secondary"
            unfilteredLength={intermittent.length}
            expanded={false}
            user={user}
            hasRetriggerAll
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
      </Metric>
    );
  }
}

TestMetric.propTypes = {
  data: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.object.isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  setExpanded: PropTypes.func.isRequired,
  expanded: PropTypes.bool.isRequired,
  searchStr: PropTypes.string.isRequired,
  showParentMatches: PropTypes.bool.isRequired,
};
