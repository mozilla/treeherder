import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';

import { getBtnClass, findJobInstance } from '../../helpers/job';
import { getSelectedJobId, getUrlParam } from '../../helpers/location';

export default class JobButtonComponent extends React.Component {
  constructor(props) {
    super(props);

    const { job } = this.props;
    const urlSelectedJob = getUrlParam('selectedJob');

    this.state = {
      isSelected: parseInt(urlSelectedJob, 10) === job.id,
      isRunnableSelected: false,
    };
  }

  componentDidMount() {
    const { isSelected } = this.state;
    const { job } = this.props;
    if (isSelected) {
      // scroll to make this job if it's selected
      findJobInstance(job.id, true);
    }
  }

  /**
   * Rather than making this a PureComponent, which does shallow compares of
   * props and state, we are using shouldComponentUpdate, because the
   * ``selectedJobId`` will change for all components, but only the previous
   * selection and the next selection care and need to re-render.  So our
   * logic on shouldComponentUpdate is a little more complex than a simple
   * shallow compare would allow.
   */
  shouldComponentUpdate(nextProps, nextState) {
    const { visible, resultStatus, failureClassificationId } = this.props;
    const { isSelected, isRunnableSelected } = this.state;

    return (
      visible !== nextProps.visible ||
      resultStatus !== nextProps.resultStatus ||
      failureClassificationId !== nextProps.failureClassificationId ||
      isSelected !== nextState.isSelected ||
      isRunnableSelected !== nextState.isRunnableSelected
    );
  }

  componentWillUnmount() {
    this.setState({ isRunnableSelected: false, isSelected: false });
  }

  setSelected(isSelected) {
    const { job, filterPlatformCb, filterModel } = this.props;
    // if a job was just classified, and we are in unclassified only mode,
    // then the job no longer meets the filter criteria.  However, if it
    // is still selected, then it should stay visible so that next/previous
    // navigation still works.  Then, as soon as the selection changes, it
    // it will disappear.  So visible must be contingent on the filters AND
    // whether it is still selected.
    job.visible = filterModel.showJob(job);
    this.setState({ isSelected });
    // filterPlatformCb will keep a job and platform visible if it contains
    // the selected job, so we must pass in if this job is selected or not.
    filterPlatformCb(isSelected ? job.id : null);
  }

  toggleRunnableSelected() {
    this.setState(prevState => ({
      isRunnableSelected: !prevState.isRunnableSelected,
    }));
  }

  refilter() {
    const { filterPlatformCb } = this.props;

    filterPlatformCb(getSelectedJobId());
  }

  render() {
    const { job, resultStatus } = this.props;
    const { isSelected, isRunnableSelected } = this.state;
    const {
      state,
      job_type_name,
      failure_classification_id,
      end_timestamp,
      start_timestamp,
      ref_data_name,
      visible,
      id,
      job_type_symbol,
    } = job;

    if (!visible) return null;
    const runnable = state === 'runnable';
    const btnClass = getBtnClass(resultStatus, failure_classification_id);
    let title = `${resultStatus} | ${job_type_name}`;
    let classifiedIcon = null;

    if (failure_classification_id > 1) {
      classifiedIcon =
        failure_classification_id === 7 ? faStarRegular : faStarSolid;
    }

    if (state === 'completed') {
      const duration = Math.round((end_timestamp - start_timestamp) / 60);
      title += ` (${duration} mins)`;
    }

    const classes = ['btn', btnClass, 'filter-shown'];
    const attributes = {
      'data-job-id': id,
      title,
    };

    if (runnable) {
      classes.push('runnable-job-btn', 'runnable');
      attributes['data-buildername'] = ref_data_name;
      if (isRunnableSelected) {
        classes.push('runnable-job-btn-selected');
      }
    } else {
      classes.push('job-btn');
    }

    if (isSelected) {
      classes.push('selected-job btn-lg-xform');
    } else {
      classes.push('btn-xs');
    }

    attributes.className = classes.join(' ');
    return (
      <button type="button" {...attributes}>
        {job_type_symbol}
        {classifiedIcon && (
          <FontAwesomeIcon
            icon={classifiedIcon}
            className="classified-icon"
            title="classified"
          />
        )}
      </button>
    );
  }
}

JobButtonComponent.propTypes = {
  job: PropTypes.object.isRequired,
  filterModel: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  visible: PropTypes.bool.isRequired,
  resultStatus: PropTypes.string.isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  failureClassificationId: PropTypes.number, // runnable jobs won't have this
};

JobButtonComponent.defaultProps = {
  failureClassificationId: 1,
};
