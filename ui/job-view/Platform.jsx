import PropTypes from 'prop-types';
import React from 'react';
import JobsAndGroups from './JobsAndGroups';

const PlatformName = (props) => {
  const titleText = `${props.platform.name} ${props.platform.option}`;
  return (
    <td className="platform">
      <span title={titleText}>{titleText}</span>
    </td>
  );
};

export default class Platform extends React.Component {
  render() {
    const { platform, $injector, repoName } = this.props;

    return (
      <tr id={platform.id} key={platform.id}>
        <PlatformName platform={platform} />
        <JobsAndGroups
          groups={platform.groups}
          repoName={repoName}
          $injector={$injector}
        />
      </tr>
    );
  }
}

Platform.propTypes = {
  platform: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
};

