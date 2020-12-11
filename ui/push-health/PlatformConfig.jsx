import React from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col, Input } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRedo } from '@fortawesome/free-solid-svg-icons';
import sortBy from 'lodash/sortBy';

import JobModel from '../models/job';
import { addAggregateFields } from '../helpers/job';
import { shortDateFormat } from '../helpers/display';
import SimpleTooltip from '../shared/SimpleTooltip';

import { taskResultColorMap } from './helpers';
import DetailsPanel from './details/DetailsPanel';

class PlatformConfig extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: false,
      selectedTask: null,
      isTestSelected: false,
    };
  }

  componentDidMount() {
    const {
      selectedJobName,
      selectedTaskId,
      jobs,
      failure: { jobName, testName },
    } = this.props;

    this.setState({
      detailsShowing: selectedJobName === `${testName} ${jobName}`,
      selectedTask: selectedTaskId
        ? jobs[jobName].filter((job) => job.id === parseInt(selectedTaskId, 10))
            .length > 0 &&
          jobs[jobName].filter(
            (job) => job.id === parseInt(selectedTaskId, 10),
          )[0]
        : null,
    });
  }

  componentWillReceiveProps() {
    const { selectedTests, failure } = this.props;
    this.setState({
      isTestSelected: selectedTests.has(failure),
    });
  }

  setSelectedTask = (task) => {
    const { selectedTask } = this.state;
    const {
      failure: { jobName, testName },
    } = this.props;

    if (selectedTask === task || !task) {
      this.setState({ selectedTask: null, detailsShowing: false });
    } else {
      this.props.updateParamsAndState({
        selectedTaskId: task.id,
        selectedJobName: `${testName} ${jobName}`,
      });
      this.setState({ selectedTask: task, detailsShowing: true });
    }
  };

  selectTest = (e) => {
    const { addSelectedTest, removeSelectedTest, failure } = this.props;

    if (e.target.checked) addSelectedTest(failure);
    else removeSelectedTest(failure);
    this.setState((prevState) => ({
      isTestSelected: !prevState.isTestSelected,
    }));
  };

  retriggerTask = async (task) => {
    const { notify, currentRepo } = this.props;

    JobModel.retrigger([task], currentRepo, notify);
  };

  render() {
    const { failure, groupedBy, currentRepo, jobs } = this.props;
    const {
      testName,
      jobName,
      key,
      tier,
      jobGroupSymbol,
      jobSymbol,
      isInvestigated,
    } = failure;
    const testJobs = jobs[jobName];
    const { detailsShowing, selectedTask, isTestSelected } = this.state;
    const taskList = sortBy(testJobs, ['start_time']);
    taskList.forEach((task) => addAggregateFields(task));

    return (
      <Row
        className="ml-5 pt-2 mr-1"
        key={key}
        style={{ background: '#f2f2f2' }}
      >
        <Row className="ml-2 w-100 mb-2 justify-content-between">
          <Col xs="auto">
            <Input
              type="checkbox"
              checked={isTestSelected}
              onChange={this.selectTest}
              title="Select Test"
            />
          </Col>
          <Col>
            <Row>
              <span
                id={key}
                className={`px-2 text-darker-secondary font-weight-500 ${
                  isInvestigated && 'investigated'
                }`}
              >
                <span>{groupedBy !== 'path' && `${testName} `}</span>
                <span>{jobName}</span>
                {tier > 1 && (
                  <span className="ml-1 small text-muted">[tier-{tier}]</span>
                )}
              </span>
            </Row>
          </Col>
          <Col className="ml-2">
            {taskList.map((task, idx) => {
              const { id, result, state, start_time: startTime } = task;
              const isSelected = selectedTask && selectedTask.id === id;
              return (
                <span key={id} className="mr-3">
                  <SimpleTooltip
                    text={
                      <Button
                        className="py-0"
                        color={`${taskResultColorMap[result]} ${
                          !isSelected && 'bg-white bg-hover-grey'
                        }`}
                        outline={!isSelected}
                        size="sm"
                        onClick={() => this.setSelectedTask(task)}
                      >
                        task {idx > 0 ? idx + 1 : ''}
                      </Button>
                    }
                    tooltipText={
                      <span className="text-nowrap flex">
                        {`${
                          state === 'completed' ? result : state
                        } - ${jobGroupSymbol}(${jobSymbol}) - ${new Date(
                          startTime,
                        ).toLocaleString('en-US', shortDateFormat)}`}
                        <br />
                        Click to see failure lines and artifacts
                      </span>
                    }
                    innerClassName="custom-tooltip-width"
                  />
                </span>
              );
            })}
            <Button
              onClick={() => this.retriggerTask(taskList[0])}
              outline
              className="mr-2 border-0"
              title="Retrigger task"
              style={{ lineHeight: '10px' }}
            >
              <FontAwesomeIcon icon={faRedo} />
            </Button>
          </Col>
        </Row>
        {detailsShowing && (
          <Row className="mx-3 w-100">
            <DetailsPanel
              selectedTask={selectedTask}
              currentRepo={currentRepo}
              closeDetails={() => this.setSelectedTask()}
            />
          </Row>
        )}
      </Row>
    );
  }
}

PlatformConfig.propTypes = {
  failure: PropTypes.shape({
    testName: PropTypes.string.isRequired,
    jobName: PropTypes.string.isRequired,
    jobSymbol: PropTypes.string.isRequired,
    confidence: PropTypes.number.isRequired,
    platform: PropTypes.string.isRequired,
    config: PropTypes.string.isRequired,
    suggestedClassification: PropTypes.string.isRequired,
    key: PropTypes.string.isRequired,
  }).isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  groupedBy: PropTypes.string.isRequired,
  updateParamsAndState: PropTypes.func.isRequired,
};

export default PlatformConfig;
