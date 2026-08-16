import { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { useLocation } from 'react-router';

import { updateRange } from '../../shared/stores/pushesStore';
import { clearSelectedJob } from '../../shared/stores/selectedJobStore';
import { getFieldChoices } from '../../helpers/filter';

function ActiveFilters({
  filterModel,
  filterBarFilters,
  classificationTypes,
}) {
  const location = useLocation();

  const fieldChoices = useMemo(() => {
    const choices = getFieldChoices();
    choices.failure_classification_id.choices = classificationTypes;
    return choices;
  }, [classificationTypes]);

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
    [location.search, filterModel, updateRange],
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
    </div>
  );
}

ActiveFilters.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
  filterBarFilters: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  classificationTypes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default ActiveFilters;
