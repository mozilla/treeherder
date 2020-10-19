import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';

import { getBtnClass, findJobInstance } from '../../helpers/job';
import { getUrlParam } from '../../helpers/location';

export default class JobButtonComponent extends React.Component {
  constructor(props) {
    super(props);

    const { job } = this.props;
    const urlSelectedTaskRun = getUrlParam('selectedTaskRun');

    this.state = {
      isSelected: urlSelectedTaskRun === job.task_run,
      isRunnableSelected: false,
    };
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
    filterPlatformCb(isSelected ? job.task_run : null);
  }

  toggleRunnableSelected() {
    this.setState((prevState) => ({
      isRunnableSelected: !prevState.isRunnableSelected,
    }));
  }

  refilter() {
    const { filterPlatformCb } = this.props;

    filterPlatformCb(getUrlParam('selectedTaskRun'));
  }

  render() {
    const { job } = this.props;
    const { isSelected, isRunnableSelected } = this.state;
    const {
      state,
      failure_classification_id: failureClassificationId,
      visible,
      id,
      job_type_symbol: jobTypeSymbol,
      resultStatus,
    } = job;

    if (!visible) return null;
    const runnable = state === 'runnable';
    const btnClass = getBtnClass(resultStatus, failureClassificationId);
    let classifiedIcon = null;

    if (failureClassificationId > 1) {
      classifiedIcon =
        failureClassificationId === 7 ? faStarRegular : faStarSolid;
    }

    const classes = ['btn', btnClass, 'filter-shown'];
    const attributes = {
      'data-job-id': id,
      title: job.hoverText,
    };

    if (runnable) {
      classes.push('runnable-job-btn', 'runnable');
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
        {jobTypeSymbol}
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
  job: PropTypes.shape({}).isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  repoName: PropTypes.string.isRequired,
  visible: PropTypes.bool.isRequired,
  resultStatus: PropTypes.string.isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  failureClassificationId: PropTypes.number, // runnable jobs won't have this
};

JobButtonComponent.defaultProps = {
  failureClassificationId: 1,
};
