import { createBrowserHistory } from 'history';

import {
  getFilterUrlParamsWithDefaults,
  getNonFilterUrlParams,
} from '../../../ui/models/filter';

const history = createBrowserHistory();

describe('FilterModel', () => {
  const prevParams = history.location.search;

  afterEach(() => {
    history.location.search = prevParams;
  });

  describe('parsing an old url', () => {
    it('should parse the repo with defaults', () => {
      history.location.search = '?repo=autoland';
      const urlParams = getFilterUrlParamsWithDefaults(history.location);

      expect(urlParams).toEqual({
        repo: ['autoland'],
        resultStatus: [
          'testfailed',
          'busted',
          'exception',
          'success',
          'retry',
          'usercancel',
          'running',
          'pending',
          'runnable',
        ],
        classifiedState: ['classified', 'unclassified'],
        tier: ['1', '2'],
      });
    });

    it('should parse resultStatus params', () => {
      history.location.search =
        '?repo=autoland&filter-resultStatus=testfailed&' +
        'filter-resultStatus=busted&filter-resultStatus=exception&' +
        'filter-resultStatus=success&filter-resultStatus=retry' +
        '&filter-resultStatus=runnable';
      const urlParams = getFilterUrlParamsWithDefaults(history.location);

      expect(urlParams).toEqual({
        repo: ['autoland'],
        resultStatus: [
          'testfailed',
          'busted',
          'exception',
          'success',
          'retry',
          'runnable',
        ],
        classifiedState: ['classified', 'unclassified'],
        tier: ['1', '2'],
      });
    });

    it('should parse searchStr params with tier and groupState intact', () => {
      history.location.search =
        '?repo=autoland&filter-searchStr=Linux%20x64%20debug%20build-linux64-base-toolchains%2Fdebug%20(Bb)&filter-tier=1&group_state=expanded';
      const urlParams = {
        ...getNonFilterUrlParams(history.location),
        ...getFilterUrlParamsWithDefaults(history.location),
      };

      expect(urlParams).toEqual({
        repo: ['autoland'],
        resultStatus: [
          'testfailed',
          'busted',
          'exception',
          'success',
          'retry',
          'usercancel',
          'running',
          'pending',
          'runnable',
        ],
        classifiedState: ['classified', 'unclassified'],
        tier: ['1'],
        searchStr: [
          'linux',
          'x64',
          'debug',
          'build-linux64-base-toolchains/debug',
          '(bb)',
        ],
        group_state: 'expanded',
      });
    });

    it('should parse job field filters', () => {
      history.location.search = '?repo=autoland&filter-job_type_name=mochi';
      const urlParams = getFilterUrlParamsWithDefaults(history.location);

      expect(urlParams).toEqual({
        repo: ['autoland'],
        resultStatus: [
          'testfailed',
          'busted',
          'exception',
          'success',
          'retry',
          'usercancel',
          'running',
          'pending',
          'runnable',
        ],
        classifiedState: ['classified', 'unclassified'],
        tier: ['1', '2'],
        job_type_name: ['mochi'],
      });
    });
  });

  describe('parsing a new url', () => {
    it('should parse resultStatus and searchStr', () => {
      history.location.search =
        '?repo=autoland&resultStatus=testfailed,busted,exception,success,retry,runnable&' +
        'searchStr=linux,x64,debug,build-linux64-base-toolchains%2Fdebug,(bb)';
      const urlParams = getFilterUrlParamsWithDefaults(history.location);

      expect(urlParams).toEqual({
        repo: ['autoland'],
        resultStatus: [
          'testfailed',
          'busted',
          'exception',
          'success',
          'retry',
          'runnable',
        ],
        classifiedState: ['classified', 'unclassified'],
        tier: ['1', '2'],
        searchStr: [
          'linux',
          'x64',
          'debug',
          'build-linux64-base-toolchains/debug',
          '(bb)',
        ],
      });
    });

    it('should preserve the case in email addresses', () => {
      history.location.search = '?repo=autoland&author=VYV03354@nifty.ne.jp';
      const urlParams = getFilterUrlParamsWithDefaults(history.location);

      expect(urlParams).toEqual({
        repo: ['autoland'],
        resultStatus: [
          'testfailed',
          'busted',
          'exception',
          'success',
          'retry',
          'usercancel',
          'running',
          'pending',
          'runnable',
        ],
        classifiedState: ['classified', 'unclassified'],
        tier: ['1', '2'],
        author: ['VYV03354@nifty.ne.jp'],
      });
    });
  });
});
