import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Badge, Button, UncontrolledCollapse } from 'reactstrap';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown } from '@fortawesome/free-solid-svg-icons';

import Clipboard from '../shared/Clipboard';

import TestFailure from './TestFailure';

class GroupedTests extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      clipboardVisible: null,
    };
  }

  getGroupedTests = tests => {
    const { groupedBy } = this.props;

    return groupBy(tests, test => {
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

  setClipboardVisible = key => {
    this.setState({ clipboardVisible: key });
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
    const { clipboardVisible } = this.state;

    const groupedTests = this.getGroupedTests(group);
    const groupedArray = Object.entries(groupedTests).map(([key, tests]) => ({
      key,
      id: key.replace(/[^a-z0-9-]+/gi, ''), // make this a valid selector
      tests,
      failedInParent: tests.filter(item => item.failedInParent).length,
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
              <span
                className="d-flex border-top w-100 bg-light p-2 border-top-1 border-secondary justify-content-center rounded"
                onMouseEnter={() => this.setClipboardVisible(group.key)}
                onMouseLeave={() => this.setClipboardVisible(null)}
              >
                <Clipboard
                  text={group.key}
                  description="group text"
                  visible={clipboardVisible === group.key}
                />
                <Button
                  id={`group-${group.id}`}
                  className="text-center text-break text-wrap text-monospace border-0"
                  title="Click to expand for test detail"
                  outline
                >
                  {group.key === 'none' ? 'All' : group.key} -
                  <span className="ml-2 font-italic">
                    {group.tests.length} test{group.tests.length > 1 && 's'}
                  </span>
                  {!!group.failedInParent && (
                    <Badge color="info" className="mx-1">
                      {group.failedInParent} from parent
                    </Badge>
                  )}
                  <FontAwesomeIcon icon={faCaretDown} className="ml-1" />
                </Button>
              </span>

              <UncontrolledCollapse toggler={`group-${group.id}`}>
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
};

export default GroupedTests;
