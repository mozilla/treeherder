import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Button, Collapse, Nav, Navbar, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretRight,
  faCheck,
} from '@fortawesome/free-solid-svg-icons';

import { create, destroy } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { investigatedTestsEndPoint } from '../helpers/url';
import { confirmFailure, canConfirmFailure } from '../helpers/job';
import Clipboard from '../shared/Clipboard';

import PlatformConfig from './PlatformConfig';
import TaskSelection from './TaskSelection';

class Test extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      clipboardVisible: null,
      detailsShowing: false,
      selectedTests: new Set(),
      allPlatformsSelected: false,
    };
  }

  componentDidMount() {
    const { selectedTest, testGroup, test } = this.props;

    if (testGroup && selectedTest === test.id) {
      this.setState({ detailsShowing: true });
    }
  }

  addSelectedTest = (test) => {
    this.setState((prevState) => ({
      selectedTests: prevState.selectedTests.add(test),
    }));
  };

  removeSelectedTest = (test) => {
    const { selectedTests } = this.state;
    selectedTests.delete(test);
    this.setState({
      selectedTests,
    });
  };

  confirmFailureSelected = () => {
    const { notify, currentRepo, jobs, decisionTaskMap } = this.props;
    const { selectedTests } = this.state;

    // Reduce down to the unique jobs that can have confirm-failure run
    const testJobs = Array.from(selectedTests)
      .filter((test) => test.isInvestigated)
      .reduce(
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

  markAsInvestigated = async () => {
    const { selectedTests } = this.state;
    const { notify, currentRepo, revision, updatePushHealth } = this.props;

    const projectUrl = `${getProjectUrl(
      investigatedTestsEndPoint,
      currentRepo.name,
    )}?revision=${revision}`;

    // TODO check if user is logged in, and if not log them in first
    // verify user is same user for this push before allowing this action
    if (selectedTests.size === 0) {
      notify(`Select at least one test`, 'warning');
    } else {
      const results = await Promise.all(
        [...selectedTests.entries()]
          .filter((test) => !test.isInvestigated)
          .map((test) =>
            create(projectUrl, {
              test: test.testName,
              jobName: test.jobName,
              jobSymbol: test.jobSymbol,
            }),
          ),
      );

      const firstFailed = results.find((test) => test.failureStatus);
      if (firstFailed) {
        notify(
          `Failed to update one or more tests: ${firstFailed.data}`,
          'warning',
        );
      }
      this.setState({ selectedTests: new Set() });
      updatePushHealth();
    }
  };

  markAsUninvestigated = async () => {
    const { selectedTests } = this.state;
    const { notify, currentRepo, revision, updatePushHealth } = this.props;

    if (selectedTests.size === 0) {
      notify(`Select at least one test`, 'warning');
    } else {
      const results = await Promise.all(
        [...selectedTests.entries()]
          .filter((test) => test.isInvestigated)
          .map((test) =>
            destroy(
              `${getProjectUrl(
                `${investigatedTestsEndPoint}${test.investigatedTestId}/`,
                currentRepo.name,
              )}?revision=${revision}`,
            ),
          ),
      );

      const firstFailed = results.find((test) => test.failureStatus);
      if (firstFailed) {
        notify(
          `Failed to update one or more tests: ${firstFailed.data}`,
          'warning',
        );
      }
      this.setState({ selectedTests: new Set() });
      updatePushHealth();
    }
  };

  setClipboardVisible = (key) => {
    this.setState({ clipboardVisible: key });
  };

  toggleDetails = () => {
    let { detailsShowing } = this.state;
    const { updateParamsAndState, test } = this.props;

    detailsShowing = !detailsShowing;
    if (detailsShowing) {
      updateParamsAndState({
        selectedTest: test.id,
        selectedTaskId: '',
      });
    }
    this.setState({
      detailsShowing,
    });
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

  selectAll = () => {
    const { tests } = this.props.test;
    const { allPlatformsSelected } = this.state;

    const newSelectedTests = allPlatformsSelected ? new Set() : new Set(tests);

    this.setState({
      allPlatformsSelected: !allPlatformsSelected,
      selectedTests: newSelectedTests,
    });
  };

  render() {
    const {
      test: { key, id, tests },
      revision,
      notify,
      currentRepo,
      groupedBy,
      jobs,
      selectedJobName,
      selectedTaskId,
      updateParamsAndState,
      decisionTaskMap,
    } = this.props;
    const {
      clipboardVisible,
      detailsShowing,
      allPlatformsSelected,
    } = this.state;

    return (
      <div>
        <div key={id} data-testid="test-grouping">
          <span
            className="d-flex w-100 p-2"
            onMouseEnter={() => this.setClipboardVisible(key)}
            onMouseLeave={() => this.setClipboardVisible(null)}
          >
            <Button
              onClick={this.toggleDetails}
              className="pe-0 text-left border-0"
              title="Click to expand for test detail"
              variant="outline"
            >
              <FontAwesomeIcon
                icon={detailsShowing ? faCaretDown : faCaretRight}
                className="me-2 min-width-1 mt-1"
              />
            </Button>
            <Button
              onClick={this.toggleDetails}
              className="text-left border-0"
              title="Click to expand for test detail"
              variant="outline"
            >
              {key === 'none' ? 'All' : this.getGroupHtml(key)}
              <span className="ms-2 text-break">
                ({tests.length} failure{tests.length > 1 && 's'})
              </span>
            </Button>
            <Clipboard
              text={key}
              description="group text"
              visible={clipboardVisible === key}
            />
          </span>

          <Collapse in={detailsShowing}>
            <div>
              <Navbar className="mb-3">
                <Nav>
                  <Nav.Item>
                    <Button
                      title="Confirm failures for selected jobs"
                      onClick={() => this.confirmFailureSelected()}
                      size="sm"
                      variant="secondary"
                      className="ms-5"
                    >
                      <FontAwesomeIcon
                        icon={faCheck}
                        title="Confirm Failure"
                        className="me-2"
                        alt=""
                      />
                      Confirm Failure Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="mx-3"
                      title="Mark selected jobs as investigated"
                      onClick={() => this.markAsInvestigated()}
                    >
                      Mark as investigated
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="mx-3"
                      title="Mark selected jobs as Uninvestigated"
                      onClick={() => this.markAsUninvestigated()}
                    >
                      Mark as Uninvestigated
                    </Button>
                  </Nav.Item>
                </Nav>
              </Navbar>
              <div className="mb-2 ms-4 ps-4">
                <Form.Check
                  type="checkbox"
                  id="select-all-platforms"
                  label="select all"
                  checked={allPlatformsSelected}
                  onChange={this.selectAll}
                  className="text-darker-secondary"
                  style={{ '--bs-form-check-label-margin-start': '1rem' }}
                />
              </div>
              {tests.map((failure) => (
                <PlatformConfig
                  key={failure.key}
                  testName={failure.testName}
                  jobName={failure.jobName}
                  jobs={jobs[failure.jobName]}
                  revision={revision}
                  notify={notify}
                  selectedJobName={selectedJobName}
                  selectedTaskId={selectedTaskId}
                  updateParamsAndState={(stateObj) => {
                    stateObj.selectedTest = id;
                    updateParamsAndState(stateObj);
                  }}
                  currentRepo={currentRepo}
                  decisionTaskMap={decisionTaskMap}
                >
                  <TaskSelection
                    failure={failure}
                    groupedBy={groupedBy}
                    addSelectedTest={this.addSelectedTest}
                    removeSelectedTest={this.removeSelectedTest}
                    allPlatformsSelected={allPlatformsSelected}
                    currentRepo={currentRepo}
                  />
                </PlatformConfig>
              ))}
            </div>
          </Collapse>
        </div>
      </div>
    );
  }
}

Test.propTypes = {
  test: PropTypes.shape({
    key: PropTypes.string.isRequired,
    tests: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  }).isRequired,
  groupedBy: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  decisionTaskMap: PropTypes.shape({}),
};

Test.defaultProps = {
  decisionTaskMap: {},
};

export default Test;
