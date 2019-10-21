import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  UncontrolledDropdown,
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
} from 'reactstrap';

import { thAllResultStatuses } from '../../helpers/constants';
import { getJobsUrl } from '../../helpers/url';
import { setSelectedJob, clearSelectedJob } from '../redux/stores/selectedJob';
import { pinJobs } from '../redux/stores/pinnedJobs';

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
    <UncontrolledDropdown>
      <DropdownToggle
        caret
        id="filterLabel"
        className="btn btn-view-nav nav-menu-btn"
        title="Set filters"
      >
        Filters
      </DropdownToggle>
      <DropdownMenu id="filter-dropdown">
        {resultStatusMenuItems.map(filterName => (
          <DropdownItem toggle={false} key={filterName}>
            <input
              type="checkbox"
              className="mousetrap"
              id={filterName}
              checked={resultStatus.includes(filterName)}
              onChange={() => filterModel.toggleResultStatuses([filterName])}
            />
            {filterName}
          </DropdownItem>
        ))}
        <DropdownItem divider />
        <DropdownItem toggle={false}>
          <input
            type="checkbox"
            id="classified"
            checked={classifiedState.includes('classified')}
            onChange={() => filterModel.toggleClassifiedFilter('classified')}
          />
          classified
        </DropdownItem>
        <DropdownItem toggle={false}>
          <input
            type="checkbox"
            id="unclassified"
            checked={classifiedState.includes('unclassified')}
            onChange={() => filterModel.toggleClassifiedFilter('unclassified')}
          />
          unclassified
        </DropdownItem>
        <DropdownItem divider />
        <DropdownItem
          onClick={pinAllShownJobs}
          title="Pin all jobs that pass the global filters"
        >
          Pin all showing
        </DropdownItem>
        <DropdownItem
          onClick={filterModel.setOnlySuperseded}
          title="Show only superseded jobs"
        >
          Superseded only
        </DropdownItem>
        <DropdownItem
          className="dropdown-item-link"
          title={`Show only pushes for ${email}`}
          href={getJobsUrl({ author: email })}
        >
          My pushes only
        </DropdownItem>
        <DropdownItem
          onClick={filterModel.resetNonFieldFilters}
          title="Reset to default status filters"
        >
          Reset
        </DropdownItem>
      </DropdownMenu>
    </UncontrolledDropdown>
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
  { setSelectedJob, clearSelectedJob, pinJobs },
)(FiltersMenu);
