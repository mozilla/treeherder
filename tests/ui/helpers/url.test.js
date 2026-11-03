import {
  getPerfAnalysisUrl,
  isResourceUsageProfile,
} from '../../../ui/helpers/url';

describe('resource usage profiles', () => {
  test.each([
    'profile_build_resources.json',
    'profile_resource-usage.json',
    'profile_run-task-resource-usage.json',
  ])('recognizes %s and includes the job in its profiler URL', (filename) => {
    const url = `https://example.com/public/${filename}`;
    const job = {
      job_type_name: 'test-linux/opt',
      task_id: 'task-id',
      retry_id: 0,
    };

    expect(isResourceUsageProfile(filename)).toBe(true);
    expect(getPerfAnalysisUrl(url, job)).toBe(
      `https://profiler.firefox.com/from-url/${encodeURIComponent(url)}` +
        `?profileName=${encodeURIComponent('test-linux/opt (task-id.0)')}`,
    );
    expect(getPerfAnalysisUrl(url)).toBe(
      `https://profiler.firefox.com/from-url/${encodeURIComponent(url)}`,
    );
  });

  test('does not classify a test performance profile as a resource profile', () => {
    expect(isResourceUsageProfile('profile_something.json')).toBe(false);
  });
});
