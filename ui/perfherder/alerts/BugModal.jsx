import React from 'react';
import PropTypes from 'prop-types';
import {
  Form,
  FormGroup,
  Input,
  Label,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Col,
  Row,
} from 'reactstrap';
import debounce from 'lodash/debounce';

import { refreshAlertSummary } from '../helpers';
import { update } from '../../helpers/http';
import { getApiUrl } from '../../helpers/url';
import { endpoints } from '../constants';

export default class BugModal extends React.Component {
  constructor(props) {
    super(props);
    this.issueTrackers = this.props.issueTrackers;
    this.state = {
      selectedValue: '',
      inputValue: '',
      invalidInput: false,
      validated: false,
      failureMessage: '',
    };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.issueTrackers !== this.props.issueTrackers) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ selectedValue: this.props.issueTrackers[0].text });
    }
  }

  // eslint-disable-next-line react/sort-comp
  validateInput = debounce(() => {
    const { inputValue } = this.state;
    const regex = /^[1-9]+[0-9]*$/;
    const updates = { validated: true, invalidInput: false };

    if (!inputValue.length) {
      return;
    }
    if (!inputValue.match(regex)) {
      updates.invalidInput = true;
    }

    this.setState(updates);
  }, 1000);

  updateInput = event => {
    this.setState(
      { inputValue: event.target.value, validated: false },
      this.validateInput,
    );
  };

  assignBug = async event => {
    event.preventDefault();

    const {
      alertSummary,
      toggle,
      issueTrackers,
      updateAlertVisibility,
    } = this.props;
    const { inputValue, selectedValue } = this.state;
    const tracker = issueTrackers.find(item => item.text === selectedValue);

    const { data, failureStatus } = await update(
      getApiUrl(`${endpoints.alertSummary}${alertSummary.id}/`),
      {
        bug_number: parseInt(inputValue, 10),
        issue_tracker: tracker.id,
      },
    );

    if (!failureStatus) {
      refreshAlertSummary(alertSummary, data);
      // TODO this doesn't work as expected in this component - replace
      updateAlertVisibility();
      toggle();
    } else {
      this.setState({ failureMessage: data });
    }
  };

  render() {
    const { showModal, toggle, issueTrackers, issueTrackersError } = this.props;
    const {
      inputValue,
      invalidInput,
      validated,
      selectedValue,
      failureMessage,
    } = this.state;

    return (
      <Modal isOpen={showModal} className="">
        <ModalHeader toggle={toggle}>Link to Bug</ModalHeader>
        <Form>
          <ModalBody>
            <FormGroup>
              <Row>
                <Col>
                  <Label for="taskId">Enter Bug</Label>
                  <Input
                    value={inputValue}
                    onChange={this.updateInput}
                    name="taskId"
                    placeholder="123456"
                  />
                </Col>
                <Col>
                  <Label for="issueTrackerSelector">Select Bug Tracker</Label>
                  <Input
                    onChange={event =>
                      this.setState({ selectedValue: event.target.value })
                    }
                    type="select"
                    name="issueTrackerSelector"
                    value={selectedValue}
                  >
                    {issueTrackers.length > 0 &&
                      !issueTrackersError &&
                      issueTrackers.map(item => (
                        <option key={item.id}>{item.text}</option>
                      ))}
                  </Input>
                </Col>
              </Row>
              <Row>
                <Col>
                  {invalidInput && validated && (
                    <p className="text-danger pt-2 text-wrap">
                      Input should only contain numbers and not start with 0
                    </p>
                  )}
                </Col>
              </Row>
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Col>
              {failureMessage.length > 0 && (
                <p className="text-danger text-wrap text-center mb-1">
                  {`Failed to assign bug: ${failureMessage}`}
                </p>
              )}
            </Col>
            <Col className="text-right" lg="auto">
              <Button
                color="secondary"
                onClick={this.assignBug}
                disabled={invalidInput || !inputValue.length || !validated}
                type="submit"
              >
                Assign
              </Button>
            </Col>
          </ModalFooter>
        </Form>
      </Modal>
    );
  }
}

BugModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  issueTrackers: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string,
      id: PropTypes.number,
    }),
  ),
  issueTrackersError: PropTypes.bool,
  alertSummary: PropTypes.shape({}).isRequired,
  updateAlertVisibility: PropTypes.func.isRequired,
};

BugModal.defaultProps = {
  issueTrackers: [],
  issueTrackersError: null,
};
