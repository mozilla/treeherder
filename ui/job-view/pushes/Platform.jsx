import PropTypes from 'prop-types';
import React from 'react';

import JobsAndGroups from './JobsAndGroups';

function PlatformName(props) {
  const titleText = props.title;
  return (
    <td className="platform">
      <span title={titleText}>{titleText}</span>
    </td>
  );
}

PlatformName.propTypes = {
  title: PropTypes.string.isRequired,
};

export default function Platform(props) {
  const {
    platform, repoName, filterPlatformCb, filterModel, pushGroupState,
    duplicateJobsVisible, groupCountsExpanded,
  } = props;
  const { title, groups, id } = platform;

  return (
    <tr id={id} key={id}>
      <PlatformName title={title} />
      <JobsAndGroups
        groups={groups}
        repoName={repoName}
        filterPlatformCb={filterPlatformCb}
        platform={platform}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
        duplicateJobsVisible={duplicateJobsVisible}
        groupCountsExpanded={groupCountsExpanded}
      />
    </tr>
  );
}

Platform.propTypes = {
  platform: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.object.isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
};
