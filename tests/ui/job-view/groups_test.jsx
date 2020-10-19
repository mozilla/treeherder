/* eslint-disable jest/prefer-to-have-length */
import React from 'react';
import cloneDeep from 'lodash/cloneDeep';
import { mount } from 'enzyme/build';

import { JobGroupComponent } from '../../../ui/job-view/pushes/JobGroup';
import FilterModel from '../../../ui/models/filter';
import mappedGroupFixture from '../mock/mappedGroup';
import mappedGroupDupsFixture from '../mock/mappedGroupDups';
import { addAggregateFields } from '../../../ui/helpers/job';

describe('JobGroup component', () => {
  let countGroup;
  let dupGroup;
  const repoName = 'mozilla-inbound';
  const filterModel = new FilterModel();
  const pushGroupState = 'collapsed';

  beforeAll(() => {
    mappedGroupFixture.jobs.forEach((job) => addAggregateFields(job));
    mappedGroupDupsFixture.jobs.forEach((job) => addAggregateFields(job));
  });

  beforeEach(() => {
    countGroup = cloneDeep(mappedGroupFixture);
    dupGroup = cloneDeep(mappedGroupDupsFixture);
  });

  /*
      Tests Jobs view
   */
  it('collapsed should show a job and count of 2', () => {
    const jobGroup = mount(
      <JobGroupComponent
        repoName={repoName}
        group={countGroup}
        filterPlatformCb={() => {}}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
        platform={<span>windows</span>}
        duplicateJobsVisible={false}
        groupCountsExpanded={false}
      />,
    );

    expect(jobGroup.find('.job-group-count').first().text()).toEqual('2');
  });

  test('should show a job and count of 2 when expanded, then re-collapsed', () => {
    const jobGroup = mount(
      <JobGroupComponent
        repoName={repoName}
        group={countGroup}
        filterPlatformCb={() => {}}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
        platform={<span>windows</span>}
        duplicateJobsVisible={false}
        groupCountsExpanded={false}
      />,
    );
    jobGroup.setState({ expanded: true });
    jobGroup.setState({ expanded: false });

    expect(jobGroup.find('.job-group-count').first().text()).toEqual('2');
  });

  test('should show jobs, not counts when expanded', () => {
    const jobGroup = mount(
      <JobGroupComponent
        repoName={repoName}
        group={countGroup}
        filterPlatformCb={() => {}}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
        platform={<span>windows</span>}
        duplicateJobsVisible={false}
        groupCountsExpanded={false}
      />,
    );
    jobGroup.setState({ expanded: true });

    expect(jobGroup.find('.job-group-count').length).toEqual(0);
    expect(jobGroup.find('.job-btn').length).toEqual(3);
  });

  test('should show jobs, not counts when globally expanded', () => {
    const groupCountsExpanded = true;
    const jobGroup = mount(
      <JobGroupComponent
        repoName={repoName}
        group={countGroup}
        filterPlatformCb={() => {}}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
        platform={<span>windows</span>}
        duplicateJobsVisible={false}
        groupCountsExpanded={groupCountsExpanded}
      />,
    );

    expect(jobGroup.find('.job-btn').length).toEqual(3);
    expect(jobGroup.find('.job-group-count').length).toEqual(0);
  });

  test('should hide duplicates by default', () => {
    const jobGroup = mount(
      <JobGroupComponent
        repoName={repoName}
        group={dupGroup}
        filterPlatformCb={() => {}}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
        platform={<span>windows</span>}
        duplicateJobsVisible={false}
        groupCountsExpanded={false}
      />,
    );

    expect(jobGroup.find('.job-group-count').length).toEqual(1);
    expect(jobGroup.find('.job-btn').length).toEqual(1);
  });

  test('should show 2 duplicates when set to show duplicates', () => {
    const duplicateJobsVisible = true;
    const jobGroup = mount(
      <JobGroupComponent
        repoName={repoName}
        group={dupGroup}
        filterPlatformCb={() => {}}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
        platform={<span>windows</span>}
        duplicateJobsVisible={duplicateJobsVisible}
        groupCountsExpanded={false}
      />,
    );

    expect(jobGroup.find('.job-group-count').length).toEqual(1);
    expect(jobGroup.find('.job-btn').length).toEqual(2);
  });

  test('should show 2 duplicates when globally set to show duplicates', () => {
    const duplicateJobsVisible = true;
    const jobGroup = mount(
      <JobGroupComponent
        repoName={repoName}
        group={dupGroup}
        filterPlatformCb={() => {}}
        filterModel={filterModel}
        pushGroupState={pushGroupState}
        platform={<span>windows</span>}
        duplicateJobsVisible={duplicateJobsVisible}
        groupCountsExpanded={false}
      />,
    );

    expect(jobGroup.find('.job-group-count').length).toEqual(1);
    expect(jobGroup.find('.job-btn').length).toEqual(2);
  });
});
