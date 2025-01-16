import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { phPlatformsIconsMap } from '../perf-helpers/constants';

export default class PlatformList extends React.Component {
  linuxPlatforms = [];

  macosPlatforms = [];

  windowsPlatforms = [];

  androidPlatforms = [];

  otherPlatforms = [];

  constructor(props) {
    super(props);
    this.state = {
      platformsVersions: {},
      activePlatform: null,
      list: [],
    };
  }

  componentDidMount() {
    this.setPlatforms();
  }

  componentDidUpdate(prevProps) {
    const { items } = this.props;
    if (items !== prevProps.items) {
      this.setState(
        {
          platformsVersions: {},
          activePlatform: null,
          list: [],
        },
        () => this.setPlatforms(),
      );
    }
  }

  setPlatforms = () => {
    const { items } = this.props;
    this.linuxPlatforms = [];
    this.macosPlatforms = [];
    this.windowsPlatforms = [];
    this.androidPlatforms = [];
    this.otherPlatforms = [];

    items.forEach((platform) => {
      if (platform.includes('linux')) {
        this.linuxPlatforms.push(platform);
      } else if (platform.includes('mac') || platform.includes('osx')) {
        this.macosPlatforms.push(platform);
      } else if (platform.includes('win')) {
        this.windowsPlatforms.push(platform);
      } else if (platform.includes('android')) {
        this.androidPlatforms.push(platform);
      } else {
        this.otherPlatforms.push(platform);
      }
    });

    const platformsVersions = {
      linux: this.linuxPlatforms,
      macos: this.macosPlatforms,
      windows: this.windowsPlatforms,
      android: this.androidPlatforms,
      other: this.otherPlatforms,
    };

    this.setState({
      platformsVersions,
    });
  };

  displayList = (platformName) => {
    const { platformsVersions, activePlatform } = this.state;
    this.setState({
      activePlatform: activePlatform === platformName ? null : platformName,
      list: [...platformsVersions[platformName]],
    });
  };

  render() {
    const { platformsVersions, activePlatform, list } = this.state;

    return (
      <div>
        <span
          className="text-left d-flex justify-content-center"
          data-testid="platform-icons"
        >
          {Object.keys(platformsVersions).map((platformName) => {
            const versions = platformsVersions[platformName];
            const icon = phPlatformsIconsMap[platformName];
            return (
              versions.length !== 0 && (
                <div
                  key={`${platformName}`}
                  className={`icon-container ${
                    activePlatform === platformName ? 'active-platform' : ''
                  }`}
                >
                  <FontAwesomeIcon
                    icon={icon}
                    title={versions.join(', ')}
                    data-testid={`${platformName}-platform`}
                    onClick={() => this.displayList(platformName)}
                  />
                </div>
              )
            );
          })}
        </span>
        <div>
          {activePlatform && (
            <div data-testid="displayed-platform-list">
              {list.map((item) => (
                <div key={`${item}`}>{`${item}`}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
}

PlatformList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
};
