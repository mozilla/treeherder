import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Button, Row, Col } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRedo } from '@fortawesome/free-solid-svg-icons';
import sortBy from 'lodash/sortBy';

import JobModel from '../models/job';
import { addAggregateFields } from '../helpers/job';
import { shortDateFormat } from '../helpers/display';

import { taskResultColorMap } from './helpers';
import DetailsPanel from './details/DetailsPanel';

class TestFailure extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      detailsShowing: false,
      selectedTask: null,
    };
  }

  setSelectedTask = (task) => {
    const { selectedTask } = this.state;

    if (selectedTask === task || !task) {
      this.setState({ selectedTask: null, detailsShowing: false });
    } else {
      this.setState({ selectedTask: task, detailsShowing: true });
    }
  };

  retriggerTask = async (task) => {
    const { notify, currentRepo } = this.props;

    JobModel.retrigger([task], currentRepo, notify);
  };

  render() {
    const { failure, groupedBy, currentRepo } = this.props;
    const {
      testName,
      jobName,
      inProgressJobs,
      failJobs,
      passJobs,
      passInFailedJobs,
      platform,
      config,
      key,
      tier,
      failedInParent,
      jobGroupSymbol,
      jobSymbol,
    } = failure;
    const { detailsShowing, selectedTask } = this.state;
    const taskList = sortBy(
      [...failJobs, ...passJobs, ...passInFailedJobs, ...inProgressJobs],
      ['start_time'],
    );
    taskList.forEach((task) => addAggregateFields(task));

    return (
      <Row className="pt-2" key={key}>
        <Row className="mx-5 w-100 mb-2 justify-content-between">
          <Col>
            <Row>
              <strong id={key} className="w-5 px-2 mx-2 text-darker-secondary">
                <span>
                  {groupedBy !== 'path' && `${testName} `}
                  {groupedBy !== 'platform' && `${platform} ${config}`}
                </span>
                <span className="ml-3">{jobName}</span>
              </strong>
            </Row>
          </Col>
          <Col className="ml-2">
            {tier > 1 && (
              <span className="ml-1 small text-muted">[tier-{tier}]</span>
            )}
            {taskList.map((task, idx) => {
              const { id, result, state, start_time: startTime } = task;
              const isSelected = selectedTask && selectedTask.id === id;
              return (
                <span key={id} className="mr-1">
                  <Button
                    color={taskResultColorMap[result]}
                    outline={!isSelected}
                    size="sm"
                    onClick={() => this.setSelectedTask(task)}
                    title={`${
                      state === 'completed' ? result : state
                    } - ${jobGroupSymbol}(${jobSymbol}) - ${new Date(
                      startTime,
                    ).toLocaleString('en-US', shortDateFormat)}`}
                  >
                    Task {idx + 1}
                  </Button>
                </span>
              );
            })}
            {!!failedInParent && <Badge color="info">Failed In Parent</Badge>}
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

TestFailure.propTypes = {
  failure: PropTypes.shape({
    testName: PropTypes.string.isRequired,
    jobName: PropTypes.string.isRequired,
    jobSymbol: PropTypes.string.isRequired,
    failJobs: PropTypes.arrayOf(PropTypes.shape({})),
    passJobs: PropTypes.arrayOf(PropTypes.shape({})),
    logLines: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
    confidence: PropTypes.number.isRequired,
    platform: PropTypes.string.isRequired,
    config: PropTypes.string.isRequired,
    suggestedClassification: PropTypes.string.isRequired,
    key: PropTypes.string.isRequired,
  }).isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  notify: PropTypes.func.isRequired,
  groupedBy: PropTypes.string.isRequired,
};

export default TestFailure;
