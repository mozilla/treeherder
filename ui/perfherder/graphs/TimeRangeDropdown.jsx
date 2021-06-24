import React from 'react';
import { DropdownToggle, UncontrolledDropdown } from 'reactstrap';
import PropTypes from 'prop-types';

import DropdownMenuItems from '../../shared/DropdownMenuItems';
import { phTimeRanges } from '../perf-helpers/constants';

class TimeRangeDropdown extends React.PureComponent {
  render() {
    const { timeRangeText, updateTimeRange } = this.props;

    return (
      <UncontrolledDropdown
        className="mr-0 text-nowrap"
        title="Time range"
        aria-label="Time range"
      >
        <DropdownToggle caret>{timeRangeText}</DropdownToggle>
        <DropdownMenuItems
          options={phTimeRanges.map((item) => item.text)}
          selectedItem={timeRangeText}
          updateData={(newTimeRangeText) =>
            updateTimeRange(
              phTimeRanges.find((item) => item.text === newTimeRangeText),
            )
          }
        />
      </UncontrolledDropdown>
    );
  }
}

export default TimeRangeDropdown;

TimeRangeDropdown.propTypes = {
  timeRangeText: PropTypes.string.isRequired,
  updateTimeRange: PropTypes.func.isRequired,
};
