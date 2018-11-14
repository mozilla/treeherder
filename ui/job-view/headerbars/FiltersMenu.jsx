import React from 'react';
import PropTypes from 'prop-types';

import { thAllResultStatuses } from '../../helpers/constants';
import { withPinnedJobs } from '../context/PinnedJobs';
import { withSelectedJob } from '../context/SelectedJob';
import { withPushes } from '../context/Pushes';

const resultStatusMenuItems = thAllResultStatuses.filter(
  rs => rs !== 'runnable',
);

function FiltersMenu(props) {
  const {
    filterModel,
    pinJobs,
    getAllShownJobs,
    selectedJob,
    setSelectedJob,
  } = props;
  const {
    urlParams: { resultStatus, classifiedState },
  } = filterModel;

  const pinAllShownJobs = () => {
    const shownJobs = getAllShownJobs();

    pinJobs(shownJobs);
    if (!selectedJob) {
      setSelectedJob(shownJobs[0]);
    }
  };

  return (
    <span>
      <span className="dropdown">
        <button
          id="filterLabel"
          title="Set filters"
          data-toggle="dropdown"
          className="btn btn-view-nav nav-menu-btn dropdown-toggle"
        >
          Filters
        </button>
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
                      onChange={() =>
                        filterModel.toggleResultStatuses([filterName])
                      }
                    />
                    {filterName}
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
            />
            classified
          </label>
          <label className="dropdown-item">
            <input
              type="checkbox"
              id="unclassified"
              checked={classifiedState.includes('unclassified')}
              onChange={() =>
                filterModel.toggleClassifiedFilter('unclassified')
              }
            />
            unclassified
          </label>
          <li className="dropdown-divider separator" />
          <li
            title="Pin all jobs that pass the global filters"
            className="dropdown-item"
            onClick={pinAllShownJobs}
          >
            Pin all showing
          </li>
          <li
            title="Show only superseded jobs"
            className="dropdown-item"
            onClick={filterModel.setOnlySuperseded}
          >
            Superseded only
          </li>
          <li
            title="Reset to default status filters"
            className="dropdown-item"
            onClick={filterModel.resetNonFieldFilters}
          >
            Reset
          </li>
        </ul>
      </span>
    </span>
  );
}

FiltersMenu.propTypes = {
  filterModel: PropTypes.object.isRequired,
  pinJobs: PropTypes.func.isRequired,
  setSelectedJob: PropTypes.func.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  selectedJob: PropTypes.object,
};

FiltersMenu.defaultProps = {
  selectedJob: null,
};

export default withPushes(withSelectedJob(withPinnedJobs(FiltersMenu)));
