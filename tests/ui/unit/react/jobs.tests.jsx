import React from 'react';
import { mount } from 'enzyme';
import PushList from '../../../../ui/job-view/PushList';
import Push from '../../../../ui/job-view/Push';
import PushJobs from '../../../../ui/job-view/PushJobs';
import Platform from '../../../../ui/job-view/Platform';
import JobButton from '../../../../ui/job-view/JobButton';

describe('PushList component', () => {
  let $injector, $httpBackend, pushListEl, pushList;
  const repoName = 'mozilla-central';

  beforeEach(angular.mock.module('treeherder'));
  beforeEach(inject((_$injector_) => {
    const projectPrefix = '/api/project/' + repoName + '/';
    $injector = _$injector_;

    // TODO: Once we switch away from angular for fetching data, we may want to
    // switch to using something like this for mocking test data: http://www.wheresrhys.co.uk/fetch-mock/

    $httpBackend = $injector.get('$httpBackend');
    const ThResultSetStore = $injector.get('ThResultSetStore');

    jasmine.getJSONFixtures().fixturesPath = 'base/tests/ui/mock';

    $httpBackend.whenGET('/api/repository/').respond(
      getJSONFixture('repositories.json')
    );

    $httpBackend.whenGET(projectPrefix + 'resultset/?count=10&full=true').respond(
      getJSONFixture('push_list.json')
    );

    $httpBackend.whenGET(projectPrefix + 'resultset/?count=11&full=true&push_timestamp__lte=1424272126').respond(
      getJSONFixture('push_list.json')
    );

    $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=1&return_type=list').respond(
      getJSONFixture('job_list/job_1.json')
    );

    $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=2&return_type=list').respond(
      getJSONFixture('job_list/job_2.json')
    );

    $httpBackend.whenGET('https://treestatus.mozilla-releng.net/trees/mozilla-central').respond(
      {
        result: {
          status: "closed",
          message_of_the_day: "This is a message nstuff...",
          tree: "mozilla-central",
          reason: "Bustage"
        }
      }
    );

    ThResultSetStore.initRepository(repoName);
    ThResultSetStore.fetchResultSets(10);
    $httpBackend.flush();
    pushList = ThResultSetStore.getResultSetsArray();
  }));

  /*
      Tests Jobs view
   */
  it('should have 2 Pushes', () => {
    pushListEl = mount(
      <PushList
        $injector={$injector}
        repoName={repoName}
        user={{}}
        currentRepo={{ name: "mozilla-inbound", url: "http://foo.baz" }}
      />
    );
    $httpBackend.flush();
    pushListEl.setState({ pushList });
    expect(pushListEl.find(Push).length).toEqual(2);
  });
});

describe('PushJobs component', () => {
  let $injector, pushJobsEl, pushList, ThResultSetStore;
  const repoName = 'mozilla-central';
  const projectPrefix = '/api/project/' + repoName + '/';

  beforeEach(angular.mock.module('treeherder'));
  beforeEach(inject((_$injector_) => {
    $injector = _$injector_;
    jasmine.getJSONFixtures().fixturesPath = 'base/tests/ui/mock';
    const $httpBackend = $injector.get('$httpBackend');
    ThResultSetStore = $injector.get('ThResultSetStore');

    jasmine.getJSONFixtures().fixturesPath = 'base/tests/ui/mock';

    $httpBackend.whenGET('/api/repository/').respond(
      getJSONFixture('repositories.json')
    );
    $httpBackend.whenGET(projectPrefix + 'resultset/?count=10&full=true').respond(
      getJSONFixture('push_list.json')
    );
    $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=1&return_type=list').respond(
      getJSONFixture('job_list/job_1.json')
    );
    $httpBackend.whenGET(projectPrefix + 'jobs/?count=2000&result_set_id=2&return_type=list').respond(
      getJSONFixture('job_list/job_2.json')
    );
    $httpBackend.whenGET('https://treestatus.mozilla-releng.net/trees/mozilla-central').respond(
      {
        result: {
          status: "closed",
          message_of_the_day: "This is a message nstuff...",
          tree: "mozilla-central",
          reason: "Bustage"
        }
      }
    );

    ThResultSetStore.initRepository(repoName);
    ThResultSetStore.fetchResultSets(10);

    $httpBackend.flush();
    pushList = ThResultSetStore.getResultSetsArray();
    pushJobsEl = mount(
      <PushJobs
        $injector={$injector}
        push={pushList[1]}
        repoName={repoName}
      />
    );

  }));

  it('should have platforms', () => {
    expect(pushJobsEl.find(Platform).length).toEqual(2);
  });

  it('should set the selected job when calling selectJob()', () => {
    const jobEl = pushJobsEl.find(JobButton).first();
    const jobInst = jobEl.instance();
    jobInst.ThResultSetStore = ThResultSetStore;
    jobEl.simulate('mouseDown');
    expect(jobInst.state.isSelected).toEqual(true);
  });

});
