import React from 'react';
import { Alert } from 'reactstrap';
import { processErrorMessage } from '../intermittent-failures/helpers';

const withErrorHandling = (WrappedComponent) => {
  class ErrorHandling extends React.Component {
    constructor(props) {
      super(props);
      this.handleChange = this.handleChange.bind(this);
      this.state = {
        messages: [],
      };
      this.updateMessages = this.updateMessages.bind(this);
    }

    updateMessages({ failureMessage, failureStatus, errorMessages }) {
      const messages = errorMessages.length ? errorMessages : processErrorMessage(failureMessage, failureStatus);
      this.setState({ messages });
    }

    render() {
      const updateMessages = { updateMessages: this.updateMessages };
      const newProps = { ...this.props, ...this.state, ...updateMessages };
      const { messages } = this.state;
      return (
        <WrappedComponent {...newProps} />
        //   <div>
        //     {messages.map(message =>
        //       <Alert color="danger" key={message}>{message}</Alert>,
        //     )}
        //   </div>
        // </WrappedComponent>
      );
    }
  }
};

export default withErrorHandling;
