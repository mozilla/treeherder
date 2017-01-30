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
    return (
      <tr id={this.props.platform.id} key={this.props.platform.id}>
        <PlatformName platform={this.props.platform} />
        <JobsAndGroups
          groups={this.props.platform.groups}
          $injector={this.props.$injector}
        />
      </tr>
    );
  }
}

Platform.propTypes = {
  platform: PropTypes.object.isRequired,
  $injector: PropTypes.object.isRequired,
};

