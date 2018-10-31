import React from 'react';
import PropTypes from 'prop-types';

import { getFieldChoices } from '../../helpers/filter';

export default class ActiveFilters extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      newFilterField: '',
      newFilterMatchType: '',
      newFilterValue: '',
      newFilterChoices: [],
    };
  }

  static getDerivedStateFromProps(props) {
    const { classificationTypes } = props;
    const fieldChoices = getFieldChoices();

    fieldChoices.failure_classification_id.choices = classificationTypes;
    return { fieldChoices };
  }

  componentDidMount() {
    this.addNewFieldFilter = this.addNewFieldFilter.bind(this);
    this.setNewFilterValue = this.setNewFilterValue.bind(this);
    this.setNewFilterField = this.setNewFilterField.bind(this);
    this.clearNewFieldFilter = this.clearNewFieldFilter.bind(this);
  }

  setNewFilterField(field) {
    const { fieldChoices } = this.state;
    this.setState({
      newFilterField: field,
      newFilterMatchType: fieldChoices[field].matchType,
      newFilterChoices: fieldChoices[field].choices,
    });
  }

  setNewFilterValue(value) {
    this.setState({ newFilterValue: value });
  }

  getFilterValue(field, value) {
    const { fieldChoices } = this.state;
    const choice = fieldChoices[field];
    const choiceValue = choice.choices.find(c => String(c.id) === value);

    return choice.matchType === 'choice' && choiceValue ? choiceValue.name : value;
  }

  addNewFieldFilter() {
    const { filterModel } = this.props;
    const { newFilterField, newFilterValue } = this.state;

    if (newFilterField && newFilterValue) {
      filterModel.addFilter(newFilterField, newFilterValue);
      this.clearNewFieldFilter();
    }
  }

  // Clear the values and close the input form group
  clearNewFieldFilter() {
    this.setState({
      newFilterField: '',
      newFilterMatchType: '',
      newFilterValue: '',
      newFilterChoices: [],
    });
    this.props.toggleFieldFilterVisible();
  }

  render() {
    const { isFieldFilterVisible, filterModel, filterBarFilters } = this.props;
    const {
      newFilterField, newFilterMatchType, newFilterValue, newFilterChoices,
      fieldChoices,
    } = this.state;

    return (
      <div className="alert-info active-filters-bar">
        {!!filterBarFilters.length && <div>
          <span
            className="pointable"
            title="Clear all of these filters"
            onClick={filterModel.clearNonStatusFilters}
          ><i className="fa fa-times-circle" /> </span>
          <span className="active-filters-title">
            <b>Active Filters</b>
          </span>
          {filterBarFilters.map(filter => (
            filter.value.map(filterValue => (
              <span className="filtersbar-filter" key={`${filter.field}${filterValue}`}>
                <span
                  className="pointable"
                  title={`Clear filter: ${filter.field}`}
                  onClick={() => filterModel.removeFilter(filter.field, filterValue)}
                >
                  <i className="fa fa-times-circle" />&nbsp;
                </span>
                <span title={`Filter by ${filter.field}: ${filterValue}`}>
                  <b>{filter.field}:</b>
                  {filter.field === 'failure_classification_id' && (
                    <span> {this.getFilterValue(filter.field, filterValue)}</span>
                  )}
                  {filter.field === 'author' && <span> {filterValue.split('@')[0].substr(0, 20)}</span>}
                  {filter.field !== 'author' && filter.field !== 'failure_classification_id' && <span> {filterValue.substr(0, 12)}</span>}
                </span>
              </span>
            ))
          ))}
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
                {Object.entries(fieldChoices).map(([field, obj]) => (
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
                required
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
                  <option value={fci_obj.id} key={fci}>{fci_obj.name}</option>
                )) }
              </select>}
              <button
                type="submit"
                className="btn btn-light-bordered btn-sm"
                onClick={this.addNewFieldFilter}
              >add</button>
              <button
                type="reset"
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
  filterModel: PropTypes.object.isRequired,
  filterBarFilters: PropTypes.array.isRequired,
  isFieldFilterVisible: PropTypes.bool.isRequired,
  toggleFieldFilterVisible: PropTypes.func.isRequired,
  classificationTypes: PropTypes.array.isRequired,
};
