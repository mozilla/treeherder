import {
  getFilterUrlParamsWithDefaults,
  getNonFilterUrlParams,
} from '../../../ui/models/filter';

describe('FilterModel', () => {
  const oldHash = window.location.hash;

  afterEach(() => {
    window.location.hash = oldHash;
  });

  describe('parsing an old url', () => {
    it('should parse the repo with defaults', () => {
      window.location.hash = '?repo=mozilla-inbound';
      const urlParams = getFilterUrlParamsWithDefaults();

      expect(urlParams).toEqual({
        repo: ['mozilla-inbound'],
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
      window.location.hash =
        '?repo=mozilla-inbound&filter-resultStatus=testfailed&' +
        'filter-resultStatus=busted&filter-resultStatus=exception&' +
        'filter-resultStatus=success&filter-resultStatus=retry' +
        '&filter-resultStatus=runnable';
      const urlParams = getFilterUrlParamsWithDefaults();

      expect(urlParams).toEqual({
        repo: ['mozilla-inbound'],
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
      window.location.hash =
        '?repo=mozilla-inbound&filter-searchStr=Linux%20x64%20debug%20build-linux64-base-toolchains%2Fdebug%20(Bb)&filter-tier=1&group_state=expanded';
      const urlParams = {
        ...getNonFilterUrlParams(),
        ...getFilterUrlParamsWithDefaults(),
      };

      expect(urlParams).toEqual({
        repo: ['mozilla-inbound'],
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
      window.location.hash = '?repo=mozilla-inbound&filter-job_type_name=mochi';
      const urlParams = getFilterUrlParamsWithDefaults();

      expect(urlParams).toEqual({
        repo: ['mozilla-inbound'],
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
      window.location.hash =
        '?repo=mozilla-inbound&resultStatus=testfailed,busted,exception,success,retry,runnable&' +
        'searchStr=linux,x64,debug,build-linux64-base-toolchains%2Fdebug,(bb)';
      const urlParams = getFilterUrlParamsWithDefaults();

      expect(urlParams).toEqual({
        repo: ['mozilla-inbound'],
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
      window.location.hash =
        '?repo=mozilla-inbound&author=VYV03354@nifty.ne.jp';
      const urlParams = getFilterUrlParamsWithDefaults();

      expect(urlParams).toEqual({
        repo: ['mozilla-inbound'],
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
