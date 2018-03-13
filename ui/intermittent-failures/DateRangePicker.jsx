import React from 'react';
import 'react-day-picker/lib/style.css';
import { connect } from 'react-redux';
import DayPickerInput from 'react-day-picker/DayPickerInput';
import moment from 'moment';
import { parseDate, formatDate } from 'react-day-picker/moment';
import { setTimeout } from 'timers';
import { Button } from 'reactstrap';
import PropTypes from 'prop-types';

import { ISODate } from './helpers';
import { createApiUrl } from '../helpers/urlHelper';
import { fetchBugData, updateDateRange, fetchBugsThenBugzilla } from './redux/actions';

class DateRangePicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      from: undefined,
      to: undefined,
    };
    this.fromChange = this.fromChange.bind(this);
    this.toChange = this.toChange.bind(this);
    this.updateData = this.updateData.bind(this);
  }

  componentWillUnmount() {
    clearTimeout(this.timeout);
  }

  focusTo() {
    this.timeout = setTimeout(() => this.to.getInput().focus(), 0);
  }

  showFromMonth() {
    const from = this.state.from;
    if (!from) {
      return;
    }
    this.to.getDayPicker().showMonth(from);
  }

  fromChange(from) {
    this.setState({ from }, () => {
      if (!this.state.to) {
        this.focusTo();
      }
    });
  }

  toChange(to) {
    this.setState({ to }, this.showFromMonth);
  }

  updateData() {
    const { graphName, fetchData, updateDates, fetchFullBugData, name, tree, bugId, tableApi, graphApi } = this.props;
    const from = ISODate(moment(this.state.from));
    const to = ISODate(moment(this.state.to));
    const params = { startday: from, endday: to, tree };

    if (bugId) {
      params.bug = bugId;
      fetchData(createApiUrl(tableApi, params), name);
    } else {
      fetchFullBugData(createApiUrl(tableApi, params), name);
    }
    fetchData(createApiUrl(graphApi, params), graphName);
    updateDates(from, to, name);
  }

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
            ref={(element) => {
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
        <Button color="secondary" className="ml-2" onClick={this.updateData}>update</Button>
      </div>
    );
  }
}

DateRangePicker.propTypes = {
  updateDates: PropTypes.func,
  fetchData: PropTypes.func,
  fetchFullBugData: PropTypes.func,
  tree: PropTypes.string.isRequired,
  bugId: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]),
  name: PropTypes.string.isRequired,
  tableApi: PropTypes.string.isRequired,
  graphApi: PropTypes.string.isRequired,
  graphName: PropTypes.string.isRequired,
};

DateRangePicker.defaultProps = {
  fetchData: null,
  updateDates: null,
  fetchFullBugData: null,
  bugId: null,
};

const mapDispatchToProps = dispatch => ({
  fetchData: (url, name) => dispatch(fetchBugData(url, name)),
  fetchFullBugData: (url, name) => dispatch(fetchBugsThenBugzilla(url, name)),
  updateDates: (from, to, name) => dispatch(updateDateRange(from, to, name)),
});

export default connect(null, mapDispatchToProps)(DateRangePicker);
