import PropTypes from 'prop-types';
import React from 'react';
import JobsAndGroups from './JobsAndGroups';

function PlatformName(props) {
  const titleText = `${props.name} ${props.option}`;
  return (
    <td className="platform">
      <span title={titleText}>{titleText}</span>
    </td>
  );
}

export default function Platform(props) {
  const { platform, $injector, repoName, filterPlatformCb } = props;
  const { name, option, groups, id } = platform;

  return (
    <tr id={id} key={id}>
      <PlatformName name={name} option={option} />
      <JobsAndGroups
        groups={groups}
        repoName={repoName}
        $injector={$injector}
        filterPlatformCb={filterPlatformCb}
        platform={platform}
      />
    </tr>
  );
}

Platform.propTypes = {
  platform: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  $injector: PropTypes.object.isRequired,
};
