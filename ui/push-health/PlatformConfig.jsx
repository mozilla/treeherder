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

class PlatformConfig extends React.PureComponent {
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
    const { failure, groupedBy, currentRepo, jobs } = this.props;
    const {
      testName,
      jobName,
      key,
      tier,
      failedInParent,
      jobGroupSymbol,
      jobSymbol,
    } = failure;
    const testJobs = jobs[jobName];
    const { detailsShowing, selectedTask } = this.state;
    const taskList = sortBy(testJobs, ['start_time']);
    taskList.forEach((task) => addAggregateFields(task));

    return (
      <Row
        className="ml-5 pt-2 mr-1"
        key={key}
        style={{ background: '#f2f2f2' }}
      >
        <Row className="ml-2 w-100 mb-2 justify-content-between">
          <Col>
            <Row>
              <span
                id={key}
                className="px-2 text-darker-secondary font-weight-500"
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
                  <Button
                    className="py-0"
                    color={`${taskResultColorMap[result]} ${
                      !isSelected && 'bg-white bg-hover-grey'
                    }`}
                    outline={!isSelected}
                    size="sm"
                    onClick={() => this.setSelectedTask(task)}
                    title={`${
                      state === 'completed' ? result : state
                    } - ${jobGroupSymbol}(${jobSymbol}) - ${new Date(
                      startTime,
                    ).toLocaleString('en-US', shortDateFormat)}`}
                  >
                    task {idx > 0 ? idx + 1 : ''}
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
};

export default PlatformConfig;
