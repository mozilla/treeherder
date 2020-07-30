import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRedo } from '@fortawesome/free-solid-svg-icons';
import {
  ButtonGroup,
  ButtonDropdown,
  Button,
  DropdownMenu,
  DropdownToggle,
  DropdownItem,
  Navbar,
  Nav,
  NavItem,
  UncontrolledButtonDropdown,
} from 'reactstrap';
import groupBy from 'lodash/groupBy';

import JobModel from '../models/job';

import Action from './Action';

class ClassificationGroup extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      retriggerDropdownOpen: false,
    };
  }

  toggleRetrigger = () => {
    this.setState((prevState) => ({
      retriggerDropdownOpen: !prevState.retriggerDropdownOpen,
    }));
  };

  retriggerAll = (times) => {
    const { tests, notify, currentRepo, jobs } = this.props;
    // Reduce down to the unique jobs
    const testJobs = tests.reduce(
      (acc, test) => ({
        ...acc,
        ...jobs[test.jobName].reduce((fjAcc, job) => ({ [job.id]: job }), {}),
      }),
      {},
    );
    const uniqueJobs = Object.values(testJobs);

    JobModel.retrigger(uniqueJobs, currentRepo, notify, times);
  };

  getTestsByAction = (tests) => {
    const { log = [], crash = [], test = [] } = groupBy(tests, 'action');
    const byAction = {};

    if (log.length || crash.length) {
      byAction['Crashes (unknown path)'] = [...log, ...crash];
    }
    if (test.length) {
      byAction['Test Failures'] = test;
    }

    return byAction;
  };

  render() {
    const { retriggerDropdownOpen } = this.state;
    const {
      jobs,
      tests,
      revision,
      hasRetriggerAll,
      notify,
      currentRepo,
      groupedBy,
      orderedBy,
      testGroup,
      selectedTest,
      selectedJobName,
      selectedTaskId,
      setGroupedBy,
      setOrderedBy,
      updateParamsAndState,
    } = this.props;
    const groupLength = Object.keys(tests).length;
    const testsByAction = this.getTestsByAction(tests);

    return (
      <React.Fragment>
        {hasRetriggerAll && groupLength > 0 && (
          <Navbar className="m-4">
            <Nav>
              <NavItem>
                <ButtonGroup size="sm">
                  <Button
                    title="Retrigger all 'Need Investigation' jobs once"
                    onClick={() => this.retriggerAll(1)}
                    size="sm"
                  >
                    <FontAwesomeIcon
                      icon={faRedo}
                      title="Retrigger"
                      className="mr-2"
                      alt=""
                    />
                    Retrigger all
                  </Button>
                  <ButtonDropdown
                    isOpen={retriggerDropdownOpen}
                    toggle={this.toggleRetrigger}
                    size="sm"
                  >
                    <DropdownToggle caret />
                    <DropdownMenu>
                      {[5, 10, 15].map((times) => (
                        <DropdownItem
                          key={times}
                          title={`Retrigger all 'Need Investigation' jobs ${times} times`}
                          onClick={() => this.retriggerAll(times)}
                          className="pointable"
                          tag="a"
                        >
                          Retrigger all {times} times
                        </DropdownItem>
                      ))}
                    </DropdownMenu>
                  </ButtonDropdown>
                </ButtonGroup>
              </NavItem>
              <NavItem>
                <UncontrolledButtonDropdown size="sm" className="ml-1">
                  <DropdownToggle
                    className="btn-sm ml-1 text-capitalize"
                    id="groupTestsDropdown"
                    caret
                    outline
                    data-testid="groupTestsDropdown"
                  >
                    Group By: {groupedBy}
                  </DropdownToggle>
                  <DropdownMenu toggler="groupTestsDropdown">
                    <DropdownItem
                      className="pointable"
                      tag="a"
                      onClick={() => setGroupedBy('none')}
                    >
                      None
                    </DropdownItem>
                    <DropdownItem
                      className="pointable"
                      tag="a"
                      onClick={() => {
                        setGroupedBy('path');
                      }}
                    >
                      Path
                    </DropdownItem>
                    <DropdownItem
                      className="pointable"
                      tag="a"
                      onClick={() => setGroupedBy('platform')}
                    >
                      Platform
                    </DropdownItem>
                  </DropdownMenu>
                </UncontrolledButtonDropdown>
              </NavItem>
              <NavItem>
                <UncontrolledButtonDropdown size="sm" className="ml-1">
                  <DropdownToggle
                    className="btn-sm ml-1 text-capitalize"
                    id="groupTestsDropdown"
                    caret
                    outline
                  >
                    Order By: {orderedBy}
                  </DropdownToggle>
                  <DropdownMenu toggler="groupTestsDropdown">
                    <DropdownItem
                      className="pointable"
                      tag="a"
                      onClick={() => {
                        setOrderedBy('count');
                      }}
                    >
                      Count
                    </DropdownItem>
                    <DropdownItem
                      className="pointable"
                      tag="a"
                      onClick={() => {
                        setOrderedBy('text');
                      }}
                    >
                      Text
                    </DropdownItem>
                  </DropdownMenu>
                </UncontrolledButtonDropdown>
              </NavItem>
            </Nav>
          </Navbar>
        )}
        {Object.entries(testsByAction).map(([key, value]) => (
          <Action
            name={key}
            tests={value}
            groupedBy={groupedBy}
            orderedBy={orderedBy}
            revision={revision}
            currentRepo={currentRepo}
            notify={notify}
            key={key}
            jobs={jobs}
            testGroup={testGroup}
            selectedTest={selectedTest}
            selectedJobName={selectedJobName}
            selectedTaskId={selectedTaskId}
            updateParamsAndState={updateParamsAndState}
          />
        ))}
      </React.Fragment>
    );
  }
}

ClassificationGroup.propTypes = {
  tests: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  hasRetriggerAll: PropTypes.bool,
  orderedBy: PropTypes.string,
  groupedBy: PropTypes.string,
  setOrderedBy: PropTypes.func,
  setGroupedBy: PropTypes.func,
};

ClassificationGroup.defaultProps = {
  hasRetriggerAll: false,
  orderedBy: 'count',
  groupedBy: 'path',
  setOrderedBy: () => {},
  setGroupedBy: () => {},
};

export default ClassificationGroup;
