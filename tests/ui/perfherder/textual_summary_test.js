import TextualSummary, {
  formatAlertValue,
  formatValueWithUnit,
  getAlertOptions,
  getAbsoluteChange,
  getChangeArrow,
  valueSeparator,
} from '../../../ui/perfherder/perf-helpers/textualSummary';

const frameworks = [{ id: 13, name: 'browsertime' }];
const pushTimestamp = 1775822400; // Fri April 10 2026
const dayInMs = 24 * 60 * 60 * 1000;

const alertSummary = {
  id: 49649,
  repository: 'autoland',
  framework: 13,
  push_timestamp: pushTimestamp,
  created: '2026-04-10T12:00:00',
};

const getAlert = (id, signatureProps, amountPct = 12) => ({
  id,
  is_regression: true,
  status: 0,
  amount_pct: amountPct,
  prev_value: 7.41,
  new_value: 8.28,
  series_signature: {
    id: id * 10,
    framework_id: 13,
    signature_hash: 'abc',
    suite: 'speedometer3',
    test: 'Charts-observable-plot/Dotted/Async',
    machine_platform: 'linux2404-64-shippable',
    extra_options: ['fission', 'webrender'],
    measurement_unit: 'ms',
    lower_is_better: true,
    ...signatureProps,
  },
});

const getTableLines = (alerts) =>
  new TextualSummary(frameworks, alerts, alertSummary).markdown
    .split('\n')
    .filter((line) => line.startsWith('|'));

describe('formatAlertValue', () => {
  test('keeps at most 5 significant digits', () => {
    expect(formatAlertValue(158.5)).toBe('158.5');
    expect(formatAlertValue(404.09)).toBe('404.09');
    expect(formatAlertValue(7.4123456)).toBe('7.4123');
    expect(formatAlertValue(12.96)).toBe('12.96');
    expect(formatAlertValue(0.0012345678)).toBe('0.0012346');
    expect(formatAlertValue(0)).toBe('0');
  });

  test('uses K, M and G for thousands, millions and billions', () => {
    expect(formatAlertValue(1881.97)).toBe('1.882K');
    expect(formatAlertValue(12345678)).toBe('12.346M');
    expect(formatAlertValue(3456789012)).toBe('3.4568G');
    expect(formatAlertValue(-1500)).toBe('-1.5K');
  });

  test('joins before and after values so they cannot wrap', () => {
    expect(valueSeparator).toBe('\u00a0-\u2060>\u00a0');
    expect(valueSeparator).not.toMatch(/ /);
  });

  test('rounds to fewer digits when asked', () => {
    expect(formatAlertValue(245.49, 3)).toBe('245');
    expect(formatAlertValue(2270.89, 3)).toBe('2.27K');
    expect(formatAlertValue(999.6, 3)).toBe('1K');
    expect(formatValueWithUnit(311.3, 'ms', 3)).toBe('311\u00a0ms');
  });

  test('picks the suffix after rounding', () => {
    expect(formatAlertValue(999.99)).toBe('999.99');
    expect(formatAlertValue(999.999)).toBe('1K');
    expect(formatAlertValue(999999.9)).toBe('1M');
  });
});

describe('formatValueWithUnit', () => {
  test('adds the unit after a non-breaking space', () => {
    expect(formatValueWithUnit(245.49, 'ms')).toBe('245.49 ms');
    expect(formatValueWithUnit(1881.97, 'MiB')).toBe('1.882K MiB');
  });

  test('puts % straight after the number', () => {
    expect(formatValueWithUnit(12.5, '%')).toBe('12.5%');
  });

  test('leaves the value alone when the test has no unit', () => {
    expect(formatValueWithUnit(245.49, null)).toBe('245.49');
    expect(formatValueWithUnit(245.49, '')).toBe('245.49');
    expect(formatValueWithUnit(245.49, undefined)).toBe('245.49');
  });
});

