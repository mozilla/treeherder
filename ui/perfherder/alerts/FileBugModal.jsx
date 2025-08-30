import React from 'react';
import PropTypes from 'prop-types';
import { Form, Button, Modal, Col, Row } from 'react-bootstrap';
import debounce from 'lodash/debounce';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons';

export default class FileBugModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      inputValue: '',
      invalidInput: false,
      validated: false,
    };
  }

  validateInput = debounce(() => {
    const { inputValue } = this.state;
    const regex = /^[1-9]+[0-9]*$/;
    const updates = { validated: false, invalidInput: false };

    if (!inputValue.length) {
      updates.validated = true;
      updates.invalidInput = false;
    }

    if (!inputValue.match(regex)) {
      updates.invalidInput = true;
    }

    this.setState(updates);
  }, 150);

  updateInput = (event) => {
    this.setState(
      { inputValue: event.target.value, validated: false },
      this.validateInput,
    );
  };

  handleSubmit = async (event, inputValue) => {
    const { updateAndClose } = this.props;
    await updateAndClose(event, inputValue);
    this.setState({ inputValue: '' });
  };

  render() {
    const {
      showModal,
      toggle,
      header,
      title,
      submitButtonText,
      user,
      errorMessage,
    } = this.props;

    const { inputValue, invalidInput, validated } = this.state;

    const infoText =
      'Leaving the input empty will open an enter bug screen prefilled with the default values.\n' +
      'Entering a bug number will populate the enter bug screen with the relevant fields for a ' +
      'regression from the referenced bug.';

    return (
      <Modal show={showModal} onHide={toggle}>
        <Modal.Header closeButton>
          <Modal.Title>{header}</Modal.Title>
        </Modal.Header>
        <Form>
          <Modal.Body>
            {errorMessage && (
              <div className="alert alert-danger">{errorMessage}</div>
            )}
            {user.isLoggedIn ? (
              <Form.Group>
                <Row className="justify-content-left">
                  <Col className="col-6">
                    <Form.Label htmlFor="culpritBugId">
                      {title} <i>(optional): </i>
                      <span className="text-secondary">
                        <FontAwesomeIcon icon={faInfoCircle} title={infoText} />
                      </span>
                    </Form.Label>
                    <Form.Control
                      value={inputValue}
                      onChange={this.updateInput}
                      name="culpritBugId"
                      placeholder="123456"
                    />
                  </Col>
                </Row>
                <Row className="justify-content-left">
                  <Col className="text-left">
                    {invalidInput && !validated && (
                      <p className="text-danger pt-2 text-wrap">
                        Input should only contain numbers and not start with 0
                      </p>
                    )}
                  </Col>
                </Row>
              </Form.Group>
            ) : (
              <div>
                <p>You need to log in to access this feature.</p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            {user.isLoggedIn ? (
              <Button
                className="btn-outline-darker-info active"
                onClick={(event) => this.handleSubmit(event, inputValue)}
                disabled={invalidInput && !validated}
                type="submit"
              >
                {(inputValue.length &&
                  !invalidInput &&
                  `${submitButtonText} for ${inputValue}`) ||
                  ((!inputValue.length || invalidInput) &&
                    `${submitButtonText}`)}
              </Button>
            ) : (
              <Button
                className="btn-outline-darker-info active"
                onClick={toggle}
              >
                Cancel
              </Button>
            )}
          </Modal.Footer>
        </Form>
      </Modal>
    );
  }
}

FileBugModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  updateAndClose: PropTypes.func.isRequired,
  header: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  submitButtonText: PropTypes.string.isRequired,
  user: PropTypes.shape({}).isRequired,
};
