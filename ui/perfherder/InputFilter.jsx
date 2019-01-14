import React from 'react';
import PropTypes from 'prop-types';
import { InputGroup, InputGroupAddon, Input, Button } from 'reactstrap';

export default class InputFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      input: '',
    };
  }

  updateInput = event => {
    const input = event.target.value;

    // reset if previous text is replaced with ""
    if (!input && this.state.input) {
      this.props.updateFilterText(input);
    }
    this.setState({ input });
  };

  render() {
    const { updateFilterText } = this.props;
    const { input } = this.state;

    return (
      <InputGroup>
        <Input
          placeholder="linux tp5o"
          onChange={this.updateInput}
          value={input}
        />
        <InputGroupAddon addonType="append">
          <Button onClick={() => updateFilterText(input)}>filter</Button>
        </InputGroupAddon>
      </InputGroup>
    );
  }
}

InputFilter.propTypes = {
  updateFilterText: PropTypes.func.isRequired,
};
