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
      details: [
        'Ran some tests that did not go so well',
        'See [foo.bar.baz/mongo/rational/fee]',
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
      details: [],
    },
  ],
};

export const resultColorMap = {
  pass: 'success',
  fail: 'danger',
  indeterminate: 'warning',
  none: 'default',
};
