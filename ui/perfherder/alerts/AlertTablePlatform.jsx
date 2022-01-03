import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { thPlatformMap } from '../../helpers/constants';
import { platformsIcons } from '../perf-helpers/constants';

export default class AlertTablePlatform extends React.PureComponent {
  getOSClass(platform) {
    if (platform.includes('linux')) {
      return platformsIcons.linux;
    }
    if (platform.includes('mac') || platform.includes('osx')) {
      return platformsIcons.macos;
    }
    if (platform.includes('win')) {
      return platformsIcons.windows;
    }
    if (platform.includes('android')) {
      return platformsIcons.android;
    }
    return platformsIcons.other;
  }

  render() {
    const { platform } = this.props;

    return (
      <SimpleTooltip
        text={
          <FontAwesomeIcon
            icon={this.getOSClass(platform)}
            data-testid="alert-platform-icon"
          />
        }
        tooltipText={thPlatformMap[platform]}
      />
    );
  }
}

AlertTablePlatform.propTypes = {
  platform: PropTypes.string.isRequired,
};
