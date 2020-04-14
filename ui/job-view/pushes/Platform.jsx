import PropTypes from 'prop-types';
import React from 'react';

import { thSimplePlatforms } from '../../helpers/constants';
import { getSelectedJobId } from '../../helpers/location';
import { didObjectsChange } from '../../helpers/object';

import JobsAndGroups from './JobsAndGroups';

function PlatformName(props) {
  const titleText = props.title;
  return (
    <td className="platform">
      <span title={titleText}>{titleText}</span>
    </td>
  );
}

PlatformName.propTypes = {
  title: PropTypes.string.isRequired,
};

export default class Platform extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      filteredPlatform: props.platform,
    };
  }

  componentDidMount() {
    const selectedJobId = getSelectedJobId();

    this.filter(selectedJobId);
  }

  componentDidUpdate(nextProps) {
    if (
      didObjectsChange(nextProps, this.props, [
        'platform',
        'filterModel',
        'pushGroupState',
        'duplicateJobsVisible',
        'groupCountsExpanded',
        'runnableVisible',
      ])
    ) {
      this.filter(getSelectedJobId());
    }
  }

  filter = selectedJobId => {
    const { platform, filterModel, runnableVisible } = this.props;
    const filteredPlatform = { ...platform };

    filteredPlatform.visible = false;
    filteredPlatform.groups.forEach(group => {
      group.visible = false;
      group.jobs.forEach(job => {
        job.visible = filterModel.showJob(job) || job.id === selectedJobId;
        if (job.state === 'runnable') {
          job.visible = job.visible && runnableVisible;
        }
        job.selected = selectedJobId ? job.id === selectedJobId : false;
        if (job.visible) {
          filteredPlatform.visible = true;
          group.visible = true;
        }
      });
    });
    this.setState({ filteredPlatform });
  };

  filterCb = selectedJobId => {
    this.filter(selectedJobId);
  };

  render() {
    const {
      repoName,
      filterModel,
      pushGroupState,
      duplicateJobsVisible,
      groupCountsExpanded,
    } = this.props;
    const { filteredPlatform } = this.state;
    const suffix =
      thSimplePlatforms.includes(filteredPlatform.name) &&
      filteredPlatform.option === 'opt'
        ? ''
        : ` ${filteredPlatform.option}`;
    const title = `${filteredPlatform.name}${suffix}`;

    return filteredPlatform.visible ? (
      <tr key={title}>
        <PlatformName title={title} />
        <JobsAndGroups
          groups={filteredPlatform.groups}
          repoName={repoName}
          filterPlatformCb={this.filterCb}
          filterModel={filterModel}
          pushGroupState={pushGroupState}
          duplicateJobsVisible={duplicateJobsVisible}
          groupCountsExpanded={groupCountsExpanded}
        />
      </tr>
    ) : (
      <React.Fragment />
    );
  }
}

Platform.propTypes = {
  platform: PropTypes.shape({}).isRequired,
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  runnableVisible: PropTypes.bool.isRequired,
};
