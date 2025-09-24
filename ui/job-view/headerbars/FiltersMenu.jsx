import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  DropdownMenu,
  DropdownItem,
  DropdownToggle,
  UncontrolledDropdown,
} from 'reactstrap';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';

import {
  thDefaultFilterResultStatuses,
  arraysEqual,
} from '../../helpers/filter';
import { thAllResultStatuses } from '../../helpers/constants';
import { setSelectedJob, clearSelectedJob } from '../redux/stores/selectedJob';
import { pinJobs } from '../redux/stores/pinnedJobs';

const resultStatusMenuItems = thAllResultStatuses.filter(
  (rs) => rs !== 'runnable',
);

function FiltersMenu({
  filterModel,
  pinJobs,
  getAllShownJobs,
  selectedJob = null,
  setSelectedJob,
  user,
}) {
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

  const updateParams = (param, value) => {
    const params = new URLSearchParams(window.location.search);
    params.set(param, value);
    return `?${params.toString()}`;
  };

  return (
    <UncontrolledDropdown>
      <DropdownToggle
        title="Set filters"
        className="btn-view-nav nav-menu-btn"
        caret
      >
        Filters
      </DropdownToggle>
      <DropdownMenu>
        {resultStatusMenuItems.map((filterName) => (
          <DropdownItem
            key={filterName}
            tag="a"
            onClick={() => filterModel.toggleResultStatuses([filterName])}
          >
            <FontAwesomeIcon
              icon={faCheck}
              className={`mr-1 ${
                resultStatus.includes(filterName) ? '' : 'hide'
              }`}
              title={resultStatus.includes(filterName) ? 'Selected' : ''}
            />
            {filterName}
          </DropdownItem>
        ))}
        <DropdownItem divider />
        <DropdownItem
          tag="a"
          onClick={() =>
            arraysEqual(resultStatus, thDefaultFilterResultStatuses) &&
            arraysEqual(classifiedState, ['unclassified', 'classified'])
              ? filterModel.toggleClassifiedFailures(true)
              : filterModel.resetNonFieldFilters()
          }
        >
          <FontAwesomeIcon
            icon={faCheck}
            className={`mr-1 ${
              arraysEqual(resultStatus, thDefaultFilterResultStatuses) &&
              arraysEqual(classifiedState, ['unclassified', 'classified'])
                ? ''
                : 'hide'
            }`}
            title={
              arraysEqual(resultStatus, thDefaultFilterResultStatuses) &&
              arraysEqual(classifiedState, ['unclassified', 'classified'])
                ? 'Selected'
                : ''
            }
          />
          All jobs
        </DropdownItem>
        <DropdownItem
          tag="a"
          onClick={() => filterModel.toggleClassifiedFailures(true)}
        >
          <FontAwesomeIcon
            icon={faCheck}
            className={`mr-1 ${
              filterModel.isClassifiedFailures(true) ? '' : 'hide'
            }`}
            title={filterModel.isClassifiedFailures(true) ? 'Selected' : ''}
          />
          All failures
        </DropdownItem>
        <DropdownItem
          tag="a"
          onClick={() => filterModel.toggleUnclassifiedFailures()}
        >
          <FontAwesomeIcon
            icon={faCheck}
            className={`mr-1 ${
              filterModel.isUnclassifiedFailures() ? '' : 'hide'
            }`}
            title={filterModel.isUnclassifiedFailures() ? 'Selected' : ''}
          />
          Unclassified failures
        </DropdownItem>
        <DropdownItem
          tag="a"
          onClick={() => filterModel.toggleClassifiedFailures()}
        >
          <FontAwesomeIcon
            icon={faCheck}
            className={`mr-1 ${
              filterModel.isClassifiedFailures() ? '' : 'hide'
            }`}
            title={filterModel.isClassifiedFailures() ? 'Selected' : ''}
          />
          Classified failures
        </DropdownItem>
        <DropdownItem divider />
        <DropdownItem
          tag="a"
          title="Pin all jobs that pass the global filters"
          onClick={pinAllShownJobs}
        >
          Pin all showing
        </DropdownItem>
        <DropdownItem
          tag="a"
          title="Show only superseded jobs"
          onClick={filterModel.setOnlySuperseded}
        >
          Superseded only
        </DropdownItem>
        <DropdownItem title={`Show only pushes for ${email}`}>
          <Link
            className="dropdown-link"
            to={{ search: updateParams('author', email) }}
          >
            My pushes only
          </Link>
        </DropdownItem>
        <DropdownItem title="Do not show pushes from reviewbot">
          <Link
            className="dropdown-link"
            to={{ search: updateParams('author', '-reviewbot') }}
          >
            Hide code review pushes
          </Link>
        </DropdownItem>
        <DropdownItem
          tag="a"
          title="Reset to default status filters"
          onClick={filterModel.resetNonFieldFilters}
        >
          Reset
        </DropdownItem>
      </DropdownMenu>
    </UncontrolledDropdown>
  );
}

FiltersMenu.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
  pinJobs: PropTypes.func.isRequired,
  setSelectedJob: PropTypes.func.isRequired,
  getAllShownJobs: PropTypes.func.isRequired,
  selectedJob: PropTypes.shape({}),
  user: PropTypes.shape({}).isRequired,
};

const mapStateToProps = ({ selectedJob: { selectedJob } }) => ({ selectedJob });

export default connect(mapStateToProps, {
  setSelectedJob,
  clearSelectedJob,
  pinJobs,
})(FiltersMenu);
