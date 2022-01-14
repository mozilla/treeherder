import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { thPlatformMap } from '../../helpers/constants';
import { phPlatformsIconsMap } from '../perf-helpers/constants';

export default class AlertTablePlatform extends React.PureComponent {
  getOSClassIcon(platform) {
    if (platform.includes('linux')) {
      return phPlatformsIconsMap.linux;
    }
    if (platform.includes('mac') || platform.includes('osx')) {
      return phPlatformsIconsMap.macos;
    }
    if (platform.includes('win')) {
      return phPlatformsIconsMap.windows;
    }
    if (platform.includes('android')) {
      return phPlatformsIconsMap.android;
    }
    return phPlatformsIconsMap.other;
  }

  render() {
    const { platform } = this.props;

    return (
      <SimpleTooltip
        textClass="detail-hint pb-1 fa-lg"
        text={
          <FontAwesomeIcon
            icon={this.getOSClassIcon(platform)}
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
