import React from 'react';
import PropTypes from 'prop-types';
import { getBtnClass, findJobInstance } from "../helpers/jobHelper";

export default class JobButtonComponent extends React.Component {
  constructor(props) {
    super(props);
    const { $injector } = this.props;

    this.$rootScope = $injector.get('$rootScope');
    this.thEvents = $injector.get('thEvents');
    this.ThResultSetStore = $injector.get('ThResultSetStore');

    this.state = {
      isSelected: false,
      isRunnableSelected: false,
    };
  }

  componentWillMount() {
    const { job } = this.props;
    const { id } = job;
    const urlSelectedJob = new URLSearchParams(
      location.hash.split('?')[1]).get('selectedJob');

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
    this.setState({ isSelected });
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
      'data-ignore-job-clear-on-click': true,
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
  failureClassificationId: PropTypes.number,  // runnable jobs won't have this
  hasGroup: PropTypes.bool.isRequired,
};
