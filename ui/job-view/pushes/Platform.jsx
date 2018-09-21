import PropTypes from 'prop-types';
import React from 'react';
import JobsAndGroups from './JobsAndGroups';

function PlatformName(props) {
  const titleText = props.title;
  return (
    <td className="platform" data-job-clear-on-click>
      <span title={titleText} data-job-clear-on-click>{titleText}</span>
    </td>
  );
}

PlatformName.propTypes = {
  title: PropTypes.string.isRequired,
};

export default function Platform(props) {
  const {
    platform, $injector, repoName, filterPlatformCb, filterModel, pushGroupState,
  } = props;
  const { title, groups, id } = platform;

  return (
    <tr id={id} key={id} data-job-clear-on-click>
      <PlatformName title={title} />
      <JobsAndGroups
        groups={groups}
        repoName={repoName}
        $injector={$injector}
        filterPlatformCb={filterPlatformCb}
        platform={platform}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
      />
    </tr>
  );
}

Platform.propTypes = {
  platform: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  $injector: PropTypes.object.isRequired,
  filterModel: PropTypes.object.isRequired,
  filterPlatformCb: PropTypes.func.isRequired,
  pushGroupState: PropTypes.string.isRequired,
};
