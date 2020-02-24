import React from 'react';
import PropTypes from 'prop-types';

import ClassificationGroup from './ClassificationGroup';
import UnsupportedGroup from './UnsupportedGroup';
import Metric from './Metric';

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
    } = this.props;
    const { name, result, details } = data;
    const { needInvestigation, intermittent, unsupported } = details;
    const needInvestigationLength = Object.keys(needInvestigation).length;

    return (
      <Metric
        name={name}
        result={result}
        expanded={expanded}
        setExpanded={setExpanded}
      >
        <div className="border-bottom border-secondary">
          <ClassificationGroup
            group={needInvestigation}
            name="Need Investigation"
            repo={repo}
            currentRepo={currentRepo}
            revision={revision}
            className="mb-5"
            headerColor={
              needInvestigationLength ? 'danger' : 'darker-secondary'
            }
            user={user}
            hasRetriggerAll
            notify={notify}
            searchStr={searchStr}
          />
          <ClassificationGroup
            group={intermittent}
            name="Known Intermittent"
            repo={repo}
            currentRepo={currentRepo}
            revision={revision}
            className="mb-5"
            headerColor="darker-secondary"
            expanded={false}
            user={user}
            notify={notify}
            searchStr={searchStr}
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
};
