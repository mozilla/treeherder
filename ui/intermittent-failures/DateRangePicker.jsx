import React from 'react';
import 'react-dates/initialize';
import 'react-dates/lib/css/_datepicker.css';
import { DateRangePickerPhrases } from 'react-dates/lib/defaultPhrases';
import { DateRangePicker as DatePickerAirbnb } from 'react-dates';
import moment from 'moment';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

import { ISODate } from './helpers';

const chooseAvailableDate = function chooseAvailableDate(object) {
  const { date } = object;
  return date;
};

export default class DateRangePicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      startDate: undefined,
      endDate: undefined,
      calendarFocused: null,
    };
  }

  componentWillUnmount() {
    clearTimeout(this.timeout);
  }

  focusTo = () => {
    this.timeout = setTimeout(() => this.to.getInput().focus(), 0);
  };

  showFromMonth = () => {
    const { startDate } = this.state;
    if (!startDate) {
      return;
    }
    this.to.getDayPicker().showMonth(startDate);
  };

  fromChange = (startDate) => {
    this.setState({ startDate }, () => {
      if (!this.state.endDate) {
        this.focusTo();
      }
    });
  };

  toChange = (endDate) => {
    this.setState({ endDate }, this.showFromMonth);
  };

  updateData = () => {
    const { startDate, endDate } = this.state;

    const startday = ISODate(moment(startDate));
    const endday = ISODate(moment(endDate));

    this.setState(() => ({ calendarFocused: null }));
    this.props.updateState({ startday, endday });
  };

  onFocusChange = (calendarFocused) => {
    this.setState(() => ({ calendarFocused }));
  };

  render() {
    const { startDate, endDate, calendarFocused } = this.state;
    const defaultPhrases = {
      chooseAvailableStartDate: chooseAvailableDate,
      chooseAvailableEndDate: chooseAvailableDate,
      ...DateRangePickerPhrases,
    };
    return (
      <div className="InputFromTo d-inline-block">
        <DatePickerAirbnb
          startDate={startDate}
          startDateId="startDateId"
          endDate={endDate}
          endDateId="endDateId"
          onDatesChange={({ startDate, endDate }) =>
            this.setState({ startDate, endDate })
          }
          focusedInput={calendarFocused}
          onFocusChange={this.onFocusChange}
          showClearDates
          numberOfMonths={2}
          initialVisibleMonth={() => moment().subtract(1, 'month')}
          isOutsideRange={(day) => moment().diff(day) < 0}
          phrases={defaultPhrases}
        />
        <Button variant="secondary" className="ml-3" onClick={this.updateData}>
          update
        </Button>
      </div>
    );
  }
}

DateRangePicker.propTypes = {
  updateState: PropTypes.func.isRequired,
};
