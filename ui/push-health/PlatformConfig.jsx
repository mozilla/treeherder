import React from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col } from 'reactstrap';
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

  retriggerTask = async (task) => {
    const { notify, currentRepo } = this.props;

    JobModel.retrigger([task], currentRepo, notify);
  };

  render() {
    const { currentRepo, jobName, jobs, children } = this.props;
    const { detailsShowing, selectedTask } = this.state;

    const taskList = sortBy(jobs, ['start_time']);
    taskList.forEach((task) => addAggregateFields(task));

    return (
      <Row
        className="ml-5 pt-2 mr-1"
        key={jobName}
        style={{ background: '#f2f2f2' }}
      >
        <Row className="ml-2 pl-2 w-100 mb-2 justify-content-between">
          {children}
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
  testName: PropTypes.string,
  jobName: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  updateParamsAndState: PropTypes.func.isRequired,
};

PlatformConfig.defaultProps = {
  testName: '',
};

export default PlatformConfig;
