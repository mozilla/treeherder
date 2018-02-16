import PropTypes from 'prop-types';
import React from 'react';
import JobButton from './JobButton';
import JobGroup from './JobGroup';

export default class JobsAndGroups extends React.Component {
  render() {
    const { $injector, groups, repoName } = this.props;

    return (
      <td className="job-row">
        {groups.map((group, i) => {
          if (group.symbol !== '?') {
            return (
              group.visible && <JobGroup
                group={group}
                repoName={repoName}
                $injector={$injector}
                refOrder={i}
                key={group.mapKey}
                ref={i}
                expanded={this.props.expanded}
              />
            );
          }
          return (
            group.jobs.map(job => (
              <JobButton
                job={job}
                $injector={$injector}
                repoName={repoName}
                visible={job.visible}
                key={job.id}
                hasGroup={false}
                ref={i}
                refOrder={i}
              />
            ))
          );
        })}
      </td>
    );
  }
}

JobsAndGroups.propTypes = {
  groups: PropTypes.array.isRequired,
  $injector: PropTypes.object.isRequired,
};
