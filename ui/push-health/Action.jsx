import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';

import Test from './Test';

class Action extends PureComponent {
  getTestGroups(tests) {
    const { groupedBy, orderedBy } = this.props;
    const groupedTests = groupBy(tests, (test) => {
      switch (groupedBy) {
        case 'none':
          return 'none';
        case 'path':
          return `${test.testName}`.trim();
        case 'platform':
          return `${test.platform} ${test.config}`;
      }
    });
    const groupedArray = Object.entries(groupedTests).map(([key, tests]) => ({
      key,
      id: key.replace(/[^a-z0-9-]+/gi, ''), // make this a valid selector
      tests,
    }));

    return orderedBy === 'count'
      ? orderBy(groupedArray, ['tests.length', 'key'], ['desc'])
      : orderBy(groupedArray, ['key', 'tests.length'], ['asc']);
  }

  render() {
    const {
      name,
      tests,
      groupedBy,
      revision,
      currentRepo,
      notify,
      jobs,
      testGroup,
      selectedJobName,
      selectedTest,
      selectedTaskId,
      updateParamsAndState,
      investigateTest,
      unInvestigateTest,
      updatePushHealth,
    } = this.props;
    const groupedTests = this.getTestGroups(tests);

    return (
      <div className="ml-4 mt-2">
        <h5>{name}</h5>
        {groupedTests.map((test) => (
          <div key={test.key}>
            <Test
              test={test}
              groupedBy={groupedBy}
              revision={revision}
              currentRepo={currentRepo}
              notify={notify}
              jobs={jobs}
              selectedJobName={selectedJobName}
              selectedTest={selectedTest}
              testGroup={testGroup}
              selectedTaskId={selectedTaskId}
              updateParamsAndState={updateParamsAndState}
              investigateTest={investigateTest}
              unInvestigateTest={unInvestigateTest}
              updatePushHealth={updatePushHealth}
            />
          </div>
        ))}
      </div>
    );
  }
}

Action.propTypes = {
  name: PropTypes.string.isRequired,
  tests: PropTypes.arrayOf(PropTypes.object).isRequired,
  groupedBy: PropTypes.string.isRequired,
  orderedBy: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
};

export default Action;
