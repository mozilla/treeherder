import React from 'react';
import { Dropdown } from 'react-bootstrap';
import PropTypes from 'prop-types';

import DropdownMenuItems from '../../shared/DropdownMenuItems';
import { phTimeRanges } from '../perf-helpers/constants';

class TimeRangeDropdown extends React.PureComponent {
  render() {
    const { timeRangeText, updateTimeRange } = this.props;

    return (
      <Dropdown
        className="mr-0 text-nowrap"
        title="Time range"
        aria-label="Time range"
      >
        <Dropdown.Toggle caret>{timeRangeText}</Dropdown.Toggle>
        <DropdownMenuItems
          options={phTimeRanges.map((item) => item.text)}
          selectedItem={timeRangeText}
          updateData={(newTimeRangeText) =>
            updateTimeRange(
              phTimeRanges.find((item) => item.text === newTimeRangeText),
            )
          }
        />
      </Dropdown>
    );
  }
}

export default TimeRangeDropdown;

TimeRangeDropdown.propTypes = {
  timeRangeText: PropTypes.string.isRequired,
  updateTimeRange: PropTypes.func.isRequired,
};
