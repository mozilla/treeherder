import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretRight,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';
import {
  Row,
  Collapse,
  DropdownButton,
  Button,
  Dropdown,
} from 'react-bootstrap';
import groupBy from 'lodash/groupBy';

import { confirmFailure, canConfirmFailure } from '../helpers/job';

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

  confirmFailureAll = () => {
    const { tests, notify, currentRepo, jobs, decisionTaskMap } = this.props;
    // Reduce down to the unique jobs that can have confirm-failure run
    const testJobs = tests.reduce(
      (acc, test) => ({
        ...acc,
        ...jobs[test.jobName].reduce((fjAcc, job) => {
          if (canConfirmFailure(job)) {
            return { ...fjAcc, [job.id]: job };
          }
          return fjAcc;
        }, {}),
      }),
      {},
    );
    const uniqueJobs = Object.values(testJobs);

    // Call confirmFailure for each unique job
    uniqueJobs.forEach((job) => {
      confirmFailure(job, notify, decisionTaskMap, currentRepo);
    });
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
      decisionTaskMap,
    } = this.props;
    const expandIcon = detailsShowing ? faCaretDown : faCaretRight;
    const expandTitle = detailsShowing
      ? 'Click to collapse'
      : 'Click to expand';
    // Count unique test cases (by testName), regardless of platform/config
    const uniqueTestNames = new Set(tests.map((test) => test.testName));
    const groupLength = uniqueTestNames.size;
    const testsByAction = this.getTestsByAction(tests);

    return (
      <Row
        className={`justify-content-between ${className || ''}`}
        data-testid="classification-group"
      >
        <span className="font-size-24">
          <Button
            onClick={this.toggleDetails}
            variant="outline"
            className="font-size-24 border-0"
            role="button"
            aria-expanded={detailsShowing}
          >
            <FontAwesomeIcon
              icon={expandIcon}
              className="me-1 min-width-1"
              title={expandTitle}
              aria-label={expandTitle}
              alt=""
            />
            <FontAwesomeIcon icon={icon} className={`me-2 text-${iconColor}`} />
            {name} ({groupLength})
          </Button>
        </span>
        {hasRetriggerAll && groupLength > 0 && detailsShowing && (
          <div className="mb-4 d-flex gap-2">
            <Button
              title="Confirm failures for all 'Need Investigation' jobs"
              onClick={() => this.confirmFailureAll()}
              size="sm"
              variant="secondary"
            >
              <FontAwesomeIcon
                icon={faCheck}
                title="Confirm Failure"
                className="me-2"
                alt=""
              />
              Confirm Failure all
            </Button>
            <DropdownButton
              size="sm"
              className="ms-1"
              title={`Group By: ${groupedBy}`}
              variant="outline-secondary"
              id="groupTestsDropdown"
              data-testid="groupTestsDropdown"
            >
              <Dropdown.Item
                className="pointable"
                onClick={() => setGroupedBy('none')}
              >
                None
              </Dropdown.Item>
              <Dropdown.Item
                className="pointable"
                onClick={() => {
                  setGroupedBy('path');
                }}
              >
                Path
              </Dropdown.Item>
              <Dropdown.Item
                className="pointable"
                onClick={() => setGroupedBy('platform')}
              >
                Platform
              </Dropdown.Item>
            </DropdownButton>
            <DropdownButton
              size="sm"
              className="ms-1"
              title={`Order By: ${orderedBy}`}
              variant="outline-secondary"
              id="orderTestsDropdown"
            >
              <Dropdown.Item
                className="pointable"
                onClick={() => {
                  setOrderedBy('count');
                }}
              >
                Count
              </Dropdown.Item>
              <Dropdown.Item
                className="pointable"
                onClick={() => {
                  setOrderedBy('text');
                }}
              >
                Text
              </Dropdown.Item>
            </DropdownButton>
          </div>
        )}
        <Collapse in={detailsShowing} className="w-100">
          <div>
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
                  decisionTaskMap={decisionTaskMap}
                />
              ))}
          </div>
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
  decisionTaskMap: PropTypes.shape({}),
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
  decisionTaskMap: {},
};

export default ClassificationGroup;
