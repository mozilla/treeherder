import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Label,
} from 'reactstrap';

import { parseSummary } from '../helpers/bug';
import { notify } from '../job-view/redux/stores/notifications';

export class InternalIssueFilerClass extends React.Component {
  constructor(props) {
    super(props);

    const { suggestion, jobGroupName } = props;

    const parsedSummary = parseSummary(suggestion);
    let summaryString = parsedSummary[0].join(' | ');
    if (jobGroupName.toLowerCase().includes('reftest')) {
      const re = /layout\/reftests\//gi;
      summaryString = summaryString.replace(re, '');
    }

    this.state = {
      summary: `Intermittent ${summaryString}`,
    };
  }

  submitInternalIssue = async () => {
    const { summary } = this.state;
    const { notify } = this.props;

    notify(summary, 'danger');
  };

  render() {
    const { isOpen, toggle } = this.props;
    const { summary } = this.state;

    return (
      <div>
        <Modal isOpen={isOpen} toggle={toggle} size="lg">
          <ModalHeader toggle={toggle}>
            Intermittent Internal Issue Filer
          </ModalHeader>
          <ModalBody>
            <form className="d-flex flex-column">
              <Label for="summary">Summary:</Label>
              <div className="d-flex">
                <Input
                  id="summary"
                  className="flex-grow-1"
                  type="text"
                  placeholder="Intermittent..."
                  pattern=".{0,255}"
                  defaultValue={summary}
                />
              </div>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onClick={this.submitFiler}>
              Submit Internal Issue
            </Button>{' '}
            <Button color="secondary" onClick={toggle}>
              Cancel
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    );
  }
}

InternalIssueFilerClass.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  suggestion: PropTypes.shape({}).isRequired,
  jobGroupName: PropTypes.string.isRequired,
  notify: PropTypes.func.isRequired,
};

export default connect(null, { notify })(InternalIssueFilerClass);
