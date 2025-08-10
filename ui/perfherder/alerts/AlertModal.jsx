import React from 'react';
import PropTypes from 'prop-types';
import {
  Form,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Col,
  Row,
} from 'react-bootstrap';
import debounce from 'lodash/debounce';

export default class AlertModal extends React.Component {
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
    const updates = { validated: true, invalidInput: false };

    if (!inputValue.length) {
      return;
    }
    if (!inputValue.match(regex)) {
      updates.invalidInput = true;
    }

    this.setState(updates);
  }, 1000);

  updateInput = (event) => {
    this.setState(
      { inputValue: event.target.value, validated: false },
      this.validateInput,
    );
  };

  render() {
    const {
      showModal,
      toggle,
      updateAndClose,
      dropdownOption,
      header,
      title,
    } = this.props;

    const { inputValue, invalidInput, validated } = this.state;

    return (
      <Modal isOpen={showModal}>
        <ModalHeader toggle={toggle}>{header}</ModalHeader>
        <Form>
          <ModalBody>
            <Form.Group>
              <Row className="justify-content-center">
                <Col className="col-4">
                  <Form.Label htmlFor="taskId">{title}</Form.Label>
                  <Form.Control
                    value={inputValue}
                    onChange={this.updateInput}
                    name="taskId"
                    placeholder="123456"
                  />
                </Col>
                {dropdownOption}
              </Row>
              <Row className="justify-content-center">
                <Col className="text-center">
                  {invalidInput && validated && (
                    <p className="text-danger pt-2 text-wrap">
                      Input should only contain numbers and not start with 0
                    </p>
                  )}
                </Col>
              </Row>
            </Form.Group>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="secondary"
              onClick={(event) => updateAndClose(event, inputValue)}
              disabled={invalidInput || !inputValue.length || !validated}
              type="submit"
            >
              Assign
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
    );
  }
}

AlertModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  updateAndClose: PropTypes.func.isRequired,
  dropdownOption: PropTypes.shape({}),
  header: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

AlertModal.defaultProps = {
  dropdownOption: null,
};
