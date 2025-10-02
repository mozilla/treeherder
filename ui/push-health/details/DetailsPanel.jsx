import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { Col, Button, Spinner } from 'react-bootstrap';

import { getArtifactsUrl, getLogViewerUrl } from '../../helpers/url';
import { formatArtifacts } from '../../helpers/display';
import { addAggregateFields } from '../../helpers/job';
import { getData } from '../../helpers/http';
import JobModel from '../../models/job';
import LogviewerTab from '../../shared/tabs/LogviewerTab';
import FailureSummaryTab from '../../shared/tabs/failureSummary/FailureSummaryTab';
import JobArtifacts from '../../shared/JobArtifacts';

class DetailsPanel extends React.Component {
  constructor(props) {
    super(props);

    // used to cancel all the ajax requests triggered by selectTask
    this.selectTaskController = null;

    this.state = {
      selectedTaskFull: null,
      taskDetails: [],
      taskDetailLoading: false,
      tabIndex: 0,
    };
  }

  componentDidMount() {
    const { selectedTask } = this.props;

    if (selectedTask) {
      this.selectTask(selectedTask);
    }
  }

  componentDidUpdate(prevProps) {
    const { selectedTask } = this.props;

    if (selectedTask && prevProps.selectedTask) {
      const {
        id: prevId,
        state: prevState,
        result: prevResult,
        failure_classification_id: prevFci,
      } = prevProps.selectedTask;
      const {
        id,
        state,
        result,
        failure_classification_id: fci,
      } = selectedTask;

      // Check the id in case the user switched to a new task.
      // But also check some of the fields of the selected task,
      // in case they have changed due to polling.
      if (
        prevId !== id ||
        prevState !== state ||
        prevResult !== result ||
        prevFci !== fci
      ) {
        this.selectTask();
      }
    } else if (selectedTask && selectedTask !== prevProps.selectedTask) {
      this.selectTask();
    }
  }

  setTabIndex = (tabIndex) => {
    this.setState({ tabIndex });
  };

  selectTask = async () => {
    const { currentRepo, selectedTask } = this.props;
    this.setState({ taskDetails: [], taskDetailLoading: true }, () => {
      if (this.selectTaskController !== null) {
        // Cancel the in-progress fetch requests.
        this.selectTaskController.abort();
      }

      this.selectTaskController = new AbortController();

      const taskPromise = JobModel.get(
        currentRepo.name,
        selectedTask.id,
        this.selectTaskController.signal,
      );
      const artifactsParams = {
        jobId: selectedTask.id,
        taskId: selectedTask.task_id,
        run: selectedTask.run_id,
        rootUrl: currentRepo.tc_root_url,
      };
      const artifactsPromise = getData(
        getArtifactsUrl(artifactsParams),
        this.selectTaskController.signal,
      );
      let builtFromArtifactPromise;

      if (
        currentRepo.name === 'comm-central' ||
        currentRepo.name === 'try-comm-central'
      ) {
        builtFromArtifactPromise = getData(
          getArtifactsUrl({
            ...artifactsParams,
            ...{ artifactPath: 'public/build/built_from.json' },
          }),
        );
      }

      Promise.all([taskPromise, artifactsPromise, builtFromArtifactPromise])
        .then(
          async ([taskResult, artifactsResult, builtFromArtifactResult]) => {
            const selectedTaskFull = taskResult;

            addAggregateFields(selectedTaskFull);

            let taskDetails = artifactsResult.data.artifacts
              ? formatArtifacts(artifactsResult.data.artifacts, {
                  ...artifactsParams,
                })
              : [];

            if (
              builtFromArtifactResult &&
              !builtFromArtifactResult.failureStatus
            ) {
              taskDetails = [...taskDetails, ...builtFromArtifactResult.data];
            }

            this.setState({
              selectedTaskFull,
              taskDetails,
              taskDetailLoading: false,
            });
          },
        )
        .finally(() => {
          this.selectTaskController = null;
        });
    });
  };

  render() {
    const { currentRepo, closeDetails } = this.props;
    const {
      selectedTaskFull,
      taskDetails,
      taskDetailLoading,
      tabIndex,
    } = this.state;

    return (
      <div className="w-100">
        {taskDetailLoading && <Spinner />}
        {!!selectedTaskFull && !taskDetailLoading && (
          <div role="region" aria-label="Task" className="d-flex ms-5">
            <Tabs
              selectedIndex={tabIndex}
              onSelect={this.setTabIndex}
              className="w-100 h-100 ms-1 me-5 mb-2 border p-3 bg-white"
              selectedTabClassName="selected-detail-tab"
            >
              <TabList className="ps-0 w-100 list-inline">
                <span className="d-flex justify-content-between w-100">
                  <span>
                    <Tab className="font-weight-bold text-secondary list-inline-item">
                      Failure Summary
                    </Tab>
                    <Tab className="ms-3 font-weight-bold text-secondary list-inline-item pointable">
                      Log Viewer
                    </Tab>
                    <Tab className="ms-3 font-weight-bold text-secondary list-inline-item pointable">
                      Artifacts and Debugging Tools
                    </Tab>
                  </span>
                  <Button
                    onClick={closeDetails}
                    variant="outline"
                    className="border-0"
                    title="Close details view of this task"
                  >
                    <FontAwesomeIcon icon={faTimes} className="me-1" />
                  </Button>
                </span>
              </TabList>
              <div className="w-100 tab-content">
                <TabPanel>
                  <FailureSummaryTab
                    selectedJob={selectedTaskFull}
                    selectedJobId={selectedTaskFull.id}
                    jobLogUrls={selectedTaskFull.logs}
                    logParseStatus="unknown"
                    logViewerFullUrl={getLogViewerUrl(
                      selectedTaskFull.id,
                      currentRepo.name,
                    )}
                    currentRepo={currentRepo}
                    developerMode
                  />
                </TabPanel>
                <TabPanel>
                  <LogviewerTab
                    selectedTaskFull={selectedTaskFull}
                    repoName={currentRepo.name}
                  />
                </TabPanel>
                <TabPanel className="overflow-auto h-100">
                  <Col className="ms-2">
                    <JobArtifacts
                      jobDetails={taskDetails}
                      repoName={currentRepo.name}
                      selectedJob={selectedTaskFull}
                    />
                  </Col>
                </TabPanel>
              </div>
            </Tabs>
          </div>
        )}
      </div>
    );
  }
}

DetailsPanel.propTypes = {
  currentRepo: PropTypes.shape({}).isRequired,
  closeDetails: PropTypes.func.isRequired,
  selectedTask: PropTypes.shape({}),
};

DetailsPanel.defaultProps = {
  selectedTask: null,
};

export default DetailsPanel;
