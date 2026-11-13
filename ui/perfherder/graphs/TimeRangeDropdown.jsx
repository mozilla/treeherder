import React from 'react';
import { Dropdown } from 'react-bootstrap';
import PropTypes from 'prop-types';

import DropdownMenuItems from '../../shared/DropdownMenuItems';
import { phTimeRanges } from '../perf-helpers/constants';

class TimeRangeDropdown extends React.PureComponent {
  render() {
    const {
      timeRangeText,
      updateTimeRange,
      size = undefined,
      toggleClassName = '',
      variant = 'secondary',
    } = this.props;

    return (
      <Dropdown
        className="me-0 text-nowrap"
        title="Time range"
        aria-label="Time range"
      >
        <Dropdown.Toggle
          variant={variant}
          size={size}
          className={toggleClassName}
        >
          {timeRangeText}
        </Dropdown.Toggle>
        <Dropdown.Menu className="overflow-auto dropdown-menu-height">
          <DropdownMenuItems
            options={phTimeRanges.map((item) => item.text)}
            selectedItem={timeRangeText}
            updateData={(newTimeRangeText) =>
              updateTimeRange(
                phTimeRanges.find((item) => item.text === newTimeRangeText),
              )
            }
          />
        </Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default TimeRangeDropdown;

TimeRangeDropdown.propTypes = {
  timeRangeText: PropTypes.string.isRequired,
  updateTimeRange: PropTypes.func.isRequired,
  size: PropTypes.oneOf(['sm', 'lg']),
  toggleClassName: PropTypes.string,
  variant: PropTypes.string,
};
