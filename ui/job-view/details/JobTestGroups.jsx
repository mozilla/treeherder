import React from 'react';
import PropTypes from 'prop-types';

export default class JobTestGroups extends React.PureComponent {
  render() {
    const { testGroups } = this.props;
    const currentLocation = window.location.href;

    return (
      <div className="job-test-groups" role="region" aria-label="Test Groups">
        {testGroups.length > 0 && (
          <div className="job-test-groups-list">
            <strong>Test Groups</strong>
            <ul className="list-unstyled">
              {testGroups.map((testGroup) => (
                <li className="fs-80" key={testGroup}>
                  <a
                    href={`${currentLocation}&test_paths=${testGroup}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {testGroup}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
}

JobTestGroups.propTypes = {
  testGroups: PropTypes.arrayOf(PropTypes.string),
};
