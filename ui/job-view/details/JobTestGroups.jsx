import React from 'react';
import PropTypes from 'prop-types';
import { Queue } from 'taskcluster-client-web';

export default class JobTestGroups extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      testGroups: [],
    };
  }

  componentDidMount() {
    this.fetch();
  }

  // Because we use Tab with forceRender it does not call componentDidMount
  // even though the props have changes
  componentDidUpdate(prevProps) {
    if (this.props.taskId !== prevProps.taskId) {
      this.fetch();
    }
  }

  async fetch() {
    const { notifyTestGroupsAvailable, taskId, rootUrl } = this.props;
    if (taskId) {
      const queue = new Queue({ rootUrl });
      const taskDefinition = await queue.task(taskId);
      if (taskDefinition && taskDefinition.payload.env.MOZHARNESS_TEST_PATHS) {
        this.setState({
          testGroups: Object.values(
            JSON.parse(taskDefinition.payload.env.MOZHARNESS_TEST_PATHS),
          )[0],
        });
        notifyTestGroupsAvailable(true);
      } else {
        notifyTestGroupsAvailable(false);
      }
    }
  }

  render() {
    const { testGroups } = this.state;
    const currentLocation = window.location.href;

    return (
      <div className="job-test-groups" role="region" aria-label="Test Groups">
        {testGroups.length > 0 && (
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
        )}
      </div>
    );
  }
}

JobTestGroups.propTypes = {
  notifyTestGroupsAvailable: PropTypes.func.isRequired,
  taskId: PropTypes.string.isRequired,
  rootUrl: PropTypes.string.isRequired,
};
