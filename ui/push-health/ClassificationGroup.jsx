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
  Button,
  Navbar,
  Nav,
  NavItem,
  UncontrolledButtonDropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
} from 'reactstrap';
import groupBy from 'lodash/groupBy';

import JobModel from '../models/job';

import Action from './Action';

class ClassificationGroup extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: props.expanded,
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
    const { detailsShowing } = this.state;
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
            tabIndex={-1}
            style={{ boxShadow: 'none', outline: 'none' }}
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
              <NavItem>
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
                    id="orderTestsDropdown"
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
