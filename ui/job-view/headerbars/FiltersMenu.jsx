import React from 'react';
import PropTypes from 'prop-types';

import { thAllResultStatuses } from '../../js/constants';

const resultStatusMenuItems = thAllResultStatuses.filter(rs => rs !== 'runnable');

export default function FiltersMenu(props) {
  const { filterModel, pinJobs } = props;
  const { urlParams: { resultStatus, classifiedState } } = filterModel;

  return (
    <span>
      <span className="dropdown">
        <button
          id="filterLabel"
          title="Set filters"
          data-toggle="dropdown"
          className="btn btn-view-nav nav-menu-btn dropdown-toggle"
        >Filters</button>
        <ul
          id="filter-dropdown"
          className="dropdown-menu nav-dropdown-menu-right checkbox-dropdown-menu"
          role="menu"
          aria-labelledby="filterLabel"
        >
          <li>
            {resultStatusMenuItems.map(filterName => (
              <span key={filterName}>
                <span>
                  <label className="dropdown-item">
                    <input
                      type="checkbox"
                      className="mousetrap"
                      id={filterName}
                      checked={resultStatus.includes(filterName)}
                      onChange={() => filterModel.toggleResultStatuses([filterName])}
                    />{filterName}
                  </label>
                </span>
              </span>
            ))}
          </li>
          <li className="dropdown-divider separator" />
          <label className="dropdown-item">
            <input
              type="checkbox"
              id="classified"
              checked={classifiedState.includes('classified')}
              onChange={() => filterModel.toggleClassifiedFilter('classified')}
            />classified
          </label>
          <label className="dropdown-item">
            <input
              type="checkbox"
              id="unclassified"
              checked={classifiedState.includes('unclassified')}
              onChange={() => filterModel.toggleClassifiedFilter('unclassified')}
            />unclassified
          </label>
          <li className="dropdown-divider separator" />
          <li
            title="Pin all jobs that pass the global filters"
            className="dropdown-item"
            onClick={pinJobs}
          >Pin all showing</li>
          <li
            title="Show only superseded jobs"
            className="dropdown-item"
            onClick={filterModel.setOnlySuperseded}
          >Superseded only</li>
          <li
            title="Reset to default status filters"
            className="dropdown-item"
            onClick={filterModel.resetNonFieldFilters}
          >Reset</li>
        </ul>
      </span>
    </span>
  );
}

FiltersMenu.propTypes = {
  filterModel: PropTypes.object.isRequired,
  pinJobs: PropTypes.func.isRequired,
};
