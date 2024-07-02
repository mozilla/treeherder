import React from 'react';
import PropTypes from 'prop-types';
import {
  Col,
  Form,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';

export default class RetriggerModal extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      baseRetriggerTimes: this.getInitialValue(true),
      newRetriggerTimes: this.getInitialValue(),
      invalidInput: false,
    };
  }

  onOpened = () => {
    this.setState({
      baseRetriggerTimes: this.getInitialValue(true),
      newRetriggerTimes: this.getInitialValue(),
      invalidInput: false,
    });
  };

  onClosed = () => {
    const { defaultRetriggersValue } = this.props;
    this.setState({
      baseRetriggerTimes: defaultRetriggersValue,
      newRetriggerTimes: defaultRetriggersValue,
      invalidInput: false,
    });
  };

  getInitialValue = (isBaseline = false) => {
    const {
      defaultRetriggersValue,
      isBaseAggregate,
      currentRetriggerRow,
    } = this.props;
    let initialValue = defaultRetriggersValue;

    if (isBaseline) {
      if (isBaseAggregate || !currentRetriggerRow.originalRetriggerableJobId) {
        initialValue = 0;
      }
    } else if (!currentRetriggerRow.newRetriggerableJobId) {
      initialValue = 0;
    }

    return initialValue;
  };

  getInputTitle = (isBaseline = false) => {
    const { isBaseAggregate, currentRetriggerRow } = this.props;
    let disableReason;

    if (isBaseline) {
      if (isBaseAggregate) {
        disableReason = 'base revision is aggregate';
      } else if (!currentRetriggerRow.originalRetriggerableJobId) {
        disableReason = 'there are no jobs to retrigger';
      }
    } else if (!currentRetriggerRow.newRetriggerableJobId) {
      disableReason = 'there are no jobs to retrigger';
    }

    return disableReason === undefined
      ? disableReason
      : `Disabled input because ${disableReason}`;
  };

  isValueValid = (value) => {
    const { maxRetriggersValue } = this.props;
    const regex = /^\d+$/;

    if (!value.match(regex)) {
      return false;
    }
    const parsedValue = parseInt(value, 10);
    return parsedValue >= 0 && parsedValue <= maxRetriggersValue;
  };

  handleChange = (event) => {
    const inputName = event.target.name;
    const updates = {
      [inputName]: 0,
      invalidInput: false,
    };

    if (this.isValueValid(event.target.value)) {
      updates[inputName] = event.target.value;
    } else {
      updates.invalidInput = true;
    }

    this.setState(updates);
  };

  onRetriggerClick = (event) => {
    const { updateAndClose } = this.props;
    const { baseRetriggerTimes, newRetriggerTimes } = this.state;

    updateAndClose(event, {
      baseRetriggerTimes: Number.isInteger(baseRetriggerTimes)
        ? baseRetriggerTimes
        : parseInt(baseRetriggerTimes, 10),
      newRetriggerTimes: Number.isInteger(newRetriggerTimes)
        ? newRetriggerTimes
        : parseInt(newRetriggerTimes, 10),
    });
  };

  render() {
    const {
      showModal,
      toggle,
      isBaseAggregate,
      maxRetriggersValue,
      currentRetriggerRow,
    } = this.props;
    const { invalidInput } = this.state;

    return (
      <Modal
        isOpen={showModal}
        onOpened={this.onOpened}
        onClosed={this.onClosed}
      >
        <ModalHeader toggle={toggle}>Retrigger Jobs</ModalHeader>
        <Form>
          <ModalBody>
            <div className="row">
              <Col className="col-xs-10 col-sm-6 col-md-6 col-lg-6 form-inline">
                <InputGroup title={this.getInputTitle(true)}>
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>Base revision:</InputGroupText>
                  </InputGroupAddon>
                  <Input
                    data-testid="input baseRetriggerTimes"
                    defaultValue={this.getInitialValue(true)}
                    min={0}
                    max={maxRetriggersValue}
                    onChange={this.handleChange}
                    name="baseRetriggerTimes"
                    type="number"
                    disabled={
                      isBaseAggregate ||
                      !currentRetriggerRow.originalRetriggerableJobId
                    }
                  />
                </InputGroup>
              </Col>
              <Col className="col-xs-10 col-sm-6 col-md-6 col-lg-6 form-inline">
                <InputGroup title={this.getInputTitle()}>
                  <InputGroupAddon addonType="prepend">
                    <InputGroupText>New revision:</InputGroupText>
                  </InputGroupAddon>
                  <Input
                    data-testid="input newRetriggerTimes"
                    defaultValue={this.getInitialValue()}
                    min={0}
                    max={maxRetriggersValue}
                    onChange={this.handleChange}
                    name="newRetriggerTimes"
                    type="number"
                    disabled={!currentRetriggerRow.newRetriggerableJobId}
                  />
                </InputGroup>
              </Col>
            </div>
            <div className="text-center">
              {invalidInput && (
                <p className="text-danger pt-2 text-wrap">
                  *Inputs should be numbers in 0 - {maxRetriggersValue} range
                </p>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="info"
              onClick={this.onRetriggerClick}
              disabled={invalidInput}
            >
              Retrigger
            </Button>
          </ModalFooter>
        </Form>
      </Modal>
    );
  }
}

RetriggerModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  updateAndClose: PropTypes.func.isRequired,
  isBaseAggregate: PropTypes.bool.isRequired,
  currentRetriggerRow: PropTypes.shape({}),
  defaultRetriggersValue: PropTypes.number,
  maxRetriggersValue: PropTypes.number,
};

RetriggerModal.defaultProps = {
  defaultRetriggersValue: 5,
  maxRetriggersValue: 10,
  currentRetriggerRow: {},
};
