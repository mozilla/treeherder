import React from 'react';
import { DropdownButton } from 'react-bootstrap';
import PropTypes from 'prop-types';

import dayjs from '../helpers/dayjs';
import DropdownMenuItems from '../shared/DropdownMenuItems';

import DateRangePicker from './DateRangePicker';
import { ISODate } from './helpers';

export default class DateOptions extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      dateRange: '',
    };
  }

  updateDateRange = (dateRange) => {
    this.setState({ dateRange });
    if (dateRange === 'custom range') {
      return;
    }
    let from;
    if (dateRange === 'last 7 days') {
      from = 7;
    } else if (dateRange === 'last 30 days') {
      from = 30;
    } else {
      // bug history is max 4 months
      from = 120;
    }
    const startday = ISODate(dayjs().utc().subtract(from, 'days'));
    const endday = ISODate(dayjs().utc());
    this.props.updateState({ startday, endday });
  };

  render() {
    const { updateState } = this.props;
    const { dateRange } = this.state;
    const dateOptions = [
      'last 7 days',
      'last 30 days',
      'custom range',
      'entire history',
    ];

    return (
      <div className="d-inline-block">
        <DropdownButton className="me-3" title="date range">
          <DropdownMenuItems
            options={dateOptions}
            updateData={this.updateDateRange}
            selectedItem={dateRange}
          />
        </DropdownButton>
        {dateRange === 'custom range' && (
          <DateRangePicker updateState={updateState} />
        )}
      </div>
    );
  }
}

DateOptions.propTypes = {
  updateState: PropTypes.func.isRequired,
};
