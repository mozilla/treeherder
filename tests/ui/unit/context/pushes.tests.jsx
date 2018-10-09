import angular from 'angular';
import React from 'react';
import * as fetchMock from 'fetch-mock';
import { mount } from 'enzyme';

import { getProjectUrl } from '../../../../ui/helpers/url';
import { Pushes } from '../../../../ui/job-view/context/Pushes';
import FilterModel from '../../../../ui/models/filter';

const { getJSONFixture, inject } = window;

describe('Pushes context', () => {
    let $injector;
    const repoName = 'mozilla-inbound';

  beforeEach(angular.mock.module('treeherder'));
  beforeEach(inject((_$injector_) => {
      $injector = _$injector_;
      jasmine.getJSONFixtures().fixturesPath = 'base/tests/ui/mock';

      fetchMock.get(getProjectUrl('/resultset/?full=true&count=10', repoName),
          getJSONFixture('push_list.json'),
      );

      fetchMock.get(
        getProjectUrl('/jobs/?return_type=list&count=2000&result_set_id=1', repoName),
        getJSONFixture('job_list/job_1.json'),
      );

      fetchMock.get(
        getProjectUrl('/jobs/?return_type=list&count=2000&result_set_id=2', repoName),
        getJSONFixture('job_list/job_2.json'),
      );
    }));

    afterEach(() => {
      fetchMock.reset();
    });

    /*
        Tests Pushes context
     */
    it('should have 2 pushes', async () => {
        const pushes = mount(
          <Pushes
            filterModel={new FilterModel()}
            $injector={$injector}
          ><div /></Pushes>,
        );
        await pushes.instance().fetchPushes(10);
        expect(pushes.state('pushList').length).toBe(2);
    });

    it('should have id of 1 in current repo', async () => {
        const pushes = mount(
          <Pushes
            filterModel={new FilterModel()}
            $injector={$injector}
          ><div /></Pushes>,
        );
        await pushes.instance().fetchPushes(10);
        expect(pushes.state('pushList')[0].id).toBe(1);
    });
});
