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
        title="Set filters"
        className="btn-view-nav nav-menu-btn"
        caret
      >
        Filters
      </DropdownToggle>
      <DropdownMenu>
        {resultStatusMenuItems.map(filterName => (
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
          onClick={() => filterModel.toggleClassifiedFilter('classified')}
        >
          <FontAwesomeIcon
            icon={faCheck}
            className={`mr-1 ${
              classifiedState.includes('classified') ? '' : 'hide'
            }`}
            title={classifiedState.includes('classified') ? 'Selected' : ''}
          />
          classified
        </DropdownItem>
        <DropdownItem
          tag="a"
          onClick={() => filterModel.toggleClassifiedFilter('unclassified')}
        >
          <FontAwesomeIcon
            icon={faCheck}
            className={`mr-1 ${
              classifiedState.includes('unclassified') ? '' : 'hide'
            }`}
            title={classifiedState.includes('unclassified') ? 'Selected' : ''}
          />
          unclassified
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
        <DropdownItem
          tag="a"
          title={`Show only pushes for ${email}`}
          href={getJobsUrl({ author: email })}
        >
          My pushes only
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

export default connect(mapStateToProps, {
  setSelectedJob,
  clearSelectedJob,
  pinJobs,
})(FiltersMenu);