describe('change direction', () => {
  test('shows an arrow for the direction the value moved', () => {
    const change = (isRegression, lowerIsBetter) => ({
      is_regression: isRegression,
      series_signature: { lower_is_better: lowerIsBetter },
      // rounded by the API, so the values alone can't tell the direction
      prev_value: 0.02,
      new_value: 0.02,
    });

    expect(getChangeArrow(change(true, true))).toBe('▲');
    expect(getChangeArrow(change(false, true))).toBe('▼');
    expect(getChangeArrow(change(true, false))).toBe('▼');
    expect(getChangeArrow(change(false, false))).toBe('▲');
  });

  test('falls back to the values when the better direction is unknown', () => {
    const change = (prev, next) => ({
      series_signature: { lower_is_better: null },
      prev_value: prev,
      new_value: next,
    });

    expect(getChangeArrow(change(696.79, 837.24))).toBe('▲');
    expect(getChangeArrow(change(15.6, 15.44))).toBe('▼');
    expect(getChangeArrow(change(5, 5))).toBe('');
  });

  test('gives the difference of the rounded values with its sign and unit', () => {
    const change = (prev, next, unit = 'ms') => ({
      series_signature: { measurement_unit: unit },
      prev_value: prev,
      new_value: next,
    });

    // 245 ms -> 311 ms
    expect(getAbsoluteChange(change(245.49, 311.3))).toBe('+66\u00a0ms');
    // 2.27K ms -> 1.72K ms
    expect(getAbsoluteChange(change(2270.89, 1721.39))).toBe('-550\u00a0ms');
    expect(getAbsoluteChange(change(1000, 3500, 'MiB'))).toBe('+2.5K\u00a0MiB');
    // 15.6 -> 15.4, without floating point noise
    expect(getAbsoluteChange(change(15.6, 15.44, null))).toBe('-0.2');
    // values that round to the same number show no change
    expect(getAbsoluteChange(change(130.02, 130.4))).toBe('0\u00a0ms');
  });

  test('marks a higher-is-better score that went down', () => {
    const [, , row] = getTableLines([
      {
        ...getAlert(
          1,
          { lower_is_better: false, test: 'score', measurement_unit: null },
          1,
        ),
        prev_value: 15.6,
        new_value: 15.44,
      },
    ]);

    expect(row).toMatch(/^\| \[▼1%\]/);
    expect(row).toContain(
      `15.6${valueSeparator}15.4 | -0.2 |`,
    );
  });
});

describe('getAlertOptions', () => {
  test('hides options that are enabled by default on desktop', () => {
    expect(getAlertOptions(getAlert(1))).toEqual([]);
    expect(
      getAlertOptions(getAlert(1, { extra_options: ['fission', 'cold'] })),
    ).toEqual(['cold']);
    expect(
      getAlertOptions(
        getAlert(1, { extra_options: ['stylo', 'webrender-sw', 'e10s'] }),
      ),
    ).toEqual(['webrender-sw']);
  });

  test('keeps fission on android as it is not enabled by default', () => {
    expect(
      getAlertOptions(
        getAlert(1, {
          machine_platform: 'android-hw-a55-14-0-aarch64-shippable',
        }),
      ),
    ).toEqual(['fission']);
  });
});

