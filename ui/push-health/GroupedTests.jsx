import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';

import IndividualTests from './IndividualTests';

class GroupedTests extends PureComponent {
  getGroupedTests = (tests) => {
    const { groupedBy } = this.props;

    return groupBy(tests, (test) => {
      switch (groupedBy) {
        case 'none':
          return 'none';
        case 'path':
          return test.testName;
        case 'platform':
          return `${test.platform} ${test.config}`;
      }
    });
  };

  render() {
    const {
      group,
      repo,
      revision,
      notify,
      currentRepo,
      orderedBy,
      groupedBy,
    } = this.props;

    const groupedTests = this.getGroupedTests(group);
    const groupedArray = Object.entries(groupedTests).map(([key, tests]) => ({
      key,
      id: key.replace(/[^a-z0-9-]+/gi, ''), // make this a valid selector
      tests,
      failedInParent: tests.filter((item) => item.failedInParent).length,
    }));
    const sortedGroups =
      orderedBy === 'count'
        ? orderBy(groupedArray, ['tests.length'], ['desc'])
        : orderBy(groupedArray, ['key'], ['asc']);

    return (
      <React.Fragment>
        {groupedTests &&
          sortedGroups.map((group) => (
            <div key={group.id} data-testid="test-grouping">
              <IndividualTests
                group={group}
                repo={repo}
                revision={revision}
                notify={notify}
                currentRepo={currentRepo}
                groupedBy={groupedBy}
              />
            </div>
          ))}
      </React.Fragment>
    );
  }
}

GroupedTests.propTypes = {
  group: PropTypes.arrayOf(PropTypes.object).isRequired,
  groupedBy: PropTypes.string.isRequired,
  orderedBy: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
};

export default GroupedTests;
