import React from 'react';
import PropTypes from 'prop-types';
import { InputGroup, InputGroupAddon, Input, Button } from 'reactstrap';

import { filterText } from './constants';

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

  handleKeyPress = event => {
    const { input } = this.state;
    if (event.key === 'Enter' && input) {
      this.props.updateFilterText(input);
    }
  };

  render() {
    const { updateFilterText } = this.props;
    const { input } = this.state;

    return (
      <InputGroup>
        <Input
          placeholder={filterText.inputPlaceholder}
          onChange={this.updateInput}
          value={input}
          onKeyPress={this.handleKeyPress}
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
