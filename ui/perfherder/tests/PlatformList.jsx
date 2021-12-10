import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWindows,
  faLinux,
  faApple,
  faAndroid,
} from '@fortawesome/free-brands-svg-icons';
import { faQuestionCircle } from '@fortawesome/free-regular-svg-icons';

export default class PlatformList extends React.Component {
  linuxPlatforms = [];

  macosPlatforms = [];

  windowsPlatforms = [];

  androidPlatforms = [];

  otherPlatforms = [];

  constructor(props) {
    super(props);
    this.state = {
      platforms: {},
      activePlatform: null,
      list: [],
    };
  }

  componentDidMount() {
    this.setPlatforms();
  }

  setPlatforms = () => {
    const { items } = this.props;

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

    const platforms = {
      linux: {
        name: 'linux',
        versions: this.linuxPlatforms,
        icon: faLinux,
      },
      macos: {
        name: 'macos',
        versions: this.macosPlatforms,
        icon: faApple,
      },
      windows: {
        name: 'windows',
        versions: this.windowsPlatforms,
        icon: faWindows,
      },
      android: {
        name: 'android',
        versions: this.androidPlatforms,
        icon: faAndroid,
      },
      other: {
        name: 'other',
        versions: this.otherPlatforms,
        icon: faQuestionCircle,
      },
    };

    this.setState({
      platforms,
    });
  };

  displayList = (name) => {
    const { platforms, activePlatform } = this.state;
    this.setState({
      activePlatform: activePlatform === name ? null : name,
      list: [...platforms[name].versions],
    });
  };

  render() {
    const { platforms, activePlatform, list } = this.state;

    return (
      <div>
        <span
          className="text-left d-flex justify-content-center"
          data-testid="platform-icons"
        >
          {Object.keys(platforms).map((key) => {
            const platform = platforms[key];
            const { name, icon, versions } = platform;
            return (
              versions.length !== 0 && (
                <div
                  key={`${name}`}
                  className={`icon-container ${
                    activePlatform === name ? 'active-platform' : ''
                  }`}
                >
                  <FontAwesomeIcon
                    icon={icon}
                    title={versions.join(', ')}
                    data-testid={`${name}-platform`}
                    onClick={() => this.displayList(name)}
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
