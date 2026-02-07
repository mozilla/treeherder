import { useImperativeHandle, forwardRef, memo } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import {
  faStar as faStarSolid,
  faMitten,
} from '@fortawesome/free-solid-svg-icons';

import { getBtnClass } from '../../helpers/job';
import { useJobButtonRegistry } from '../../hooks/useJobButtonRegistry';

const JobButtonComponent = forwardRef(function JobButtonComponent(
  { job, filterModel, visible, filterPlatformCb, intermittent = false },
  ref,
) {
  const {
    isSelected,
    isRunnableSelected,
    setSelected,
    toggleRunnableSelected,
    refilter,
    buttonRef,
  } = useJobButtonRegistry(job, filterModel, filterPlatformCb);

  // Expose imperative methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      props: { job, visible },
      setSelected,
      toggleRunnableSelected,
      refilter,
    }),
    [job, visible, setSelected, toggleRunnableSelected, refilter],
  );

  if (!visible) return null;

  const {
    state,
    failure_classification_id: jobFailureClassificationId,
    id,
    job_type_symbol: jobTypeSymbol,
    resultStatus: jobResultStatus,
  } = job;

  const runnable = state === 'runnable';
  const { status, isClassified } = getBtnClass(
    jobResultStatus,
    jobFailureClassificationId,
  );
  let classifiedIcon = null;

  if (
    jobFailureClassificationId > 1 &&
    ![6, 8].includes(jobFailureClassificationId)
  ) {
    classifiedIcon =
      jobFailureClassificationId === 7 ? faStarRegular : faStarSolid;
  }

  const classes = ['btn', 'filter-shown'];
  const attributes = {
    'data-job-id': id,
    'data-status': status,
    title: job.hoverText,
  };

  if (isClassified) {
    attributes['data-classified'] = 'true';
  }

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
    attributes['data-testid'] = 'selected-job';
  } else {
    classes.push('btn-xs');
  }

  attributes.className = classes.join(' ');
  return (
    <button type="button" ref={buttonRef} {...attributes} data-testid="job-btn">
      {jobTypeSymbol}
      {classifiedIcon && (
        <FontAwesomeIcon
          icon={classifiedIcon}
          className="classified-icon"
          title="classified"
        />
      )}
      {intermittent && (
        <FontAwesomeIcon
          icon={faMitten}
          className="intermittent-icon"
          title="Intermittent failure - There is a successful run of this task for the same push."
        />
      )}
    </button>
  );
});

JobButtonComponent.propTypes = {
  job: PropTypes.shape({}).isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  visible: PropTypes.bool.isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  intermittent: PropTypes.bool,
};

export default memo(JobButtonComponent);
