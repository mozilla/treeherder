import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Label } from 'reactstrap';

import { thAllResultStatuses } from '../../helpers/constants';
import { getJobsUrl } from '../../helpers/url';
import { withPinnedJobs } from '../context/PinnedJobs';
import { setSelectedJob, clearSelectedJob } from '../redux/stores/selectedJob';

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
    user,
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
  const { email } = user;

  return (
    <span>
      <span className="dropdown">
        <button
          id="filterLabel"
          type="button"
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
                  <Label className="dropdown-item">
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
                  </Label>
                </span>
              </span>
            ))}
          </li>
          <li className="dropdown-divider separator" />
          <Label className="dropdown-item">
            <input
              type="checkbox"
              id="classified"
              checked={classifiedState.includes('classified')}
              onChange={() => filterModel.toggleClassifiedFilter('classified')}
            />
            classified
          </Label>
          <Label className="dropdown-item">
            <input
              type="checkbox"
              id="unclassified"
              checked={classifiedState.includes('unclassified')}
              onChange={() =>
                filterModel.toggleClassifiedFilter('unclassified')
              }
            />
            unclassified
          </Label>
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
          <li title={`Show only pushes for ${email}`} className="dropdown-item">
            <a href={getJobsUrl({ author: email })}>My pushes only</a>
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
  user: PropTypes.object.isRequired,
};

FiltersMenu.defaultProps = {
  selectedJob: null,
};

const mapStateToProps = ({ selectedJob: { selectedJob } }) => ({ selectedJob });

export default connect(
  mapStateToProps,
  { setSelectedJob, clearSelectedJob },
)(withPinnedJobs(FiltersMenu));
