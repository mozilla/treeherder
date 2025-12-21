import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { connect } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { updateRange } from '../redux/stores/pushes';
import { clearSelectedJob } from '../redux/stores/selectedJob';
import { getFieldChoices } from '../../helpers/filter';

function ActiveFilters({
  filterModel,
  filterBarFilters,
  isFieldFilterVisible,
  toggleFieldFilterVisible,
  classificationTypes,
  updateRange,
  clearSelectedJob,
}) {
  const location = useLocation();
  const [newFilterField, setNewFilterFieldState] = useState('');
  const [newFilterMatchType, setNewFilterMatchType] = useState('');
  const [newFilterValue, setNewFilterValue] = useState('');
  const [newFilterChoices, setNewFilterChoices] = useState([]);

  const fieldChoices = useMemo(() => {
    const choices = getFieldChoices();
    choices.failure_classification_id.choices = classificationTypes;
    return choices;
  }, [classificationTypes]);

  const setNewFilterField = useCallback(
    (field) => {
      setNewFilterFieldState(field);
      setNewFilterMatchType(fieldChoices[field].matchType);
      setNewFilterChoices(fieldChoices[field].choices);
    },
    [fieldChoices],
  );

  const getFilterValue = useCallback(
    (field, value) => {
      const choice = fieldChoices[field];
      const choiceValue = choice.choices.find((c) => String(c.id) === value);

      return choice.matchType === 'choice' && choiceValue
        ? choiceValue.name
        : value;
    },
    [fieldChoices],
  );

  const clearNewFieldFilter = useCallback(() => {
    setNewFilterFieldState('');
    setNewFilterMatchType('');
    setNewFilterValue('');
    setNewFilterChoices([]);
    toggleFieldFilterVisible();
  }, [toggleFieldFilterVisible]);

  const addNewFieldFilter = useCallback(() => {
    if (newFilterField && newFilterValue) {
      filterModel.addFilter(newFilterField, newFilterValue);
      clearNewFieldFilter();
    }
  }, [newFilterField, newFilterValue, filterModel, clearNewFieldFilter]);

  const clearAndUpdateRange = useCallback(
    (specificFilter = null) => {
      const params = new URLSearchParams(location.search);

      if (!specificFilter) {
        filterModel.clearNonStatusFilters();
      } else {
        const { filterField, filterValue } = specificFilter;
        filterModel.removeFilter(filterField, filterValue);
      }

      // we do this because anytime the 'revision' or 'author' param is changed,
      // updateRange will be triggered in PushList's componentDidUpdate lifecycle.
      // This also helps in the scenario where we are only changing the global window location query params
      // (to also prevent an unnecessary componentDidUpdate change) such as when a user clicks to view
      // a revision, then selects "next x pushes" to set a range.
      if (!params.has('revision') && !params.has('author')) {
        updateRange(filterModel.getUrlParamsWithoutDefaults());
      } else if (params.has('selectedTaskRun')) {
        clearSelectedJob(0);
      }
    },
    [location.search, filterModel, updateRange, clearSelectedJob],
  );

  return (
    <div className="alert-info active-filters-bar">
      {!!filterBarFilters.length && (
        <div>
          <Button
            variant="outline-darker-info"
            className="pointable bg-transparent border-0 pt-0 pe-1 pb-1"
            title="Clear all of these filters"
            onClick={() => clearAndUpdateRange()}
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
                  variant="outline-darker-info"
                  className="pointable bg-transparent border-0 py-0 pe-1"
                  title={`Clear filter: ${filter.field}`}
                  onClick={() =>
                    clearAndUpdateRange({
                      filterField: filter.field,
                      filterValue,
                    })
                  }
                >
                  <FontAwesomeIcon icon={faTimesCircle} />
                  &nbsp;
                </Button>
                <span title={`Filter by ${filter.field}: ${filterValue}`}>
                  <b>{filter.field}:</b>
                  {filter.field === 'failure_classification_id' && (
                    <span> {getFilterValue(filter.field, filterValue)}</span>
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
          {/* Use Bootstrap 5 flexbox utilities instead of form-inline */}
          <Form className="d-flex flex-row align-items-center gap-2">
            <Form.Select
              size="sm"
              id="job-filter-field"
              value={newFilterField}
              onChange={(evt) => setNewFilterField(evt.target.value)}
              className="flex-shrink-0"
              style={{ width: 'auto' }}
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
            </Form.Select>
            {newFilterMatchType !== 'choice' && (
              <Form.Control
                size="sm"
                value={newFilterValue}
                onChange={(evt) => setNewFilterValue(evt.target.value)}
                id="job-filter-value"
                type="text"
                placeholder="enter filter value"
                className="flex-grow-1"
                style={{ minWidth: '150px' }}
                aria-label="Value"
                required
              />
            )}
            {newFilterMatchType === 'choice' && (
              <Form.Select
                size="sm"
                value={newFilterValue}
                onChange={(evt) => setNewFilterValue(evt.target.value)}
                id="job-filter-choice-value"
                className="flex-grow-1"
                style={{ minWidth: '150px' }}
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
              </Form.Select>
            )}
            <Button
              type="submit"
              size="sm"
              className="bg-light"
              onClick={addNewFieldFilter}
              variant="outline-secondary"
            >
              add
            </Button>
            <Button
              className="bg-light"
              variant="outline-secondary"
              size="sm"
              onClick={clearNewFieldFilter}
            >
              cancel
            </Button>
          </Form>
        </div>
      )}
    </div>
  );
}

ActiveFilters.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
  filterBarFilters: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  isFieldFilterVisible: PropTypes.bool.isRequired,
  toggleFieldFilterVisible: PropTypes.func.isRequired,
  classificationTypes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  clearSelectedJob: PropTypes.func.isRequired,
  updateRange: PropTypes.func.isRequired,
};

export default connect(null, {
  updateRange,
  clearSelectedJob,
})(ActiveFilters);
