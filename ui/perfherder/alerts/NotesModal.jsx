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
} from 'reactstrap';

import { update } from '../../helpers/http';
import { getApiUrl } from '../../helpers/url';
import { endpoints } from '../constants';

export default class NotesModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      inputValue: this.props.alertSummary.notes,
      failureMessage: '',
    };
  }

  updateInput = event => {
    this.setState({ inputValue: event.target.value });
  };

  // TODO remove this in favor of updateAndClose in StatusDropdown
  // once this component is using/updating the alertSummary via react state
  editNotes = async event => {
    event.preventDefault();

    const { alertSummary, toggle, $rootScope } = this.props;
    const { inputValue } = this.state;

    const { failureStatus } = await update(
      getApiUrl(`${endpoints.alertSummary}${alertSummary.id}/`),
      {
        notes: inputValue,
      },
    );

    if (!failureStatus) {
      alertSummary.notes = inputValue;
      $rootScope.$apply();
      // TODO originalNotes and notesChanged might not be needed since they're used for comparison purposes
      // alertSummary.originalNotes = alertSummary.notes;
      // alertSummary.notesChanged = false;
    }
    toggle();
  };

  render() {
    const { showModal, toggle, alertSummary } = this.props;
    const { inputValue, failureMessage } = this.state;

    return (
      <Modal isOpen={showModal} className="">
        <ModalHeader toggle={toggle}>Alert Notes</ModalHeader>
        <Form>
          <ModalBody>
            <FormGroup>
              <Label for="editableNotes">Add or edit notes</Label>
              <Input
                value={inputValue || ''}
                onChange={this.updateInput}
                name="editableNotes"
                type="textarea"
                cols="50"
                rows="10"
              />
            </FormGroup>
          </ModalBody>
          <ModalFooter>
            <Col>
              {failureMessage.length > 0 && (
                <p className="text-danger text-wrap text-center mb-1">
                  {`Failed to update notes: ${failureMessage}`}
                </p>
              )}
            </Col>
            <Col className="text-right" lg="auto">
              <Button
                color="secondary"
                onClick={this.editNotes}
                disabled={inputValue === alertSummary.notes}
                type="submit"
              >
                Save
              </Button>
            </Col>
          </ModalFooter>
        </Form>
      </Modal>
    );
  }
}

NotesModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  alertSummary: PropTypes.shape({
    notes: PropTypes.string,
  }).isRequired,
  $rootScope: PropTypes.shape({}).isRequired,
};
