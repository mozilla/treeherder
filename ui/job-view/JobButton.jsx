import React from 'react';
import PropTypes from 'prop-types';
import { getBtnClass, findJobInstance } from "../helpers/job";
import { getUrlParam } from "../helpers/location";

export default class JobButtonComponent extends React.Component {
  constructor(props) {
    super(props);
    const { $injector } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.thJobFilters = $injector.get('thJobFilters');
    this.ThResultSetStore = $injector.get('ThResultSetStore');

    this.state = {
      isSelected: false,
      isRunnableSelected: false,
    };
  }

  componentWillMount() {
    const { job } = this.props;
    const { id } = job;
    const urlSelectedJob = getUrlParam('selectedJob');

    if (parseInt(urlSelectedJob) === id) {
      this.setState({ isSelected: true });
    }
  }

  componentDidMount() {
    if (this.state.isSelected) {
      // scroll to make this job if it's selected
      findJobInstance(this.props.job.id, true);
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
    const { visible, status, failureClassificationId } = this.props;
    const { isSelected, isRunnableSelected } = this.state;

    return (
      visible !== nextProps.visible ||
      status !== nextProps.status ||
      failureClassificationId !== nextProps.failureClassificationId ||
      isSelected !== nextState.isSelected ||
      isRunnableSelected !== nextState.isRunnableSelected
    );
  }

  componentWillUnmount() {
    this.setState({ isRunnableSelected: false, isSelected: false });
  }

  setSelected(isSelected) {
    const { job, platform, filterPlatformCb } = this.props;
    // if a job was just classified, and we are in unclassified only mode,
    // then the job no longer meets the filter criteria.  However, if it
    // is still selected, then it should stay visible so that next/previous
    // navigation still works.  Then, as soon as the selection changes, it
    // it will disappear.  So visible must be contingent on the filters AND
    // whether it is still selected.
    job.visible = this.thJobFilters.showJob(job);
    this.setState({ isSelected });
    // filterPlatformCb will keep a job and platform visible if it contains
    // the selected job, so we must pass in if this job is selected or not.
    const selectedJobId = isSelected ? job.id : null;
    filterPlatformCb(platform, selectedJobId);
  }

  toggleRunnableSelected() {
    this.setState({ isRunnableSelected: !this.state.isRunnableSelected });
  }

  render() {
    const { job } = this.props;
    const { isSelected, isRunnableSelected } = this.state;
    const { state, job_type_name, failure_classification_id, end_timestamp,
            start_timestamp, ref_data_name, visible, id,
            job_type_symbol, result } = job;

    if (!visible) return null;
    const resultState = state === "completed" ? result : state;
    const runnable = state === 'runnable';
    const btnClass = getBtnClass(resultState, failure_classification_id);
    let title = `${job_type_name} - ${status}`;

    if (state === 'completed') {
      const duration = Math.round((end_timestamp - start_timestamp) / 60);
      title += ` (${duration} mins)`;
    }

    const classes = ['btn', btnClass, 'filter-shown'];
    const attributes = {
      'data-job-id': id,
      title
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
      <button {...attributes}>{job_type_symbol}</button>
    );
  }
}

JobButtonComponent.propTypes = {
  job: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  visible: PropTypes.bool.isRequired,
  status: PropTypes.string.isRequired,
  platform: PropTypes.object.isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  failureClassificationId: PropTypes.number,  // runnable jobs won't have this
};

JobButtonComponent.defaultProps = {
  failureClassificationId: 1,
};
