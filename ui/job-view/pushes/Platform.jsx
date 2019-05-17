import PropTypes from 'prop-types';
import React from 'react';

import { thSimplePlatforms } from '../../helpers/constants';
import { getUrlParam } from '../../helpers/location';

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
  static getDerivedStateFromProps(nextProps) {
    const { filterModel, runnableVisible } = nextProps;
    const selectedJobId = parseInt(getUrlParam('selectedJob') || '0', 10);

    return {
      filteredPlatform: Platform.filter(
        nextProps.platform,
        selectedJobId,
        filterModel,
        runnableVisible,
      ),
    };
  }

  static filter = (platform, selectedJobId, filterModel, runnableVisible) => {
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
    return filteredPlatform;
  };

  constructor(props) {
    super(props);

    this.state = {
      filteredPlatform: props.platform,
    };
  }

  filterCb = (platform, selectedJobId) => {
    const { filterModel, runnableVisible } = this.props;

    this.setState({
      filteredPlatform: Platform.filter(
        platform,
        selectedJobId,
        filterModel,
        runnableVisible,
      ),
    });
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
          platform={filteredPlatform}
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
  platform: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  filterModel: PropTypes.object.isRequired,
  pushGroupState: PropTypes.string.isRequired,
  duplicateJobsVisible: PropTypes.bool.isRequired,
  groupCountsExpanded: PropTypes.bool.isRequired,
  runnableVisible: PropTypes.bool.isRequired,
};
