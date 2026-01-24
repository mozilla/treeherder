import {
  getBtnClass,
  isReftest,
  isPerfTest,
  canConfirmFailure,
  isClassified,
  isUnclassifiedFailure,
  findInstance,
  getResultState,
  addAggregateFields,
  getTaskRunStr,
  getTaskRun,
} from '../../../ui/helpers/job';
import * as jobButtonRegistry from '../../../ui/hooks/useJobButtonRegistry';
import * as locationHelpers from '../../../ui/helpers/location';

// Mock the job button registry
jest.mock('../../../ui/hooks/useJobButtonRegistry', () => ({
  getJobButtonInstance: jest.fn(),
}));

// Mock location helpers
jest.mock('../../../ui/helpers/location', () => ({
  getRepo: jest.fn(() => 'autoland'),
  getAllUrlParams: jest.fn(() => new URLSearchParams()),
}));

describe('job helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBtnClass', () => {
    it('returns unknown status when resultStatus is null', () => {
      const result = getBtnClass(null, 1);

      expect(result.status).toBe('unknown');
      expect(result.isClassified).toBe(false);
    });

    it('returns the provided resultStatus', () => {
      const result = getBtnClass('success', 1);

      expect(result.status).toBe('success');
    });

    it('returns isClassified false when failureClassificationId is 1', () => {
      const result = getBtnClass('testfailed', 1);

      expect(result.isClassified).toBe(false);
    });

    it('returns isClassified true when failureClassificationId > 1 and not 6 or 8', () => {
      // Classification ID 2 = "Fixed by Commit"
      expect(getBtnClass('testfailed', 2).isClassified).toBe(true);

      // Classification ID 3 = "Expected Failure"
      expect(getBtnClass('testfailed', 3).isClassified).toBe(true);

      // Classification ID 4 = "Intermittent"
      expect(getBtnClass('testfailed', 4).isClassified).toBe(true);

      // Classification ID 5 = "Infra"
      expect(getBtnClass('testfailed', 5).isClassified).toBe(true);

      // Classification ID 7 = "Autoclassified intermittent"
      expect(getBtnClass('testfailed', 7).isClassified).toBe(true);
    });

    it('returns isClassified false when failureClassificationId is 6', () => {
      // Classification ID 6 = "NEW failure"
      const result = getBtnClass('testfailed', 6);

      expect(result.isClassified).toBe(false);
    });

    it('returns isClassified false when failureClassificationId is 8', () => {
      // Classification ID 8 = "Not a failure"
      const result = getBtnClass('testfailed', 8);

      expect(result.isClassified).toBe(false);
    });

    it('handles various result statuses', () => {
      expect(getBtnClass('success', 1).status).toBe('success');
      expect(getBtnClass('testfailed', 1).status).toBe('testfailed');
      expect(getBtnClass('busted', 1).status).toBe('busted');
      expect(getBtnClass('running', 1).status).toBe('running');
      expect(getBtnClass('pending', 1).status).toBe('pending');
    });
  });

  describe('isReftest', () => {
    it('returns true when job_group_name contains reftest', () => {
      const job = {
        job_group_name: 'Reftest',
        job_type_name: 'some-test',
        job_type_symbol: 'R',
      };

      expect(isReftest(job)).toBe(true);
    });

    it('returns true when job_type_name contains reftest', () => {
      const job = {
        job_group_name: 'Some Group',
        job_type_name: 'reftest-stylo',
        job_type_symbol: 'Rs',
      };

      expect(isReftest(job)).toBe(true);
    });

    it('returns true when job_type_symbol contains wrench', () => {
      const job = {
        job_group_name: 'Some Group',
        job_type_name: 'some-test',
        job_type_symbol: 'wrench-test',
      };

      expect(isReftest(job)).toBe(true);
    });

    it('returns true when job_type_name contains test-verify', () => {
      const job = {
        job_group_name: 'Some Group',
        job_type_name: 'test-verify-e10s',
        job_type_symbol: 'TV',
      };

      expect(isReftest(job)).toBe(true);
    });

    it('returns false for non-reftest jobs', () => {
      const job = {
        job_group_name: 'Mochitest',
        job_type_name: 'mochitest-browser',
        job_type_symbol: 'bc',
      };

      expect(isReftest(job)).toBe(false);
    });

    it('is case insensitive for reftest detection', () => {
      const job = {
        job_group_name: 'REFTEST',
        job_type_name: 'some-test',
        job_type_symbol: 'R',
      };

      expect(isReftest(job)).toBe(true);
    });
  });

  describe('isPerfTest', () => {
    it('returns true when job_group_name contains talos', () => {
      const job = {
        job_group_name: 'Talos',
        job_type_name: 'some-test',
      };

      expect(isPerfTest(job)).toBe(true);
    });

    it('returns true when job_type_name contains raptor', () => {
      const job = {
        job_group_name: 'Some Group',
        job_type_name: 'raptor-speedometer',
      };

      expect(isPerfTest(job)).toBe(true);
    });

    it('returns true when job_type_name contains browsertime', () => {
      const job = {
        job_group_name: 'Some Group',
        job_type_name: 'browsertime-benchmark',
      };

      expect(isPerfTest(job)).toBe(true);
    });

    it('returns true when job_type_name contains perftest', () => {
      const job = {
        job_group_name: 'Some Group',
        job_type_name: 'perftest-linux',
      };

      expect(isPerfTest(job)).toBe(true);
    });

    it('returns false for non-perf tests', () => {
      const job = {
        job_group_name: 'Mochitest',
        job_type_name: 'mochitest-browser',
      };

      expect(isPerfTest(job)).toBe(false);
    });

    it('is case insensitive', () => {
      const job = {
        job_group_name: 'TALOS',
        job_type_name: 'some-test',
      };

      expect(isPerfTest(job)).toBe(true);
    });
  });

  describe('canConfirmFailure', () => {
    beforeEach(() => {
      locationHelpers.getRepo.mockReturnValue('autoland');
    });

    it('returns false for non-confirm repos', () => {
      locationHelpers.getRepo.mockReturnValue('mozilla-release');

      const job = {
        job_group_name: 'Mochitest',
        job_type_name: 'mochitest-browser',
      };

      expect(canConfirmFailure(job)).toBe(false);
    });

    it('returns false for jsreftest jobs', () => {
      const job = {
        job_group_name: 'Some Group',
        job_type_name: 'jsreftest-e10s',
      };

      expect(canConfirmFailure(job)).toBe(false);
    });

    it('returns true for mochitest on autoland', () => {
      const job = {
        job_group_name: 'Mochitest',
        job_type_name: 'mochitest-browser-chrome',
      };

      expect(canConfirmFailure(job)).toBe(true);
    });

    it('returns true for crashtest', () => {
      const job = {
        job_group_name: 'Crashtest',
        job_type_name: 'crashtest-e10s',
      };

      expect(canConfirmFailure(job)).toBe(true);
    });

    it('returns true for web-platform tests', () => {
      const job = {
        job_group_name: 'Web Platform Tests',
        job_type_name: 'web-platform-tests',
      };

      expect(canConfirmFailure(job)).toBe(true);
    });

    it('returns true for xpcshell tests', () => {
      const job = {
        job_group_name: 'XPCShell',
        job_type_name: 'xpcshell',
      };

      expect(canConfirmFailure(job)).toBe(true);
    });

    it('returns false for source-test jobs', () => {
      const job = {
        job_group_name: 'Source Test',
        job_type_name: 'source-test-mochitest',
      };

      expect(canConfirmFailure(job)).toBe(false);
    });

    it('works with try repo', () => {
      locationHelpers.getRepo.mockReturnValue('try');

      const job = {
        job_group_name: 'Mochitest',
        job_type_name: 'mochitest-browser',
      };

      expect(canConfirmFailure(job)).toBe(true);
    });

    it('works with mozilla-central repo', () => {
      locationHelpers.getRepo.mockReturnValue('mozilla-central');

      const job = {
        job_group_name: 'Mochitest',
        job_type_name: 'mochitest-browser',
      };

      expect(canConfirmFailure(job)).toBe(true);
    });
  });

  describe('isClassified', () => {
    it('returns false for unclassified jobs (classification id 1)', () => {
      const job = { failure_classification_id: 1 };

      expect(isClassified(job)).toBe(false);
    });

    it('returns true for classified jobs', () => {
      expect(isClassified({ failure_classification_id: 2 })).toBe(true);
      expect(isClassified({ failure_classification_id: 3 })).toBe(true);
      expect(isClassified({ failure_classification_id: 4 })).toBe(true);
      expect(isClassified({ failure_classification_id: 5 })).toBe(true);
    });

    it('returns false for classification ids 6, 7, 8', () => {
      expect(isClassified({ failure_classification_id: 6 })).toBe(false);
      expect(isClassified({ failure_classification_id: 7 })).toBe(false);
      expect(isClassified({ failure_classification_id: 8 })).toBe(false);
    });
  });

  describe('isUnclassifiedFailure', () => {
    it('returns true for failed unclassified jobs', () => {
      const job = {
        result: 'testfailed',
        failure_classification_id: 1,
      };

      expect(isUnclassifiedFailure(job)).toBe(true);
    });

    it('returns false for successful jobs', () => {
      const job = {
        result: 'success',
        failure_classification_id: 1,
      };

      expect(isUnclassifiedFailure(job)).toBe(false);
    });

    it('returns false for classified failures', () => {
      const job = {
        result: 'testfailed',
        failure_classification_id: 4, // Intermittent
      };

      expect(isUnclassifiedFailure(job)).toBe(false);
    });

    it('returns true for busted unclassified jobs', () => {
      const job = {
        result: 'busted',
        failure_classification_id: 1,
      };

      expect(isUnclassifiedFailure(job)).toBe(true);
    });
  });

  describe('findInstance', () => {
    it('returns job button instance from registry', () => {
      const mockEl = {
        getAttribute: jest.fn().mockReturnValue('123'),
      };
      const mockInstance = { setSelected: jest.fn() };

      jobButtonRegistry.getJobButtonInstance.mockReturnValue(mockInstance);

      const result = findInstance(mockEl);

      expect(mockEl.getAttribute).toHaveBeenCalledWith('data-job-id');
      expect(jobButtonRegistry.getJobButtonInstance).toHaveBeenCalledWith(
        '123',
      );
      expect(result).toBe(mockInstance);
    });

    it('returns null when element has no job-id', () => {
      const mockEl = {
        getAttribute: jest.fn().mockReturnValue(null),
      };

      const result = findInstance(mockEl);

      expect(result).toBeNull();
    });

    it('returns undefined when job is not in registry', () => {
      const mockEl = {
        getAttribute: jest.fn().mockReturnValue('999'),
      };

      jobButtonRegistry.getJobButtonInstance.mockReturnValue(undefined);

      const result = findInstance(mockEl);

      expect(result).toBeUndefined();
    });
  });

  describe('getResultState', () => {
    it('returns result when state is completed', () => {
      const job = { state: 'completed', result: 'success' };

      expect(getResultState(job)).toBe('success');
    });

    it('returns state when state is not completed', () => {
      expect(getResultState({ state: 'pending', result: 'unknown' })).toBe(
        'pending',
      );
      expect(getResultState({ state: 'running', result: 'unknown' })).toBe(
        'running',
      );
    });

    it('handles various result values', () => {
      expect(getResultState({ state: 'completed', result: 'testfailed' })).toBe(
        'testfailed',
      );
      expect(getResultState({ state: 'completed', result: 'busted' })).toBe(
        'busted',
      );
      expect(getResultState({ state: 'completed', result: 'exception' })).toBe(
        'exception',
      );
    });
  });

  describe('addAggregateFields', () => {
    it('adds resultStatus based on getResultState', () => {
      const job = {
        state: 'completed',
        result: 'success',
        job_group_name: 'Test',
        job_type_name: 'test-job',
        job_type_symbol: 'T',
        platform: 'linux64',
        platform_option: 'opt',
        submit_timestamp: 1000,
        start_timestamp: 1000,
        end_timestamp: 1060,
      };

      const result = addAggregateFields(job);

      expect(result.resultStatus).toBe('success');
    });

    it('creates searchStr from job properties', () => {
      const job = {
        state: 'completed',
        result: 'success',
        job_group_name: 'Mochitest',
        job_type_name: 'mochitest-browser',
        job_type_symbol: 'bc',
        platform: 'linux64',
        platform_option: 'opt',
        submit_timestamp: 1000,
        start_timestamp: 1000,
        end_timestamp: 1060,
      };

      const result = addAggregateFields(job);

      expect(result.searchStr).toContain('opt');
      expect(result.searchStr).toContain('Mochitest');
      expect(result.searchStr).toContain('mochitest-browser');
      expect(result.searchStr).toContain('bc');
    });

    it('excludes unknown job_group_name from searchStr', () => {
      const job = {
        state: 'completed',
        result: 'success',
        job_group_name: 'unknown',
        job_type_name: 'test-job',
        job_type_symbol: 'T',
        platform: 'linux64',
        platform_option: 'opt',
        submit_timestamp: 1000,
        start_timestamp: 1000,
        end_timestamp: 1060,
      };

      const result = addAggregateFields(job);

      expect(result.searchStr).not.toContain('unknown');
    });

    it('calculates duration from timestamps', () => {
      const job = {
        state: 'completed',
        result: 'success',
        job_group_name: 'Test',
        job_type_name: 'test-job',
        job_type_symbol: 'T',
        platform: 'linux64',
        platform_option: 'opt',
        submit_timestamp: 1000,
        start_timestamp: 1000,
        end_timestamp: 1120, // 2 minutes later
      };

      const result = addAggregateFields(job);

      expect(result.duration).toBe(2);
    });

    it('uses minimum 1 minute duration', () => {
      const job = {
        state: 'completed',
        result: 'success',
        job_group_name: 'Test',
        job_type_name: 'test-job',
        job_type_symbol: 'T',
        platform: 'linux64',
        platform_option: 'opt',
        submit_timestamp: 1000,
        start_timestamp: 1000,
        end_timestamp: 1010, // 10 seconds later
      };

      const result = addAggregateFields(job);

      expect(result.duration).toBe(1);
    });

    it('creates hoverText with job info', () => {
      const job = {
        state: 'completed',
        result: 'success',
        job_group_name: 'Test',
        job_type_name: 'test-job',
        job_type_symbol: 'T',
        platform: 'linux64',
        platform_option: 'opt',
        submit_timestamp: 1000,
        start_timestamp: 1000,
        end_timestamp: 1120,
      };

      const result = addAggregateFields(job);

      expect(result.hoverText).toContain('test-job');
      expect(result.hoverText).toContain('success');
      expect(result.hoverText).toContain('2 mins');
    });

    it('uses singular "min" for 1 minute duration', () => {
      const job = {
        state: 'completed',
        result: 'success',
        job_group_name: 'Test',
        job_type_name: 'test-job',
        job_type_symbol: 'T',
        platform: 'linux64',
        platform_option: 'opt',
        submit_timestamp: 1000,
        start_timestamp: 1000,
        end_timestamp: 1060, // 1 minute
      };

      const result = addAggregateFields(job);

      expect(result.hoverText).toContain('1 min');
      expect(result.hoverText).not.toContain('1 mins');
    });

    it('handles backfilled task symbols ending in -bk', () => {
      const job = {
        state: 'completed',
        result: 'success',
        job_group_name: 'Test',
        job_type_name: 'test-job-1',
        job_type_symbol: 'bc-bk',
        platform: 'linux64',
        platform_option: 'opt',
        submit_timestamp: 1000,
        start_timestamp: 1000,
        end_timestamp: 1060,
      };

      const result = addAggregateFields(job);

      // Should strip -bk suffix from symbol
      expect(result.searchStr).toContain('bc');
      expect(result.searchStr).not.toContain('-bk');
    });

    it('preserves existing duration if already set', () => {
      const job = {
        state: 'completed',
        result: 'success',
        job_group_name: 'Test',
        job_type_name: 'test-job',
        job_type_symbol: 'T',
        platform: 'linux64',
        platform_option: 'opt',
        submit_timestamp: 1000,
        start_timestamp: 1000,
        end_timestamp: 1120,
        duration: 5, // Pre-set duration
      };

      const result = addAggregateFields(job);

      expect(result.duration).toBe(5);
    });
  });

  describe('getTaskRunStr', () => {
    it('returns task_id and retry_id joined by dot', () => {
      const job = {
        task_id: 'ABC123',
        retry_id: 0,
      };

      expect(getTaskRunStr(job)).toBe('ABC123.0');
    });

    it('handles different retry IDs', () => {
      expect(getTaskRunStr({ task_id: 'XYZ', retry_id: 1 })).toBe('XYZ.1');
      expect(getTaskRunStr({ task_id: 'XYZ', retry_id: 5 })).toBe('XYZ.5');
    });
  });

  describe('getTaskRun', () => {
    // Valid taskcluster slugid format: 8 chars + [Q-T] + 1 char + [CGKOSWaeimquy26-] + 10 chars + [AQgw]
    // Example: A1B2C3D4Q5C1234567890A (22 chars total)
    const validTaskId = 'A1B2C3D4Q5C1234567890A';

    it('parses valid task run string with runId', () => {
      const result = getTaskRun(`${validTaskId}.0`);

      expect(result).toEqual({
        taskId: validTaskId,
        runId: '0',
      });
    });

    it('parses task run string without runId', () => {
      const result = getTaskRun(validTaskId);

      expect(result).toEqual({
        taskId: validTaskId,
        runId: undefined,
      });
    });

    it('handles dash separator for backwards compatibility', () => {
      const result = getTaskRun(`${validTaskId}-1`);

      expect(result).toEqual({
        taskId: validTaskId,
        runId: '1',
      });
    });

    it('returns empty object for invalid task run string', () => {
      expect(getTaskRun('invalid')).toEqual({});
      expect(getTaskRun('')).toEqual({});
      expect(getTaskRun('too-short')).toEqual({});
    });

    it('handles multi-digit run IDs', () => {
      const result = getTaskRun(`${validTaskId}.12`);

      expect(result).toEqual({
        taskId: validTaskId,
        runId: '12',
      });
    });
  });
});