describe('TextualSummary markdown', () => {
  test('puts the percentage and the test : subtest in their own columns', () => {
    const [header, , row] = getTableLines([getAlert(1)]);

    expect(header).toBe(
      '| **%** | **Test : Subtest** | **Before -> After** | **Change** | **Platform** |',
    );
    expect(row).toMatch(
      /^\| \[▲12%\]\([^)]+\) \| \[speedometer3\]\(https:\/\/firefox-source-docs\.mozilla\.org\/testing\/perfdocs\/raptor\.html#speedometer3-b\) : Charts-observable-plot\/Dotted\/Async \|/,
    );
  });

  test('keeps the graph and docs links in separate cells', () => {
    const [, , row] = getTableLines([getAlert(1)]);
    const [percentCell, testCell] = row.slice(2, -2).split(' | ');

    expect(percentCell).toMatch(/^\[▲12%\]\([^)]+\)$/);
    expect(testCell).toMatch(/^\[speedometer3\]\([^)]+\) : /);
  });

  test('gives the improvement table the same columns as the regression table', () => {
    const lines = new TextualSummary(
      frameworks,
      Array.from({ length: 8 }, (_, i) => ({
        ...getAlert(i + 1, {}, 10 - i),
        is_regression: false,
      })),
      alertSummary,
    ).markdown.split('\n');

    expect(lines).toContain(
      '| **%** | **Test : Subtest** | **Before -> After** | **Change** | **Platform** |',
    );
  });

  test('orders row cells to match the header', () => {
    const [, , row] = getTableLines([getAlert(1)]);
    const cells = row
      .split(' | ')
      .map((cell) => cell.replace(/^\| |\s*\|$/g, '').trim());

    expect(cells[0]).toMatch(/^\[▲12%\]\(https:\/\/treeherder.+\)$/);
    expect(cells[1]).toMatch(/^\[speedometer3\]\(/);
    expect(cells[2]).toBe(`7.41\u00a0ms${valueSeparator}8.28\u00a0ms`);
    expect(cells[3]).toBe('+0.87\u00a0ms');
    expect(cells[4]).toBe('linux2404-64-shippable');
    expect(cells).toHaveLength(5);
  });

  test('does not add a subtest when the alert is on the suite itself', () => {
    const [, , row] = getTableLines([getAlert(1, { test: '' })]);

    expect(row).toMatch(/\) \| \[speedometer3\]\([^)]+\) \| /);
  });

  test('links only the test name to its documentation, not the subtest', () => {
    const [, , documented] = getTableLines([getAlert(1)]);
    const [, , undocumented] = new TextualSummary(
      [{ id: 13, name: 'unknown-framework' }],
      [getAlert(1)],
      alertSummary,
    ).markdown
      .split('\n')
      .filter((line) => line.startsWith('|'));

    expect(documented).not.toContain('(doc)');
    expect(documented).toContain(
      '[speedometer3](https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#speedometer3-b) : Charts-observable-plot/Dotted/Async |',
    );
    expect(undocumented).toContain(
      ') | speedometer3 : Charts-observable-plot/Dotted/Async |',
    );
  });

  test('omits the options column when every option is a default', () => {
    const [header, separator, row] = getTableLines([getAlert(1)]);

    expect(header).not.toContain('Options');
    expect(separator).toBe('|:--|:--|:--|:--|:--|');
    expect(row).not.toContain('fission');
    expect(row.split('|')).toHaveLength(7);
  });

  test('shows the options column when an alert has a non-default option', () => {
    const [header, separator, firstRow, secondRow] = getTableLines([
      getAlert(1, { extra_options: ['fission', 'cold'] }),
      getAlert(2, {}, 10),
    ]);

    expect(header).toBe(
      '| **%** | **Test : Subtest** | **Before -> After** | **Change** | **Platform** | **Options** |',
    );
    expect(separator).toBe('|:--|:--|:--|:--|:--|:--|');
    expect(firstRow).toContain('| linux2404-64-shippable | cold |');
    // "-" because it has no non-default options
    expect(secondRow).toContain(
      `| 7.41\u00a0ms${valueSeparator}8.28\u00a0ms | +0.87\u00a0ms | linux2404-64-shippable | - |`,
    );
  });

  test('orders rows by magnitude and lists every platform', () => {
    const windows = 'windows11-64-24h2-shippable';
    const [, , ...rows] = getTableLines([
      getAlert(1, {}, 5),
      getAlert(2, { machine_platform: windows }, 12),
      getAlert(3, {}, 8),
      getAlert(4, { machine_platform: windows }, 3),
    ]);
    const platformCells = rows.map((row) => row.slice(2, -2).split(' | ')[4]);

    expect(rows.map((row) => row.match(/\[▲(\d+)%\]/)[1])).toEqual([
      '12',
      '8',
      '5',
      '3',
    ]);
    expect(platformCells).toEqual([
      windows,
      'linux2404-64-shippable',
      'linux2404-64-shippable',
      windows,
    ]);
  });

  test('lists every option, with "-" when there are none', () => {
    const windows = 'windows11-64-24h2-shippable';
    const [, , ...rows] = getTableLines([
      getAlert(1, { extra_options: ['cold'] }, 20),
      getAlert(2, { extra_options: ['cold'] }, 18),
      getAlert(3, { extra_options: ['warm'] }, 16),
      getAlert(4, {}, 14),
      getAlert(5, {}, 12),
      getAlert(6, { machine_platform: windows }, 10),
      getAlert(7, { machine_platform: windows }, 8),
    ]);
    const optionCells = rows.map((row) => row.slice(2, -2).split(' | ')[5]);

    expect(optionCells).toEqual(['cold', 'cold', 'warm', '-', '-', '-', '-']);
  });

  test('gives each table a heading', () => {
    const { markdown } = new TextualSummary(
      frameworks,
      [getAlert(1), { ...getAlert(2), is_regression: false }],
      alertSummary,
    );

    expect(markdown).toContain(
      '### Regressions\n\n| **%** | **Test : Subtest** |',
    );
    expect(markdown).toContain(
      '### Improvements\n\n| **%** | **Test : Subtest** |',
    );
  });

  test('notes the alerts left out of long tables below the table', () => {
    const alerts = Array.from({ length: 18 }, (_, i) =>
      getAlert(i + 1, {}, 30 - i),
    );
    const { markdown } = new TextualSummary(frameworks, alerts, alertSummary);
    const [, , ...rows] = getTableLines(alerts);
    const note =
      '_[... and 3 more regressions](https://treeherder.mozilla.org/perfherder/alerts?id=49649)_';

    // the biggest ten and the smallest five
    expect(rows).toHaveLength(15);
    expect(rows[9]).toContain('[▲21%]');
    expect(rows[10]).toContain('[▲17%]');
    expect(rows[10].slice(2, -2).split(' | ')[4]).toBe(
      'linux2404-64-shippable',
    );
    // markdown needs the blank line to end the table
    expect(markdown).toContain(`${rows[14]}\n\n${note}\n`);
  });

  test('has no note when the table shows every alert', () => {
    const alerts = Array.from({ length: 15 }, (_, i) =>
      getAlert(i + 1, {}, 30 - i),
    );

    expect(
      new TextualSummary(frameworks, alerts, alertSummary).markdown,
    ).not.toContain('more regressions');
  });

  test('separates options with commas', () => {
    const [, , row] = getTableLines([
      getAlert(1, { extra_options: ['bytecode-cached', 'cold', 'fission'] }),
    ]);

    expect(row).toContain('| linux2404-64-shippable | bytecode-cached, cold |');
  });

  test('shows "-" for alerts without profiles in the profiles column', () => {
    const profiled = {
      id: 1,
      profile_url: 'https://example.com/after.zip',
      prev_profile_url: 'https://example.com/before.zip',
    };
    const [header, , withProfile, withoutProfile] = new TextualSummary(
      frameworks,
      [getAlert(1, {}, 12), getAlert(2, {}, 8)],
      alertSummary,
      null,
      [profiled, { id: 2 }],
    ).markdown
      .split('\n')
      .filter((line) => line.startsWith('|'));

    expect(header).toContain('**Performance Profiles**');
    expect(withProfile).toMatch(/\| \[Before\]\([^)]+\)\/\[After\]\([^)]+\) \|$/);
    expect(withoutProfile).toMatch(/ \| - \|$/);
  });

  test('zooms the graph link in on the alerting push', () => {
    const [, , row] = getTableLines([getAlert(1)]);
    const pushTime = pushTimestamp * 1000;

    // values 7.41 -> 8.28 are padded by twice the change (1.74) on both sides
    expect(row).toContain(
      `&zoom=${pushTime - 3 * dayInMs},${pushTime + 3 * dayInMs},5.67,10.02)`,
    );
  });

  test('never zooms the graph below zero', () => {
    const [, , row] = getTableLines([
      { ...getAlert(1), prev_value: 1, new_value: 10 },
    ]);

    expect(row).toMatch(/&zoom=\d+,\d+,0,28\)/);
  });
});
