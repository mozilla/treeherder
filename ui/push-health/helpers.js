export const healthData = {
  result: 'fail', // This is a tri-state of pass/fail/indeterminate.  Reflects the worst metric state.
  metrics: [
    {
      name: 'Builds',
      result: 'pass',
      value: 10,
      details: ['Wow, everything passed!'],
    },
    {
      name: 'Linting',
      result: 'pass',
      value: 10,
      details: ['Gosh, this code is really nicely formatted.'],
    },
    {
      name: 'Tests',
      result: 'fail',
      value: 2,
      failures: [
        {
          testName: 'dom/tests/mochitest/fetch/test_fetch_cors_sw_reroute.html',
          jobName: 'test-linux32/opt-mochitest-browser-chrome-e10s-4',
          jobId: 223458405,
          classification: 'intermittent',
          failureLine:
            'REFTEST TEST-UNEXPECTED-FAIL | file:///builds/worker/workspace/build/tests/reftest/tests/layout/reftests/border-dotted/border-dashed-no-radius.html == file:///builds/worker/workspace/build/tests/reftest/tests/layout/reftests/border-dotted/masked.html | image comparison, max difference: 255, number of differing pixels: 54468',
          confidence: 3,
        },
        {
          testName:
            'browser/components/extensions/test/browser/test-oop-extensions/browser_ext_pageAction_context.js',
          jobName: 'test-linux64/debug-mochitest-plain-headless-e10s-8',
          jobId: 223458405,
          classification: 'intermittent',
          failureLine:
            "raptor-main TEST-UNEXPECTED-FAIL: test 'raptor-tp6-bing-firefox' timed out loading test page: https://www.bing.com/search?q=barack+obama",
          confidence: 4,
        },
      ],
    },
    {
      name: 'Coverage',
      result: 'indeterminate',
      value: 5,
      details: [
        'Covered 42% of the tests that are needed for feature ``foo``.',
        'Covered 100% of the tests that are needed for feature ``bar``.',
        'The ratio of people to cake is too many...',
      ],
    },
    {
      name: 'Performance',
      result: 'pass',
      value: 10,
      details: ['Ludicrous Speed'],
    },
  ],
};

export const resultColorMap = {
  pass: 'success',
  fail: 'danger',
  indeterminate: 'warning',
  none: 'default',
};
