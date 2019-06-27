import React from 'react';
import 'react-day-picker/lib/style.css';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import moment from 'moment';
import PropTypes from 'prop-types';
import { parseDate, formatDate } from 'react-day-picker/moment';
import { Button } from 'reactstrap';

import { ISODate } from './helpers';

export default class DateRangePicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      from: undefined,
      to: undefined,
    };
  }

  componentWillUnmount() {
    clearTimeout(this.timeout);
  }

  focusTo = () => {
    this.timeout = setTimeout(() => this.to.getInput().focus(), 0);
  };

  showFromMonth = () => {
    const { from } = this.state;
    if (!from) {
      return;
    }
    this.to.getDayPicker().showMonth(from);
  };

  fromChange = from => {
    const { to } = this.state;

    this.setState({ from }, () => {
      if (to) {
        this.focusTo();
      }
    });
  };

  toChange = to => {
    this.setState({ to }, this.showFromMonth);
  };

  updateData = () => {
    const { from, to } = this.state;
    const { updateState } = this.props;
    const startday = ISODate(moment(from));
    const endday = ISODate(moment(to));

    updateState({ startday, endday });
  };

  render() {
    const { from, to } = this.state;
    const modifiers = { start: from, end: to };

    return (
      <div className="InputFromTo d-inline-block">
        <DayPickerInput
          value={from}
          placeholder="From"
          formatDate={formatDate}
          parseDate={parseDate}
          format="ddd MMM D, YYYY"
          dayPickerProps={{
            selectedDays: [from, { from, to }],
            toMonth: to,
            modifiers,
            numberOfMonths: 2,
          }}
          onDayChange={this.fromChange}
        />
        <span className="ml-1 mr-1">-</span>
        <span className="InputFromTo-to">
          <DayPickerInput
            ref={element => {
              this.to = element;
            }}
            value={to}
            placeholder="To"
            formatDate={formatDate}
            parseDate={parseDate}
            format="ddd MMM D, YYYY"
            dayPickerProps={{
              selectedDays: [from, { from, to }],
              month: from,
              fromMonth: from,
              modifiers,
              numberOfMonths: 2,
            }}
            onDayChange={this.toChange}
          />
        </span>
        <Button color="secondary" className="ml-2" onClick={this.updateData}>
          update
        </Button>
      </div>
    );
  }
}

DateRangePicker.propTypes = {
  updateState: PropTypes.func.isRequired,
};
