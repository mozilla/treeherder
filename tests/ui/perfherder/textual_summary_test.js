import TextualSummary, {
  formatAlertValue,
  formatValueWithUnit,
  getAgentAttachmentName,
  getAgentCommit,
  getAlertOptions,
  getAbsoluteChange,
  getChangeArrow,
  getChangesSummary,
  valueSeparator,
} from '../../../ui/perfherder/perf-helpers/textualSummary';
import RepositoryModel from '../../../ui/models/repository';

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

describe('getChangesSummary', () => {
  const windows = 'windows11-64-24h2-shippable';
  const improvement = (id, pct) => ({
    ...getAlert(id, {}, pct),
    is_regression: false,
  });

  test('counts the regressions, tests and platforms', () => {
    expect(
      getChangesSummary(
        [
          getAlert(1, {}, 26.81),
          getAlert(2, { machine_platform: windows }, 12),
          getAlert(3, {}, 6),
        ],
        [],
      ),
    ).toBe('**3 regressions** on 1 test across 2 platforms');
  });

  test('mentions improvements alongside regressions', () => {
    expect(
      getChangesSummary(
        [getAlert(1, {}, 20.16), getAlert(2, { suite: 'nytimes' }, 0.78)],
        [improvement(3, 5)],
      ),
    ).toBe(
      '**2 regressions and 1 improvement** on 2 tests across 1 platform',
    );
  });

  test('handles a single regression and improvements only', () => {
    expect(getChangesSummary([getAlert(1, {}, 12)], [])).toBe(
      '**1 regression** on 1 test across 1 platform',
    );
    expect(getChangesSummary([], [improvement(1, 10), improvement(2, 2)])).toBe(
      '**2 improvements** on 1 test across 1 platform',
    );
    expect(getChangesSummary([], [])).toBe('performance changes');
    expect(getChangesSummary([], [], 'awsy')).toBe('awsy performance changes');
  });

  test('names the framework before the tests', () => {
    expect(
      getChangesSummary(
        [getAlert(1, {}, 12), getAlert(2, { suite: 'tp6' }, 8)],
        [],
        'awsy',
      ),
    ).toBe('**2 regressions** on 2 awsy tests across 1 platform');
  });

  test('is available on its own, separate from the tables', () => {
    const summary = new TextualSummary(
      frameworks,
      [getAlert(1, {}, 12)],
      alertSummary,
    );

    expect(summary.summaryLine).toBe(
      '**1 regression** on 1 browsertime test across 1 platform',
    );
    expect(summary.markdown).not.toContain('**1 regression**');
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

describe('agent data', () => {
  const summaryWithRevisions = {
    ...alertSummary,
    revision: '7ffa8f5446bf1b4e9318cb30f26576f5ee06a999',
    prev_push_revision: '2d8cbc2c234e41ebcd36241c25f50f6ab61b8852',
  };
  const withTasks = (alert, before, after) => ({
    ...alert,
    prev_taskcluster_metadata: before ? { task_id: before, retry_id: 0 } : {},
    taskcluster_metadata: after ? { task_id: after, retry_id: 0 } : {},
  });

  test('lists the alert, revisions, commits and task IDs for agents', () => {
    const data = new TextualSummary(
      frameworks,
      [
        withTasks(
          getAlert(1, { extra_options: ['cold'] }, 12),
          'prevTaskA',
          'newTaskA',
        ),
        withTasks(getAlert(2, { test: '' }, 8), 'prevTaskB', null),
      ],
      summaryWithRevisions,
    ).getAgentData([
      { revision: '1339e591bd8b4c7e0a9f2d3b5c6e7f8091a2b3c4' },
      { revision: '7ffa8f5446bf1b4e9318cb30f26576f5ee06a999' },
    ]);

    expect(data).toMatchObject({
      alert_summary: 49649,
      alert_summary_url:
        'https://treeherder.mozilla.org/perfherder/alerts?id=49649',
      framework: 'browsertime',
      framework_id: 13,
      repository: 'autoland',
      push_time: '2026-04-10T12:00:00.000Z',
      revisions: {
        before: '2d8cbc2c234e41ebcd36241c25f50f6ab61b8852',
        after: '7ffa8f5446bf1b4e9318cb30f26576f5ee06a999',
      },
      perfcompare_url:
        'https://perf.compare/compare-results?baseRev=2d8cbc2c234e41ebcd36241c25f50f6ab61b8852&baseRepo=autoland&newRev=7ffa8f5446bf1b4e9318cb30f26576f5ee06a999&newRepo=autoland&framework=13&sort=delta|desc',
      commands: {
        try: './mach try perf --alert 49649',
        local: './mach perftest 49649',
      },
      regression_count: 2,
      improvement_count: 0,
    });
    expect(data.alerts[0]).toMatchObject({
      alert_id: 1,
      signature_id: 10,
      test: 'speedometer3',
      subtest: 'Charts-observable-plot/Dotted/Async',
      platform: 'linux2404-64-shippable',
      options: ['cold'],
      unit: 'ms',
      lower_is_better: true,
      is_regression: true,
      before: 7.41,
      after: 8.28,
      change_pct: 12,
      tasks: {
        before: {
          task_id: 'prevTaskA',
          retry_id: 0,
          label: null,
          revision: '2d8cbc2c234e41ebcd36241c25f50f6ab61b8852',
          is_alert_push: true,
        },
        after: {
          task_id: 'newTaskA',
          retry_id: 0,
          label: null,
          revision: '7ffa8f5446bf1b4e9318cb30f26576f5ee06a999',
          is_alert_push: true,
        },
      },
      profile_urls: { before: null, after: null },
      docs_url:
        'https://firefox-source-docs.mozilla.org/testing/perfdocs/raptor.html#speedometer3-b',
    });
    expect(data.commits.map((commit) => commit.revision)).toEqual([
      '7ffa8f5446bf1b4e9318cb30f26576f5ee06a999',
      '1339e591bd8b4c7e0a9f2d3b5c6e7f8091a2b3c4',
    ]);
    expect(data.alerts[0].graph_url).toMatch(
      /^https:\/\/treeherder\.mozilla\.org\/perfherder\/graphs\?/,
    );
    expect(data.alerts[1]).toMatchObject({
      subtest: null,
      tasks: {
        before: expect.objectContaining({ task_id: 'prevTaskB' }),
        after: null,
      },
    });
  });

  test('leaves out the push commits when they are unavailable', () => {
    const data = new TextualSummary(
      frameworks,
      [getAlert(1)],
      summaryWithRevisions,
    ).getAgentData();

    expect(data.commits).toEqual([]);
    expect(data.pushlog_url).toBeNull();
    expect(data.alerts[0].tasks).toEqual({ before: null, after: null });
  });

  test('lists every alert, not only the rows shown in long tables', () => {
    const alerts = Array.from({ length: 18 }, (_, i) =>
      getAlert(i + 1, {}, 30 - i),
    );
    const data = new TextualSummary(
      frameworks,
      alerts,
      summaryWithRevisions,
    ).getAgentData();

    expect(data.alerts).toHaveLength(18);
    expect(data.regression_count).toBe(18);
  });

  test('keeps unknown units and directions as null', () => {
    const data = new TextualSummary(
      frameworks,
      [getAlert(1, { measurement_unit: '', lower_is_better: undefined })],
      summaryWithRevisions,
    ).getAgentData();

    expect(data.alerts[0].unit).toBeNull();
    expect(data.alerts[0].lower_is_better).toBeNull();
  });

  test('points to the attachment in filed bugs', () => {
    const details = new TextualSummary(
      frameworks,
      [getAlert(1)],
      summaryWithRevisions,
    ).getAgentDetails(true);

    expect(details).toBe(
      '**For agents and tools:** the alert data is in the attachment `perf-alert-49649.json`.',
    );
    expect(getAgentAttachmentName(49649)).toBe('perf-alert-49649.json');
  });

  test('points to the API when there is no attachment', () => {
    const details = new TextualSummary(
      frameworks,
      [getAlert(1)],
      summaryWithRevisions,
    ).getAgentDetails();

    expect(details).toBe(
      '**For agents and tools:** the alert data is at https://treeherder.mozilla.org/api/performance/alertsummary/49649/',
    );
  });

  test('links each alert to two weeks of data around the push', () => {
    const data = new TextualSummary(
      frameworks,
      [getAlert(1)],
      summaryWithRevisions,
    ).getAgentData();

    expect(data.alerts[0].data_url).toBe(
      'https://treeherder.mozilla.org/api/performance/summary/?repository=autoland&signature=10&framework=13&startday=2026-03-27T12%3A00%3A00&endday=2026-04-24T12%3A00%3A00&all_data=true&replicates=false',
    );
  });

  test('adds the profiles from the browsertime extra data', () => {
    const data = new TextualSummary(
      frameworks,
      [getAlert(1)],
      summaryWithRevisions,
      null,
      [{ id: 1, prev_profile_url: 'https://before.zip', profile_url: 'https://after.zip' }],
    ).getAgentData();

    expect(data.alerts[0].profile_urls).toEqual({
      before: 'https://before.zip',
      after: 'https://after.zip',
    });
  });

  test('links the push and its commits on hg repositories', () => {
    const repoModel = new RepositoryModel({
      name: 'autoland',
      dvcs_type: 'hg',
      url: 'https://hg.mozilla.org/integration/autoland',
    });
    const data = new TextualSummary(
      frameworks,
      [getAlert(1)],
      summaryWithRevisions,
    ).getAgentData(
      [
        {
          revision: '7ffa8f5446bf1b4e9318cb30f26576f5ee06a999',
          author: 'Dev <dev@mozilla.com>',
          comments:
            'Bug 2069235 - Update PDF.js r=marco\n\nDifferential Revision: https://phabricator.services.mozilla.com/D323500\n',
        },
      ],
      repoModel,
    );

    expect(data.pushlog_url).toBe(
      'https://hg.mozilla.org/integration/autoland/pushloghtml?changeset=7ffa8f5446bf1b4e9318cb30f26576f5ee06a999',
    );
    expect(data.commits).toEqual([
      {
        revision: '7ffa8f5446bf1b4e9318cb30f26576f5ee06a999',
        author: 'Dev <dev@mozilla.com>',
        title: 'Bug 2069235 - Update PDF.js r=marco',
        bug: 2069235,
        phabricator_url: 'https://phabricator.services.mozilla.com/D323500',
        diff_url:
          'https://hg.mozilla.org/integration/autoland/rev/7ffa8f5446bf1b4e9318cb30f26576f5ee06a999',
        raw_diff_url:
          'https://hg.mozilla.org/integration/autoland/raw-rev/7ffa8f5446bf1b4e9318cb30f26576f5ee06a999',
      },
    ]);
  });

  test('links git commits to their diff', () => {
    const repoModel = new RepositoryModel({
      name: 'firefox',
      dvcs_type: 'git',
      url: 'https://github.com/mozilla-firefox/firefox',
    });

    expect(
      getAgentCommit({ revision: 'abc123', comments: 'No bug here' }, repoModel),
    ).toEqual({
      revision: 'abc123',
      author: null,
      title: 'No bug here',
      bug: null,
      phabricator_url: null,
      diff_url: 'https://github.com/mozilla-firefox/firefox/commit/abc123',
      raw_diff_url:
        'https://github.com/mozilla-firefox/firefox/commit/abc123.diff',
    });
  });

  test('uses the looked up tasks and their labels', () => {
    const alertTasks = new Map([
      [
        1,
        {
          before: {
            task_id: 'prevTask',
            retry_id: 0,
            label: 'test-linux/opt-browsertime-sp3',
            revision: '2d8cbc2c234e41ebcd36241c25f50f6ab61b8852',
          },
          // the alerting push didn't run the test, a later push did
          after: {
            task_id: 'laterTask',
            retry_id: 1,
            label: 'test-linux/opt-browsertime-sp3',
            revision: 'later0000000000000000000000000000000000000',
          },
        },
      ],
    ]);
    const data = new TextualSummary(
      frameworks,
      [getAlert(1)],
      summaryWithRevisions,
    ).getAgentData([], null, alertTasks);

    expect(data.alerts[0].tasks).toEqual({
      before: {
        task_id: 'prevTask',
        retry_id: 0,
        label: 'test-linux/opt-browsertime-sp3',
        revision: '2d8cbc2c234e41ebcd36241c25f50f6ab61b8852',
        is_alert_push: true,
      },
      after: {
        task_id: 'laterTask',
        retry_id: 1,
        label: 'test-linux/opt-browsertime-sp3',
        revision: 'later0000000000000000000000000000000000000',
        is_alert_push: false,
      },
    });
  });

  test('is empty when there are no alerts', () => {
    const summary = new TextualSummary(frameworks, [], summaryWithRevisions);
    expect(summary.getAgentDetails(true)).toBe('');
    expect(summary.getAgentData()).toBeNull();
  });
});
