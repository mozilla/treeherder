import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, UncontrolledCollapse } from 'reactstrap';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';

import TestFailure from './TestFailure';
import { filterTests } from './helpers';

class GroupedTests extends Component {
  getGroupedTests = tests => {
    const { groupedBy, searchStr } = this.props;
    const filteredTests = searchStr.length
      ? filterTests(tests, searchStr)
      : tests;
    const grouped = groupBy(filteredTests, test => {
      switch (groupedBy) {
        case 'none':
          return 'none';
        case 'path':
          return test.testName;
        case 'platform':
          return `${test.platform} ${test.config}`;
      }
    });

    return grouped;
  };

  render() {
    const {
      group,
      repo,
      revision,
      user,
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
    }));
    const sortedGroups =
      orderedBy === 'count'
        ? orderBy(groupedArray, ['tests.length'], ['desc'])
        : orderBy(groupedArray, ['key'], ['asc']);

    return (
      <div>
        {groupedTests &&
          sortedGroups.map(group => (
            <div key={group.id} data-testid="test-grouping">
              <Button
                id={`${group.id}-group`}
                color="darker-secondary"
                outline
                className="p-3 bg-light text-center text-monospace border-bottom-0 border-right-0 border-left-0 border-secondary w-100"
                title="Click to expand for test detail"
              >
                {group.key === 'none' ? 'All' : group.key} -
                <span className="ml-2 font-italic">
                  {group.tests.length} test{group.tests.length > 1 && 's'}
                </span>
                <FontAwesomeIcon icon={faCaretDown} className="ml-1" />
              </Button>
              <UncontrolledCollapse toggler={`${group.id}-group`}>
                {group.tests.map(failure => (
                  <TestFailure
                    key={failure.key}
                    failure={failure}
                    repo={repo}
                    currentRepo={currentRepo}
                    revision={revision}
                    user={user}
                    notify={notify}
                    groupedBy={groupedBy}
                    className="ml-3"
                  />
                ))}
              </UncontrolledCollapse>
            </div>
          ))}
      </div>
    );
  }
}

GroupedTests.propTypes = {
  group: PropTypes.array.isRequired,
  groupedBy: PropTypes.string.isRequired,
  orderedBy: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.object.isRequired,
  user: PropTypes.object.isRequired,
  notify: PropTypes.func.isRequired,
  searchStr: PropTypes.string.isRequired,
};

export default GroupedTests;
