import React from 'react';
import PropTypes from 'prop-types';

export default class JobTestGroups extends React.PureComponent {
  render() {
    const { taskDefinition } = this.props;
    let testGroups = [];
    if (taskDefinition.payload.env.MOZHARNESS_TEST_PATHS) {
      [testGroups] = Object.values(
        JSON.parse(taskDefinition.payload.env.MOZHARNESS_TEST_PATHS),
      );
    }
    const currentLocation = window.location.href;

    return (
      <div className="job-test-groups" role="region" aria-label="Test Groups">
        <div className="job-test-groups-list">
          <strong>Test Groups</strong>
          <ul className="list-unstyled">
            {testGroups.map((testGroup) => (
              <li className="small" key={testGroup}>
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
      </div>
    );
  }
}

JobTestGroups.propTypes = {
  taskDefinition: PropTypes.shape({
    payload: PropTypes.shape({
      env: PropTypes.shape({}),
    }),
  }),
};

JobTestGroups.defaultProps = {
  taskDefinition: {},
};
