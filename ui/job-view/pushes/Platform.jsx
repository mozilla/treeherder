import PropTypes from 'prop-types';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { thSimplePlatforms } from '../../helpers/constants';
import { getUrlParam } from '../../helpers/location';

import JobsAndGroups from './JobsAndGroups';

function PlatformName({ title }) {
  return (
    <td className="platform">
      <span title={title}>{title}</span>
    </td>
  );
}

PlatformName.propTypes = {
  title: PropTypes.string.isRequired,
};

function Platform({
  platform,
  filterModel,
  pushGroupState,
  duplicateJobsVisible,
  groupCountsExpanded,
  runnableVisible,
  toggleSelectedRunnableJob,
}) {
  const [filteredPlatform, setFilteredPlatform] = useState(platform);

  // Track previous props for comparison
  const prevPropsRef = useRef({
    platform,
    filterModel,
    pushGroupState,
    duplicateJobsVisible,
    groupCountsExpanded,
    runnableVisible,
  });

  const filter = useCallback(
    (selectedTaskRun) => {
      const newFilteredPlatform = { ...platform };

      newFilteredPlatform.visible = false;
      newFilteredPlatform.groups.forEach((group) => {
        group.visible = false;
        group.jobs.forEach((job) => {
          job.visible =
            filterModel.showJob(job) || job.task_run === selectedTaskRun;
          if (job.state === 'runnable') {
            job.visible = job.visible && runnableVisible;
          }
          job.selected = selectedTaskRun
            ? job.task_run === selectedTaskRun
            : false;
          if (job.visible) {
            newFilteredPlatform.visible = true;
            group.visible = true;
          }
        });
      });
      setFilteredPlatform(newFilteredPlatform);
    },
    [platform, filterModel, runnableVisible],
  );

  const filterCb = useCallback(
    (selectedTaskRun) => {
      filter(selectedTaskRun);
    },
    [filter],
  );

  useEffect(() => {
    const selectedTaskRun = getUrlParam('selectedTaskRun');
    filter(selectedTaskRun);
  }, [filter]);

  // componentDidUpdate - check for prop changes
  useEffect(() => {
    const prevProps = prevPropsRef.current;
    const propsToCheck = [
      'platform',
      'filterModel',
      'pushGroupState',
      'duplicateJobsVisible',
      'groupCountsExpanded',
      'runnableVisible',
    ];

    const currentProps = {
      platform,
      filterModel,
      pushGroupState,
      duplicateJobsVisible,
      groupCountsExpanded,
      runnableVisible,
    };

    const hasChanged = propsToCheck.some(
      (prop) => prevProps[prop] !== currentProps[prop],
    );

    if (hasChanged) {
      filter(getUrlParam('selectedTaskRun'));
    }

    prevPropsRef.current = currentProps;
  }, [
    platform,
    filterModel,
    pushGroupState,
    duplicateJobsVisible,
    groupCountsExpanded,
    runnableVisible,
    filter,
  ]);

  const suffix =
    (thSimplePlatforms.includes(filteredPlatform.name) &&
      filteredPlatform.option === 'opt') ||
    filteredPlatform.name.includes('Shippable') ||
    ['asan', 'tsan', 'ccov', 'mingw', 'nightlyasrelease'].some((type) =>
      filteredPlatform.name.toLowerCase().includes(type),
    )
      ? ''
      : ` ${filteredPlatform.option}`;
  const title = `${filteredPlatform.name}${suffix}`;

  return filteredPlatform.visible ? (
    <tr key={title}>
      <PlatformName title={title} />
      <JobsAndGroups
        groups={filteredPlatform.groups}
        filterPlatformCb={filterCb}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
        duplicateJobsVisible={duplicateJobsVisible}
        groupCountsExpanded={groupCountsExpanded}
        runnableVisible={runnableVisible}
        toggleSelectedRunnableJob={toggleSelectedRunnableJob}
      />
    </tr>
  ) : (
    <React.Fragment />
  );
}

Platform.propTypes = {
  platform: PropTypes.shape({}).isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  runnableVisible: PropTypes.bool.isRequired,
};

export default Platform;
