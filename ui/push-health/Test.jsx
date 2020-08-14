import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import {
  Badge,
  Button,
  Collapse,
  Nav,
  Navbar,
  NavItem,
  UncontrolledButtonDropdown,
  ButtonGroup,
  DropdownMenu,
  DropdownToggle,
  DropdownItem,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretRight,
  faRedo,
} from '@fortawesome/free-solid-svg-icons';

import { create, destroy } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { investigatedTestsEndPoint } from '../helpers/url';
import JobModel from '../models/job';
import Clipboard from '../shared/Clipboard';
import { notify } from '../job-view/redux/stores/notifications';

import PlatformConfig from './PlatformConfig';

class Test extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      clipboardVisible: null,
      detailsShowing: false,
      selectedTests: new Set(),
    };
  }

  componentDidMount() {
    const { selectedTest, testGroup, test } = this.props;

    if (testGroup && selectedTest === test.id) {
      this.setState({ detailsShowing: true });
    }
  }

  addSelectedTest = (test) => {
    const { selectedTests } = this.state;
    selectedTests.add(test);
    this.setState({
      selectedTests,
    });
  };

  removeSelectedTest = (test) => {
    const { selectedTests } = this.state;
    selectedTests.delete(test);
    this.setState({
      selectedTests,
    });
  };

  retriggerSelected = (times) => {
    const { notify, currentRepo, jobs } = this.props;
    const { selectedTests } = this.state;

    // Reduce down to the unique jobs
    const testJobs = selectedTests.reduce(
      (acc, test) => ({
        ...acc,
        ...jobs[test.jobName].reduce((fjAcc, job) => ({ [job.id]: job }), {}),
      }),
      {},
    );
    const uniqueJobs = Object.values(testJobs);

    JobModel.retrigger(uniqueJobs, currentRepo, notify, times);
  };

  markAsInvestigated = () => {
    const { selectedTests } = this.state;
    const { currentRepo, revision } = this.props;

    let data;
    let failureStatus;
    selectedTests.forEach(async (test) => {
      ({ data, failureStatus } = await create(
        `${getProjectUrl(
          investigatedTestsEndPoint,
          currentRepo.name,
        )}?revision=${revision}`,
        {
          test: test.testName,
          jobName: test.jobName,
          jobSymbol: test.jobSymbol,
        },
      ));
      if (failureStatus) {
        notify(
          `Test ${test.testName} could not be marked as investigated`,
          'failure',
        );
      } else {
        selectedTests.delete(test);
        this.setState({ selectedTests });
        notify(`Test ${data}  marked as investigated`, 'success');
      }
    });
  };

  markAsUninvestigated = () => {
    const { selectedTests } = this.state;
    const { currentRepo, revision } = this.props;

    let data;
    let failureStatus;
    selectedTests.forEach(async (test) => {
      ({ data, failureStatus } = await destroy(
        `${getProjectUrl(
          `${investigatedTestsEndPoint}${test.investigatedTestId}/`,
          currentRepo.name,
        )}?revision=${revision}`,
      ));

      if (failureStatus) {
        notify(
          `Test ${test.testName} could not be marked as investigated`,
          'failure',
        );
      } else {
        selectedTests.delete(test);
        this.setState({ selectedTests });
        notify(`Test ${data}  marked as investigated`, 'failure');
      }
    });
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

  render() {
    const {
      test: { key, id, failedInParent, tests },
      revision,
      notify,
      currentRepo,
      groupedBy,
      jobs,
      selectedJobName,
      selectedTaskId,
      updateParamsAndState,
    } = this.props;
    const { clipboardVisible, detailsShowing, selectedTests } = this.state;

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
              className="text-break text-wrap border-0"
              title="Click to expand for test detail"
              outline
            >
              <FontAwesomeIcon
                icon={detailsShowing ? faCaretDown : faCaretRight}
                className="mr-2 min-width-1"
              />
              {key === 'none' ? 'All' : this.getGroupHtml(key)}
              <span className="ml-2">
                ({tests.length} failure{tests.length > 1 && 's'})
              </span>
              {!!failedInParent && (
                <Badge color="info" className="mx-1">
                  {failedInParent} from parent
                </Badge>
              )}
            </Button>
            <Clipboard
              text={key}
              description="group text"
              visible={clipboardVisible === key}
            />
          </span>

          <Collapse isOpen={detailsShowing}>
            <Navbar className="mb-4">
              <Nav>
                <NavItem>
                  <ButtonGroup size="sm" className="ml-5">
                    <Button
                      title="Retrigger selected jobs once"
                      onClick={() => this.retriggerSelected(1)}
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
                            onClick={() => this.retriggerSelected(times)}
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
                    onClick={() => this.markAsInvestigated()}
                  >
                    Mark as investigated
                  </Button>
                  <Button
                    size="sm"
                    outline
                    color="primary"
                    className="mx-3"
                    title="Mark selected jobs as Uninvestigated"
                    onClick={() => this.markAsUninvestigated()}
                  >
                    Mark as Uninvestigated
                  </Button>
                </NavItem>
              </Nav>
            </Navbar>
            {tests.map((failure) => (
              <PlatformConfig
                key={failure.key}
                failure={failure}
                jobs={jobs}
                currentRepo={currentRepo}
                revision={revision}
                notify={notify}
                groupedBy={groupedBy}
                selectedJobName={selectedJobName}
                selectedTaskId={selectedTaskId}
                updateParamsAndState={(stateObj) => {
                  stateObj.selectedTest = id;
                  updateParamsAndState(stateObj);
                }}
                className="ml-3"
                isTestSelected={selectedTests.has(failure)}
                addSelectedTest={this.addSelectedTest}
                removeSelectedTest={this.removeSelectedTest}
              />
            ))}
          </Collapse>
        </div>
      </div>
    );
  }
}

Test.propTypes = {
  test: PropTypes.shape({
    failedInParent: PropTypes.number.isRequired,
    key: PropTypes.string.isRequired,
    tests: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  groupedBy: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
};

export default Test;
