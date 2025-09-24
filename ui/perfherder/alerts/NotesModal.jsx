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
} from 'reactstrap';

export default class NotesModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      inputValue: this.props.alertSummary.notes,
    };
  }

  updateInput = (event) => {
    this.setState({ inputValue: event.target.value });
  };

  render() {
    const { showModal, toggle, alertSummary, updateAndClose } = this.props;
    const { inputValue } = this.state;

    return (
      <Modal isOpen={showModal}>
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
            <Button
              color="secondary"
              onClick={(event) =>
                updateAndClose(
                  event,
                  {
                    notes: inputValue.length ? inputValue : null,
                  },
                  'showNotesModal',
                )
              }
              disabled={inputValue === alertSummary.notes}
              type="submit"
            >
              Save
            </Button>
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
  updateAndClose: PropTypes.func.isRequired,
};
