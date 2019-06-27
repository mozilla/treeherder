import React from 'react';
import PropTypes from 'prop-types';
import { InputGroup, Input } from 'reactstrap';
import debounce from 'lodash/debounce';

import { filterText } from './constants';

export default class InputFilter extends React.Component {
  // eslint-disable-next-line react/sort-comp
  constructor(props) {
    super(props);
    this.state = {
      input: '',
    };
  }

  debouncedUpdate = debounce(
    // eslint-disable-next-line react/destructuring-assignment
    () => this.props.updateFilterText(this.state.input),
    800,
  );

  updateInput = event => {
    const { updateFilterText } = this.props;
    const input = event.target.value;

    // reset if new text is ""
    if (!input) {
      this.debouncedUpdate.cancel();
      updateFilterText(input);
      this.setState({ input });
    } else {
      this.setState({ input }, this.debouncedUpdate);
    }
  };

  render() {
    const { disabled } = this.props;
    const { input } = this.state;

    return (
      <InputGroup>
        <Input
          placeholder={filterText.inputPlaceholder}
          onChange={this.updateInput}
          value={input}
          disabled={disabled}
          aria-label="filter text"
        />
      </InputGroup>
    );
  }
}

InputFilter.propTypes = {
  updateFilterText: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

InputFilter.defaultProps = {
  disabled: false,
};
