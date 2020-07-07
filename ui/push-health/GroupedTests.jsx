import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Button,
  UncontrolledCollapse,
  Navbar,
  Nav,
  NavItem,
  ButtonGroup,
  UncontrolledButtonDropdown,
  DropdownMenu,
  DropdownToggle,
  DropdownItem,
} from 'reactstrap';
import groupBy from 'lodash/groupBy';
import orderBy from 'lodash/orderBy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCaretDown, faRedo } from '@fortawesome/free-solid-svg-icons';

import Clipboard from '../shared/Clipboard';
import JobModel from '../models/job';

import TestFailure from './TestFailure';

class GroupedTests extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      clipboardVisible: null,
      checkedJobs: [],
    };
  }

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

  addToCheckJob = (job) => {
    this.setState((prevState) => ({
      checkedJobs: [...prevState.checkedJobs, job],
    }));
  };

  removeFromCheckedJobs = (uncheckedJob) => {
    const index = this.state.checkedJobs.findIndex((job) => {
      return uncheckedJob === job;
    });
    const { checkedJobs } = this.state;
    checkedJobs.splice(index, 1);
    this.setState(checkedJobs);
  };

  retriggerSelected = (times, group) => {
    const { notify, currentRepo, revision } = this.props;
    // Reduce down to the unique jobs
    const jobs = group.tests.reduce((acc, test) => {
      if (
        this.state.checkedJobs.findIndex((job) => {
          return `${test.key}${revision}` === job;
        }) >= 0
      )
        return {
          ...acc,
          ...test.failJobs.reduce((fjAcc, fJob) => ({ [fJob.id]: fJob }), {}),
        };
      return acc;
    }, {});
    const uniqueJobs = Object.values(jobs);
    if (uniqueJobs.length > 0)
      JobModel.retrigger(uniqueJobs, currentRepo, notify, times);
    else notify('Select atleast one job to retrigger', 'warning');
  };

  markAsInvestigated = (group) => {
    const { notify, revision } = this.props;
    group.tests.forEach((test) => {
      if (
        this.state.checkedJobs.findIndex((job) => {
          return `${test.key}${revision}` === job;
        }) >= 0
      ) {
        localStorage.setItem(`${test.key}${revision}`, JSON.stringify(true));
      }
    });
    notify('Marked selected jobs as investigated', 'success');
  };

  setClipboardVisible = (key) => {
    this.setState({ clipboardVisible: key });
  };

  getGroupHtml = (text) => {
    const splitter = text.includes('/') ? '/' : ':';
    const parts = text.split(splitter);

    if (splitter === '/') {
      const bolded = parts.pop();

      return (
        <span>
          {parts.join(splitter)}
          {splitter}
          <strong data-testid="group-slash-bolded">{bolded}</strong>
        </span>
      );
    }

    const bolded = parts.shift();

    return (
      <span>
        <strong data-testid="group-colon-bolded">{bolded}</strong>
        {splitter}
        {parts.join(splitter)}
      </span>
    );
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
    const { clipboardVisible } = this.state;

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
      <div>
        {groupedTests &&
          sortedGroups.map((group) => (
            <div key={group.id} data-testid="test-grouping">
              <span
                className="d-flex w-100 p-2"
                onMouseEnter={() => this.setClipboardVisible(group.key)}
                onMouseLeave={() => this.setClipboardVisible(null)}
              >
                <Button
                  id={`group-${group.id}`}
                  className="text-break text-wrap border-0"
                  title="Click to expand for test detail"
                  outline
                >
                  <FontAwesomeIcon icon={faCaretDown} className="mr-2" />
                  {group.key === 'none' ? 'All' : this.getGroupHtml(group.key)}
                  <span className="ml-2">
                    ({group.tests.length} failure{group.tests.length > 1 && 's'}
                    )
                  </span>
                  {!!group.failedInParent && (
                    <Badge color="info" className="mx-1">
                      {group.failedInParent} from parent
                    </Badge>
                  )}
                </Button>
                <Clipboard
                  text={group.key}
                  description="group text"
                  visible={clipboardVisible === group.key}
                />
              </span>

              <UncontrolledCollapse toggler={`group-${group.id}`}>
                <Navbar className="mb-4">
                  <Nav>
                    <NavItem>
                      <ButtonGroup size="sm" className="ml-5">
                        <Button
                          title="Retrigger selected jobs once"
                          onClick={() => this.retriggerSelected(1, group)}
                          size="sm"
                        >
                          <FontAwesomeIcon
                            icon={faRedo}
                            title="Retrigger"
                            className="mr-2"
                            alt=""
                          />
                          Retrigger Selected
                        </Button>
                        <UncontrolledButtonDropdown size="sm">
                          <DropdownToggle caret />
                          <DropdownMenu>
                            {[5, 10, 15].map((times) => (
                              <DropdownItem
                                key={times}
                                title={`Retrigger selected jobs ${times} times`}
                                onClick={() =>
                                  this.retriggerSelected(times, group)
                                }
                                className="pointable"
                                tag="a"
                              >
                                Retrigger selected {times} times
                              </DropdownItem>
                            ))}
                          </DropdownMenu>
                        </UncontrolledButtonDropdown>
                      </ButtonGroup>
                      <Button
                        size="sm"
                        outline
                        color="primary"
                        className="mx-3"
                        title="Mark selected jobs as investigated"
                        onClick={() => this.markAsInvestigated(group)}
                      >
                        Mark as investigated
                      </Button>
                    </NavItem>
                  </Nav>
                </Navbar>
                {group.tests.map((failure) => (
                  <TestFailure
                    key={failure.key}
                    failure={failure}
                    repo={repo}
                    addToCheckJob={this.addToCheckJob}
                    removeFromCheckedJobs={this.removeFromCheckedJobs}
                    currentRepo={currentRepo}
                    revision={revision}
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
  group: PropTypes.arrayOf(PropTypes.object).isRequired,
  groupedBy: PropTypes.string.isRequired,
  orderedBy: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  repo: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
};

export default GroupedTests;
