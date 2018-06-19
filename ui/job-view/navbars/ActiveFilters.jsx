import React from 'react';
import PropTypes from 'prop-types';

export default class ActiveFilters extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = this.props;
    this.thJobFilters = $injector.get('thJobFilters');
    this.fieldChoices = this.thJobFilters.getFieldChoices();

    this.state = {
      newFilterField: '',
      newFilterMatchType: '',
      newFilterValue: '',
      newFilterChoices: [],
    };
  }

  componentDidMount() {
    this.addNewFieldFilter = this.addNewFieldFilter.bind(this);
    this.setNewFilterValue = this.setNewFilterValue.bind(this);
    this.setNewFilterField = this.setNewFilterField.bind(this);
  }

  setNewFilterField(field) {
    this.setState({
      newFilterField: field,
      newFilterMatchType: this.fieldChoices[field].matchType,
      newFilterChoices: this.fieldChoices[field].choices,
    });
  }

  setNewFilterValue(value) {
    this.setState({ newFilterValue: value });
  }

  getFilterValue(field, value) {
    const choice = this.fieldChoices[field];
    const choiceValue = choice.choices[value];

    return choice.matchType === 'choice' && choiceValue ? choiceValue.name : value;
  }

  addNewFieldFilter() {
    const { newFilterField, newFilterValue } = this.state;
      if (newFilterField && newFilterValue) {
        this.thJobFilters.addFilter(newFilterField, newFilterValue);
      }

      // Clear the values and close the input form group
      this.clearNewFieldFilter();
      this.props.toggleFieldFilterVisible();
  }

  clearNewFieldFilter() {
    this.setState({
      newFilterField: '',
      newFilterMatchType: '',
      newFilterValue: '',
      newFilterChoices: [],
    });
  }

  render() {
    const { filterBarFilters, isFieldFilterVisible } = this.props;
    const {
      newFilterField, newFilterMatchType, newFilterValue, newFilterChoices,
    } = this.state;

    return (
      <div className="alert-info active-filters-bar">
        {!!filterBarFilters.length && <div>
          <span
            className="pointable"
            title="Clear all of these filters"
            onClick={this.thJobFilters.clearAllFilters}
          ><i className="fa fa-times-circle" /> </span>
          <span className="active-filters-title">
            <b>Active Filters</b>
          </span>
          {filterBarFilters.map(filter => (
            <span className="filtersbar-filter" key={filter.key}>
              <span
                className="pointable"
                title={`Clear filter: ${filter.field}`}
                onClick={() => this.thJobFilters.removeFilter(filter.key, filter.value)}
              >
                <i className="fa fa-times-circle" />&nbsp;
              </span>
              <span title={`Filter by ${filter.field}: ${filter.value}`}>
                <b>{filter.field}:</b>
                {filter.field === 'failure_classification_id' && (
                  <span> {this.getFilterValue(filter.field, filter.value)}</span>
                )}
                {filter.field === 'author' && <span> {filter.value.split('@')[0].substr(0, 20)}</span>}
                {filter.field !== 'author' && filter.field !== 'failure_classification_id' && <span> {filter.value.substr(0, 12)}</span>}
              </span>
            </span>))}
          </div>}
        {isFieldFilterVisible && <div>
          <form className="form-inline">
            <div className="form-group input-group-sm new-filter-input">
              <label className="sr-only" htmlFor="job-filter-field">Field</label>
              <select
                id="job-filter-field"
                className="form-control"
                value={newFilterField}
                onChange={evt => this.setNewFilterField(evt.target.value)}
                placeholder="filter field"
                required
              >
                <option value="" disabled>select filter field</option>
                {Object.entries(this.fieldChoices).map(([field, obj]) => (
                  obj.name !== 'tier' ? <option value={field} key={field}>{obj.name}</option> : null
                ))}
              </select>
              <label className="sr-only" htmlFor="job-filter-value">Value</label>
              {newFilterMatchType !== 'choice' && <input
                className="form-control"
                value={newFilterValue}
                onChange={evt => this.setNewFilterValue(evt.target.value)}
                id="job-filter-value"
                type="text"
                placeholder="enter filter value"
              />}
              <label className="sr-only" htmlFor="job-filter-choice-value">Value</label>
              {newFilterMatchType === 'choice' && <select
                className="form-control"
                value={newFilterValue}
                onChange={evt => this.setNewFilterValue(evt.target.value)}
                id="job-filter-choice-value"
              >
                <option value="" disabled>select value</option>
                {Object.entries(newFilterChoices).map(([fci, fci_obj]) => (
                  <option value={fci} key={fci}>{fci_obj.name}</option>
                )) }
              </select>}
              <button
                type="submit"
                className="btn btn-light-bordered btn-sm"
                onClick={this.addNewFieldFilter}
              >add</button>
              <button
                className="btn btn-light-bordered btn-sm"
                onClick={this.clearNewFieldFilter}
              >cancel</button>
            </div>
          </form>
        </div>}
      </div>

    );
  }
}

ActiveFilters.propTypes = {
  $injector: PropTypes.object.isRequired,
  filterBarFilters: PropTypes.array.isRequired,
  isFieldFilterVisible: PropTypes.bool.isRequired,
  toggleFieldFilterVisible: PropTypes.func.isRequired,
};
