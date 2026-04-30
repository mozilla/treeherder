import React from 'react';
import PropTypes from 'prop-types';
import { Form, Button, Modal } from 'react-bootstrap';

export default class NotesModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      inputValue: this.props.alertSummary.notes || '',
    };
  }

  updateInput = (event) => {
    this.setState({ inputValue: event.target.value });
  };

  handleSubmit = (event) => {
    event.preventDefault();

    const { updateAndClose } = this.props;
    const { inputValue } = this.state;

    updateAndClose(
      event,
      {
        notes: inputValue.length ? inputValue : null,
      },
      'showNotesModal',
    );
  };

  render() {
    const { showModal, toggle, alertSummary } = this.props;
    const { inputValue } = this.state;

    return (
      <Modal show={showModal} onHide={toggle}>
        <Modal.Header closeButton>
          <Modal.Title>Alert Notes</Modal.Title>
        </Modal.Header>
        <Form onSubmit={this.handleSubmit}>
          <Modal.Body>
            <Form.Group>
              <Form.Label htmlFor="editableNotes">Add or edit notes</Form.Label>
              <Form.Control
                id="editableNotes"
                value={inputValue}
                onChange={this.updateInput}
                name="editableNotes"
                as="textarea"
                cols="50"
                rows="10"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              disabled={inputValue === (alertSummary.notes || '')}
              type="submit"
            >
              Save
            </Button>
          </Modal.Footer>
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
