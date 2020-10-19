import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimesCircle } from '@fortawesome/free-solid-svg-icons';

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

  setNewFilterField = (field) => {
    const { fieldChoices } = this.state;
    this.setState({
      newFilterField: field,
      newFilterMatchType: fieldChoices[field].matchType,
      newFilterChoices: fieldChoices[field].choices,
    });
  };

  setNewFilterValue = (value) => {
    this.setState({ newFilterValue: value });
  };

  getFilterValue(field, value) {
    const { fieldChoices } = this.state;
    const choice = fieldChoices[field];
    const choiceValue = choice.choices.find((c) => String(c.id) === value);

    return choice.matchType === 'choice' && choiceValue
      ? choiceValue.name
      : value;
  }

  addNewFieldFilter = () => {
    const { filterModel } = this.props;
    const { newFilterField, newFilterValue } = this.state;

    if (newFilterField && newFilterValue) {
      filterModel.addFilter(newFilterField, newFilterValue);
      this.clearNewFieldFilter();
    }
  };

  // Clear the values and close the input form group
  clearNewFieldFilter = () => {
    this.setState({
      newFilterField: '',
      newFilterMatchType: '',
      newFilterValue: '',
      newFilterChoices: [],
    });
    this.props.toggleFieldFilterVisible();
  };

  render() {
    const { isFieldFilterVisible, filterModel, filterBarFilters } = this.props;
    const {
      newFilterField,
      newFilterMatchType,
      newFilterValue,
      newFilterChoices,
      fieldChoices,
    } = this.state;

    return (
      <div className="alert-info active-filters-bar">
        {!!filterBarFilters.length && (
          <div>
            <Button
              color="darker-info"
              outline
              className="pointable bg-transparent border-0 pt-0 pr-1 pb-1"
              title="Clear all of these filters"
              onClick={filterModel.clearNonStatusFilters}
            >
              <FontAwesomeIcon
                icon={faTimesCircle}
                title="Clear all these filters"
              />{' '}
            </Button>
            <span className="active-filters-title">
              <b>Active Filters</b>
            </span>
            {filterBarFilters.map((filter) =>
              filter.value.map((filterValue) => (
                <span
                  className="filtersbar-filter"
                  key={`${filter.field}${filterValue}`}
                >
                  <Button
                    color="darker-info"
                    outline
                    className="pointable bg-transparent border-0 py-0 pr-1"
                    title={`Clear filter: ${filter.field}`}
                    onClick={() =>
                      filterModel.removeFilter(filter.field, filterValue)
                    }
                  >
                    <FontAwesomeIcon
                      icon={faTimesCircle}
                      title={`Clear filter: ${filter.field}`}
                    />
                    &nbsp;
                  </Button>
                  <span title={`Filter by ${filter.field}: ${filterValue}`}>
                    <b>{filter.field}:</b>
                    {filter.field === 'failure_classification_id' && (
                      <span>
                        {' '}
                        {this.getFilterValue(filter.field, filterValue)}
                      </span>
                    )}
                    {(filter.field === 'revision' ||
                      filter.field === 'tochange' ||
                      filter.field === 'fromchange') && (
                      <span> {filterValue.substr(0, 12)}</span>
                    )}
                    {![
                      'failure_classification_id',
                      'fromchange',
                      'revision',
                      'tochange',
                    ].includes(filter.field) && <span> {filterValue}</span>}
                  </span>
                </span>
              )),
            )}
          </div>
        )}
        {isFieldFilterVisible && (
          <div>
            <form className="form-inline">
              <div className="form-group input-group-sm new-filter-input">
                <select
                  id="job-filter-field"
                  className="form-control"
                  value={newFilterField}
                  onChange={(evt) => this.setNewFilterField(evt.target.value)}
                  placeholder="filter field"
                  aria-label="Field"
                  required
                >
                  <option value="" disabled>
                    select filter field
                  </option>
                  {Object.entries(fieldChoices).map(([field, obj]) =>
                    obj.name !== 'tier' ? (
                      <option value={field} key={field}>
                        {obj.name}
                      </option>
                    ) : null,
                  )}
                </select>
                {newFilterMatchType !== 'choice' && (
                  <React.Fragment>
                    <input
                      className="form-control"
                      value={newFilterValue}
                      onChange={(evt) =>
                        this.setNewFilterValue(evt.target.value)
                      }
                      id="job-filter-value"
                      type="text"
                      required
                      placeholder="enter filter value"
                      aria-label="Value"
                    />
                  </React.Fragment>
                )}
                {newFilterMatchType === 'choice' && (
                  <select
                    className="form-control"
                    value={newFilterValue}
                    onChange={(evt) => this.setNewFilterValue(evt.target.value)}
                    id="job-filter-choice-value"
                    aria-label="Value"
                  >
                    <option value="" disabled>
                      select value
                    </option>
                    {Object.entries(newFilterChoices).map(([fci, fciObj]) => (
                      <option value={fciObj.id} key={fci}>
                        {fciObj.name}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="bg-light"
                  onClick={this.addNewFieldFilter}
                  outline
                >
                  add
                </Button>
                <Button
                  className="bg-light"
                  outline
                  size="sm"
                  onClick={this.clearNewFieldFilter}
                >
                  cancel
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }
}

ActiveFilters.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
  filterBarFilters: PropTypes.arrayOf(PropTypes.object).isRequired,
  isFieldFilterVisible: PropTypes.bool.isRequired,
  toggleFieldFilterVisible: PropTypes.func.isRequired,
  classificationTypes: PropTypes.arrayOf(PropTypes.object).isRequired,
};
