import React from "react";
import "react-day-picker/lib/style.css";
import { connect } from "react-redux";
import DayPickerInput from "react-day-picker/DayPickerInput";
import moment from "moment";
import { parseDate, formatDate } from "react-day-picker/moment";
import { setTimeout } from "timers";
import { Button } from "reactstrap";
import { ISODate, createApiUrl } from "../helpers";
import { fetchBugData, updateDateRange, fetchBugsThenBugzilla } from "./../redux/actions";

class DateRangePicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      from: null,
      to: null,
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
      fetchData(createApiUrl(SERVICE_DOMAIN, tableApi, params), name);
    } else {
      fetchFullBugData(createApiUrl(SERVICE_DOMAIN, tableApi, params), name);
    }
    fetchData(createApiUrl(SERVICE_DOMAIN, graphApi, params), graphName);
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
            numberOfMonths: 2
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
                        numberOfMonths: 2
                      }}
                      onDayChange={this.toChange}
                    />
                </span>
        <Button color="secondary" className="ml-2" onClick={this.updateData}>update</Button>
      </div>
    );
  }
}

const mapDispatchToProps = dispatch => ({
  fetchData: (url, name) => dispatch(fetchBugData(url, name)),
  fetchFullBugData: (url, name) => dispatch(fetchBugsThenBugzilla(url, name)),
  updateDates: (from, to, name) => dispatch(updateDateRange(from, to, name)),
});

export default connect(null, mapDispatchToProps)(DateRangePicker);
