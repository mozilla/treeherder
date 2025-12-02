import React from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import sortBy from 'lodash/sortBy';

import {
  addAggregateFields,
  confirmFailure,
  canConfirmFailure,
} from '../helpers/job';
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
    };
  }

  componentDidMount() {
    const {
      selectedJobName,
      selectedTaskId,
      jobs,
      jobName,
      testName,
    } = this.props;

    this.setState({
      detailsShowing: selectedJobName === `${testName} ${jobName}`,
      selectedTask: selectedTaskId
        ? jobs.filter((job) => job.id === parseInt(selectedTaskId, 10)).length >
            0 &&
          jobs.filter((job) => job.id === parseInt(selectedTaskId, 10))[0]
        : null,
    });
  }

  setSelectedTask = (task) => {
    const { selectedTask } = this.state;
    const { jobName, testName } = this.props;

    if (selectedTask === task || !task) {
      this.props.updateParamsAndState({
        selectedTaskId: '',
        selectedJobName: '',
      });
      this.setState({ selectedTask: null, detailsShowing: false });
    } else {
      this.props.updateParamsAndState({
        selectedTaskId: task.id,
        selectedJobName: `${testName} ${jobName}`,
      });
      this.setState({ selectedTask: task, detailsShowing: true });
    }
  };

  confirmFailureTask = async (task) => {
    const { notify, currentRepo, decisionTaskMap } = this.props;

    if (canConfirmFailure(task)) {
      confirmFailure(task, notify, decisionTaskMap, currentRepo);
    }
  };

  render() {
    const { currentRepo, jobName, jobs, children } = this.props;
    const { detailsShowing, selectedTask } = this.state;

    const taskList = sortBy(jobs, ['start_time']);
    taskList.forEach((task) => addAggregateFields(task));

    return (
      <Row
        className="ms-5 pt-2 me-1"
        key={jobName}
        style={{ background: '#f2f2f2' }}
      >
        <Row className="ms-2 ps-2 w-100 mb-2 justify-content-between">
          {children}
          <Col className="ms-2">
            {taskList.map((task, idx) => {
              const { id, result, state, start_time: startTime } = task;
              const isSelected = selectedTask && selectedTask.id === id;
              return (
                <span key={id} className="me-3">
                  <SimpleTooltip
                    text={
                      <Button
                        className="py-0"
                        variant={
                          !isSelected
                            ? `outline-${taskResultColorMap[result]}`
                            : taskResultColorMap[result]
                        }
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
                        } - ${new Date(startTime).toLocaleString(
                          'en-US',
                          shortDateFormat,
                        )}`}
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
              onClick={() => this.confirmFailureTask(taskList[0])}
              variant="outline"
              className="me-2 border-0"
              title="Confirm failure"
              style={{ lineHeight: '10px' }}
            >
              <FontAwesomeIcon icon={faCheck} />
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
  testName: PropTypes.string,
  jobName: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  updateParamsAndState: PropTypes.func.isRequired,
  decisionTaskMap: PropTypes.shape({}),
};

PlatformConfig.defaultProps = {
  testName: '',
  decisionTaskMap: {},
};

export default PlatformConfig;
