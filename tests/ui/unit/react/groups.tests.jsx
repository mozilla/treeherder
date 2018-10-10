import React from 'react';
import { mount } from 'enzyme';

import { JobGroupComponent } from '../../../../ui/job-view/pushes/JobGroup';
import FilterModel from '../../../../ui/models/filter';

const { getJSONFixture } = window;

describe('JobGroup component', () => {
  let countGroup;
  let dupGroup;
  const repoName = 'mozilla-inbound';
  const filterModel = new FilterModel();
  const pushGroupState = 'collapsed';


  beforeEach(() => {
    jasmine.getJSONFixtures().fixturesPath = 'base/tests/ui/mock';
    countGroup = getJSONFixture('mappedGroup.json');
    dupGroup = getJSONFixture('mappedGroupDups.json');
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
    expect(jobGroup.html()).toEqual(
      '<span class="platform-group" data-group-key="313281W-e10s1linux64debug"><span class="disabled job-group" title="Web platform tests with e10s">' +
        '<button class="btn group-symbol">W-e10s</button>' +
        '<span class="group-content">' +
          '<span class="group-job-list"><button data-job-id="166315800" title="success | test-linux64/debug-web-platform-tests-reftests-e10s-1 -  (18 mins)" class="btn btn-green filter-shown job-btn btn-xs">Wr1</button></span>' +
          '<span class="group-count-list"><button class="btn-dkgray-count btn group-btn btn-xs job-group-count filter-shown" title="2 running jobs in group">2</button>' +
       '</span></span></span></span>',
    );
  });

  it('should show a job and count of 2 when expanded, then re-collapsed', () => {
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
    expect(jobGroup.html()).toEqual(
      '<span class="platform-group" data-group-key="313281W-e10s1linux64debug"><span class="disabled job-group" title="Web platform tests with e10s">' +
        '<button class="btn group-symbol">W-e10s</button>' +
        '<span class="group-content">' +
          '<span class="group-job-list"><button data-job-id="166315800" title="success | test-linux64/debug-web-platform-tests-reftests-e10s-1 -  (18 mins)" class="btn btn-green filter-shown job-btn btn-xs">Wr1</button></span>' +
          '<span class="group-count-list"><button class="btn-dkgray-count btn group-btn btn-xs job-group-count filter-shown" title="2 running jobs in group">2</button>' +
       '</span></span></span></span>',
    );
  });

  it('should show jobs, not counts when expanded', () => {
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
    expect(jobGroup.html()).toEqual(
      '<span class="platform-group" data-group-key="313281W-e10s1linux64debug"><span class="disabled job-group" title="Web platform tests with e10s">' +
        '<button class="btn group-symbol">W-e10s</button>' +
          '<span class="group-content">' +
            '<span class="group-job-list">' +
              '<button data-job-id="166315799" title="running | test-linux64/debug-web-platform-tests-wdspec-e10s - " class="btn btn-dkgray filter-shown job-btn btn-xs">Wd</button>' +
              '<button data-job-id="166315800" title="success | test-linux64/debug-web-platform-tests-reftests-e10s-1 -  (18 mins)" class="btn btn-green filter-shown job-btn btn-xs">Wr1</button>' +
              '<button data-job-id="166315797" title="running | test-linux64/debug-web-platform-tests-e10s-1 - " class="btn btn-dkgray filter-shown job-btn btn-xs">wpt1</button>' +
            '</span>' +
            '<span class="group-count-list"></span></span></span></span>',
    );
  });

  it('should show jobs, not counts when globally expanded', () => {
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

    expect(jobGroup.html()).toEqual(
      '<span class="platform-group" data-group-key="313281W-e10s1linux64debug"><span class="disabled job-group" title="Web platform tests with e10s">' +
        '<button class="btn group-symbol">W-e10s</button>' +
          '<span class="group-content">' +
            '<span class="group-job-list">' +
              '<button data-job-id="166315799" title="running | test-linux64/debug-web-platform-tests-wdspec-e10s - " class="btn btn-dkgray filter-shown job-btn btn-xs">Wd</button>' +
              '<button data-job-id="166315800" title="success | test-linux64/debug-web-platform-tests-reftests-e10s-1 -  (18 mins)" class="btn btn-green filter-shown job-btn btn-xs">Wr1</button>' +
              '<button data-job-id="166315797" title="running | test-linux64/debug-web-platform-tests-e10s-1 - " class="btn btn-dkgray filter-shown job-btn btn-xs">wpt1</button>' +
            '</span>' +
            '<span class="group-count-list"></span></span></span></span>',
    );
  });

  it('should hide duplicates by default', () => {
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

    expect(jobGroup.html()).toEqual(
      '<span class="platform-group" data-group-key="313293SM1linux64opt"><span class="disabled job-group" title="Spidermonkey builds">' +
        '<button class="btn group-symbol">SM</button>' +
        '<span class="group-content"><span class="group-job-list">' +
          '<button data-job-id="166316707" title="retry | spidermonkey-sm-msan-linux64/opt -  (0 mins)" class="btn btn-dkblue filter-shown job-btn btn-xs">msan</button>' +
        '</span>' +
        '<span class="group-count-list">' +
          '<button class="btn-green-count btn group-btn btn-xs job-group-count filter-shown" title="6 success jobs in group">6</button>' +
      '</span></span></span></span>',
    );
  });

  it('should show 2 duplicates when set to show duplicates', () => {
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

    expect(jobGroup.html()).toEqual(
      '<span class="platform-group" data-group-key="313293SM1linux64opt"><span class="disabled job-group" title="Spidermonkey builds">' +
        '<button class="btn group-symbol">SM</button>' +
        '<span class="group-content"><span class="group-job-list">' +
          '<button data-job-id="166316707" title="retry | spidermonkey-sm-msan-linux64/opt -  (0 mins)" class="btn btn-dkblue filter-shown job-btn btn-xs">msan</button>' +
          '<button data-job-id="166321182" title="success | spidermonkey-sm-msan-linux64/opt -  (10 mins)" class="btn btn-green filter-shown job-btn btn-xs">msan</button>' +
        '</span>' +
        '<span class="group-count-list">' +
          '<button class="btn-green-count btn group-btn btn-xs job-group-count filter-shown" title="5 success jobs in group">5</button>' +
      '</span></span></span></span>',
    );
  });

  it('should show 2 duplicates when globally set to show duplicates', () => {
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

    expect(jobGroup.html()).toEqual(
      '<span class="platform-group" data-group-key="313293SM1linux64opt"><span class="disabled job-group" title="Spidermonkey builds">' +
        '<button class="btn group-symbol">SM</button>' +
        '<span class="group-content"><span class="group-job-list">' +
          '<button data-job-id="166316707" title="retry | spidermonkey-sm-msan-linux64/opt -  (0 mins)" class="btn btn-dkblue filter-shown job-btn btn-xs">msan</button>' +
          '<button data-job-id="166321182" title="success | spidermonkey-sm-msan-linux64/opt -  (10 mins)" class="btn btn-green filter-shown job-btn btn-xs">msan</button>' +
        '</span>' +
        '<span class="group-count-list">' +
          '<button class="btn-green-count btn group-btn btn-xs job-group-count filter-shown" title="5 success jobs in group">5</button>' +
      '</span></span></span></span>',
    );
  });
});
