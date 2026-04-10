import { useImperativeHandle, forwardRef, memo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import {
  faStar as faStarSolid,
  faMitten,
} from '@fortawesome/free-solid-svg-icons';

import { getBtnClass, formatDuration } from '../../helpers/job';
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

  const {
    state,
    failure_classification_id: jobFailureClassificationId,
    id,
    job_type_symbol: jobTypeSymbol,
    resultStatus: jobResultStatus,
  } = job;

  const onMouseEnter = useCallback(
    (e) => {
      if (state === 'running' && job._durationFetchedAt) {
        const elapsed = Math.floor(
          (Date.now() - job._durationFetchedAt) / 60000,
        );
        const currentDuration = job.duration + elapsed;
        e.currentTarget.title = job.hoverText.replace(
          /\d+ mins?$/,
          formatDuration(currentDuration),
        );
      }
    },
    [state, job],
  );

  if (!visible) return null;

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
    <button type="button" ref={buttonRef} onMouseEnter={state === 'running' ? onMouseEnter : undefined} {...attributes} data-testid="job-btn">
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
