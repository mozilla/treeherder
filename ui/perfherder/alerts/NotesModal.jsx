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

  editNotes = async event => {
    event.preventDefault();

    const { alertSummary, toggle } = this.props;
    const { inputValue } = this.state;

    await update(
      getApiUrl(`${endpoints.alertSummary}${alertSummary.id}/`),
      {
        notes: inputValue,
      },
    );
    // TODO this is updating the notes from the endpoint properly,
    // but the properties on the changed alertSummary needs to be updated

    // are originalNotes and notesChanged needed since we utilize props for comparison now?
    // if (!failureStatus) {
    //   alertSummary.originalNotes = alertSummary.notes;
    //   alertSummary.notesChanged = false;
    // }
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
};
