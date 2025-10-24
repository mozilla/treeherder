import React from 'react';
import PropTypes from 'prop-types';
import { InputGroup, Input } from 'reactstrap';
import debounce from 'lodash/debounce';

import { filterText } from '../perfherder/perf-helpers/constants';

export default class InputFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      input: props.filteredTextValue,
    };
  }

  debouncedUpdate = debounce(
    () => this.props.updateFilterText(this.state.input),
    800,
  );

  componentDidUpdate(prevProps) {
    const { filteredTextValue } = this.props;

    if (filteredTextValue !== prevProps.filteredTextValue) {
      this.setState({ input: filteredTextValue });
    }
  }

  updateInput = (event) => {
    const { updateFilterText, updateOnEnter } = this.props;
    const input = event.target.value;

    if (updateOnEnter) {
      this.setState({ input });
    } else if (!input) {
      this.debouncedUpdate.cancel();
      updateFilterText(input);
      this.setState({ input });
    } else {
      this.setState({ input }, this.debouncedUpdate);
    }
  };

  userActionListener = async (event) => {
    const { updateFilterText } = this.props;
    const { input } = this.state;

    if (event.key === 'Enter') {
      updateFilterText(input);
    }
  };

  render() {
    const { disabled, placeholder, updateOnEnter } = this.props;
    const { input } = this.state;

    return (
      <InputGroup>
        <Input
          onChange={this.updateInput}
          onKeyDown={(e) => {
            if (updateOnEnter) {
              this.userActionListener(e);
            } else if (e.key === 'Enter') {
              e.preventDefault();
            }
          }}
          placeholder={placeholder}
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
  placeholder: PropTypes.string,
  updateOnEnter: PropTypes.bool,
};

InputFilter.defaultProps = {
  disabled: false,
  placeholder: filterText.inputPlaceholder,
  updateOnEnter: false,
};
