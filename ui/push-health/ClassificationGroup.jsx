import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretRight,
  faRedo,
} from '@fortawesome/free-solid-svg-icons';
import {
  Row,
  Collapse,
  ButtonGroup,
  DropdownButton,
  Button,
  Dropdown,
  Navbar,
  Nav,
} from 'react-bootstrap';
import groupBy from 'lodash/groupBy';

import JobModel from '../models/job';

import Action from './Action';

class ClassificationGroup extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: props.expanded,
      retriggerDropdownOpen: false,
    };
  }

  toggleDetails = () => {
    const { updateParamsAndState, name } = this.props;

    updateParamsAndState({
      testGroup: name === 'Possible Regressions' ? 'pr' : 'ki',
    });
    this.setState((prevState) => ({
      detailsShowing: !prevState.detailsShowing,
    }));
  };

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
    const { log, crash, test } = groupBy(tests, 'action');
    const categories = [];

    if (test) {
      categories.push(['Test Failures', test]);
    }

    if (log || crash) {
      categories.push([
        'Crashes (unknown path)',
        [...(log || []), ...(crash || [])],
      ]);
    }

    return categories;
  };

  render() {
    const { detailsShowing, retriggerDropdownOpen } = this.state;
    const {
      jobs,
      tests,
      name,
      revision,
      className,
      hasRetriggerAll,
      notify,
      currentRepo,
      icon,
      iconColor,
      groupedBy,
      orderedBy,
      testGroup,
      selectedTest,
      selectedJobName,
      selectedTaskId,
      setGroupedBy,
      setOrderedBy,
      updateParamsAndState,
      investigateTest,
      unInvestigateTest,
      updatePushHealth,
    } = this.props;
    const expandIcon = detailsShowing ? faCaretDown : faCaretRight;
    const expandTitle = detailsShowing
      ? 'Click to collapse'
      : 'Click to expand';
    const groupLength = Object.keys(tests).length;
    const testsByAction = this.getTestsByAction(tests);

    return (
      <Row
        className={`justify-content-between ${className}`}
        data-testid="classification-group"
      >
        <span className="font-size-24">
          <Button
            onClick={this.toggleDetails}
            outline
            className="font-size-24 border-0"
            role="button"
            aria-expanded={detailsShowing}
          >
            <FontAwesomeIcon
              icon={expandIcon}
              className="mr-1 min-width-1"
              title={expandTitle}
              aria-label={expandTitle}
              alt=""
            />
            <FontAwesomeIcon icon={icon} className={`mr-2 text-${iconColor}`} />
            {name} ({groupLength})
          </Button>
        </span>
        {hasRetriggerAll && groupLength > 0 && detailsShowing && (
          <Navbar className="mb-4">
            <Nav>
              <Nav.Item>
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
                  <DropdownButton
                    isOpen={retriggerDropdownOpen}
                    toggle={this.toggleRetrigger}
                    size="sm"
                  >
                    <Dropdown.Toggle caret />
                    <Dropdown.Menu>
                      {[5, 10, 15].map((times) => (
                        <Dropdown.Item
                          key={times}
                          title={`Retrigger all 'Need Investigation' jobs ${times} times`}
                          onClick={() => this.retriggerAll(times)}
                          className="pointable"
                          tag="a"
                        >
                          Retrigger all {times} times
                        </Dropdown.Item>
                      ))}
                    </Dropdown.Menu>
                  </DropdownButton>
                </ButtonGroup>
              </Nav.Item>
              <Nav.Item>
                <DropdownButton size="sm" className="ml-1">
                  <Dropdown.Toggle
                    className="btn-sm ml-1 text-capitalize"
                    id="groupTestsDropdown"
                    caret
                    outline
                    data-testid="groupTestsDropdown"
                  >
                    Group By: {groupedBy}
                  </Dropdown.Toggle>
                  <Dropdown.Menu toggler="groupTestsDropdown">
                    <Dropdown.Item
                      className="pointable"
                      tag="a"
                      onClick={() => setGroupedBy('none')}
                    >
                      None
                    </Dropdown.Item>
                    <Dropdown.Item
                      className="pointable"
                      tag="a"
                      onClick={() => {
                        setGroupedBy('path');
                      }}
                    >
                      Path
                    </Dropdown.Item>
                    <Dropdown.Item
                      className="pointable"
                      tag="a"
                      onClick={() => setGroupedBy('platform')}
                    >
                      Platform
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </DropdownButton>
              </Nav.Item>
              <Nav.Item>
                <DropdownButton size="sm" className="ml-1">
                  <Dropdown.Toggle
                    className="btn-sm ml-1 text-capitalize"
                    id="groupTestsDropdown"
                    caret
                    outline
                  >
                    Order By: {orderedBy}
                  </Dropdown.Toggle>
                  <Dropdown.Menu toggler="groupTestsDropdown">
                    <Dropdown.Item
                      className="pointable"
                      tag="a"
                      onClick={() => {
                        setOrderedBy('count');
                      }}
                    >
                      Count
                    </Dropdown.Item>
                    <Dropdown.Item
                      className="pointable"
                      tag="a"
                      onClick={() => {
                        setOrderedBy('text');
                      }}
                    >
                      Text
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </DropdownButton>
              </Nav.Item>
            </Nav>
          </Navbar>
        )}
        <Collapse isOpen={detailsShowing} className="w-100">
          {testsByAction.length > 0 &&
            testsByAction.map(([key, value]) => (
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
                investigateTest={investigateTest}
                unInvestigateTest={unInvestigateTest}
                updatePushHealth={updatePushHealth}
              />
            ))}
        </Collapse>
      </Row>
    );
  }
}

ClassificationGroup.propTypes = {
  tests: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  name: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  revision: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
  hasRetriggerAll: PropTypes.bool,
  expanded: PropTypes.bool,
  className: PropTypes.string,
  iconColor: PropTypes.string,
  orderedBy: PropTypes.string,
  groupedBy: PropTypes.string,
  setOrderedBy: PropTypes.func,
  setGroupedBy: PropTypes.func,
};

ClassificationGroup.defaultProps = {
  expanded: true,
  className: '',
  iconColor: 'darker-info',
  hasRetriggerAll: false,
  orderedBy: 'count',
  groupedBy: 'path',
  setOrderedBy: () => {},
  setGroupedBy: () => {},
};

export default ClassificationGroup;
