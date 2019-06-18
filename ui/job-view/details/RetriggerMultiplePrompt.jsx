import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from 'reactstrap';
import $ from 'jquery';

import JobModel from '../../models/job';
import { notify } from '../redux/stores/notifications';

export class RetriggerMultipleClass extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      retriggerTimesValue: 1,
      retriggerTimesValid: true,
    };
  }

  retriggerTimes = () => {
    const { repoName } = this.props;
    this.props.toggle();

    // Spin the retrigger button when retriggers happen
    $('#retrigger-btn > svg').removeClass('action-bar-spin');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        $('#retrigger-btn > svg').addClass('action-bar-spin');
      });
    });

    JobModel.retrigger(
      this.props.jobs,
      repoName,
      notify,
      parseInt(this.state.retriggerTimesValue, 10),
    );
  };

  updateRetriggerTimes = times => {
    if (times >= 1 && times <= 100) {
      this.setState({ retriggerTimesValue: times, retriggerTimesValid: true });
    } else {
      this.setState({ retriggerTimesValue: times, retriggerTimesValid: false });
    }
  };

  render() {
    const { isOpen, toggle, jobs } = this.props;
    const { retriggerTimesValue } = this.state;

    return (
      <div>
        <Modal isOpen={isOpen} toggle={toggle}>
          <ModalHeader toggle={toggle}>
            Retrigger {jobs.length} {jobs.length > 1 ? 'jobs' : 'job'} how many
            times?
          </ModalHeader>
          <ModalBody>
            {!!(retriggerTimesValue < 1 || retriggerTimesValue > 100) && (
              <div className="text-danger">Value must be between 1 and 100</div>
            )}
            <Input
              type="number"
              min="1"
              max="100"
              onChange={evt => this.updateRetriggerTimes(evt.target.value)}
              step="1"
              title="Value needs to be between 1 and 100"
              value={retriggerTimesValue}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              disabled={!this.state.retriggerTimesValid}
              color="primary"
              onClick={this.retriggerTimes}
            >
              Submit
            </Button>
            <Button color="secondary" onClick={toggle}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    );
  }
}

RetriggerMultipleClass.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  jobs: PropTypes.array.isRequired,
  repoName: PropTypes.string.isRequired,
};

export default connect(
  null,
  { notify },
)(RetriggerMultipleClass);
