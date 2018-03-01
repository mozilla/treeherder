import PropTypes from 'prop-types';
import React from 'react';
import JobsAndGroups from './JobsAndGroups';

function PlatformName(props) {
  const titleText = `${props.platform.name} ${props.platform.option}`;
  return (
    <td className="platform">
      <span title={titleText}>{titleText}</span>
    </td>
  );
}

// Contrary to what this rule says, we must use a class since PushJobs sets
// a `ref` on `Platform`, and refs can't be used with stateless functions:
// https://reactjs.org/docs/refs-and-the-dom.html#refs-and-functional-components
// https://github.com/yannickcr/eslint-plugin-react/issues/1004
// eslint-disable-next-line react/prefer-stateless-function
export default class Platform extends React.Component {
  render() {
    const { platform, $injector, repoName, filterPlatformCb } = this.props;

    return (
      <tr id={platform.id} key={platform.id}>
        <PlatformName platform={platform} />
        <JobsAndGroups
          groups={platform.groups}
          repoName={repoName}
          $injector={$injector}
          filterPlatformCb={filterPlatformCb}
          platform={platform}
        />
      </tr>
    );
  }
}

Platform.propTypes = {
  platform: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  $injector: PropTypes.object.isRequired,
};
