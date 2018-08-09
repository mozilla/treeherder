import * as fetchMock from 'fetch-mock';

import { getProjectUrl } from '../../../../ui/helpers/url';

describe('ThResultSetStore', function () {

    let $httpBackend;
    let rootScope;
    let model;
    let repoModel;
    const foregroundRepo = 'mozilla-inbound';

    beforeEach(angular.mock.module('treeherder'));

    beforeEach(inject(function ($injector, $rootScope, $controller,
                                ThResultSetStore, ThRepositoryModel) {

        $httpBackend = $injector.get('$httpBackend');
        jasmine.getJSONFixtures().fixturesPath = 'base/tests/ui/mock';

        fetchMock.get(
          'https://treestatus.mozilla-releng.net/trees/mozilla-inbound',
          {
              result: {
                  status: 'approval required',
                  message_of_the_day: 'I before E',
                  tree: 'mozilla-inbound',
                  reason: '',
              },
          },
        );

        $httpBackend.whenGET(getProjectUrl('/resultset/?count=10&full=true', foregroundRepo)).respond(
            getJSONFixture('push_list.json'),
        );

        fetchMock.get(
          getProjectUrl('/jobs/?return_type=list&result_set_id=1&count=2000', foregroundRepo),
          getJSONFixture('job_list/job_1.json'),
        );

        fetchMock.get(
          getProjectUrl('/jobs/?return_type=list&result_set_id=2&count=2000', foregroundRepo),
          getJSONFixture('job_list/job_2.json'),
        );

        $httpBackend.whenGET('/api/repository/').respond(
          getJSONFixture('repositories.json'),
        );

        rootScope = $rootScope.$new();
        rootScope.repoName = foregroundRepo;

        repoModel = ThRepositoryModel;
        repoModel.load(rootScope.repoName);

        model = ThResultSetStore;
        model.initRepository(rootScope.repoName);
        model.fetchPushes(10);

        $httpBackend.flush();
    }));

    afterEach(() => {
      fetchMock.restore();
    });

    /*
        Tests ThResultSetStore
     */
    it('should have 2 resultset', () => {
        expect(model.getPushArray().length).toBe(2);
    });

    it('should have id of 1 in foreground (current) repo', () => {
        expect(model.getPushArray()[0].id).toBe(1);
    });
});
