import {
  buildStage,
  estimatePush,
  expectedRunTime,
  familyKey,
  parseJobRows,
} from '../../../ui/push-view/eta';

const MIN = 60;
const NOW = 1_800_000_000; // seconds
const nowMs = NOW * 1000;

const table = {
  exact: { 'test-linux/opt-mochitest-1': 10 },
  family: { 'test-linux/opt-xpcshell': 20 },
  platform: { 'linux|opt': 15 },
  global: 20.8,
};

const job = (over) => ({
  id: Math.random(),
  state: 'completed',
  tier: 1,
  platform: 'linux',
  platformOption: 'opt',
  jobTypeName: 'test-linux/opt-mochitest-1',
  submit: null,
  start: null,
  end: null,
  ...over,
});

describe('parseJobRows', () => {
  test('maps positional rows by column name and drops 0 timestamps', () => {
    const data = {
      job_property_names: [
        'submit_timestamp',
        'id',
        'job_type_name',
        'state',
        'platform',
        'platform_option',
        'start_timestamp',
        'end_timestamp',
        'tier',
      ],
      results: [
        [100, 1, 'build-linux/opt', 'running', 'linux', 'opt', 160, 0, 1],
        [100, 2, 'test-x', 'mystery', 'linux', '', 0, 0, 2],
        [100, 'bad', 'test-y', 'pending', 'linux', 'opt', 0, 0, 1],
      ],
    };
    expect(parseJobRows(data)).toEqual([
      {
        id: 1,
        state: 'running',
        tier: 1,
        platform: 'linux',
        platformOption: 'opt',
        jobTypeName: 'build-linux/opt',
        submit: 100,
        start: 160,
        end: null,
      },
      // An unknown state is pending, never completed.
      expect.objectContaining({ id: 2, state: 'pending', start: null, tier: 2 }),
    ]);
  });

  test('returns nothing for a malformed response', () => {
    expect(parseJobRows({})).toEqual([]);
  });
});

describe('run time lookup', () => {
  test('falls back exact → family → platform → global', () => {
    expect(expectedRunTime(job({}), table)).toBe(10 * MIN);
    expect(
      expectedRunTime(job({ jobTypeName: 'test-linux/opt-xpcshell-3' }), table),
    ).toBe(20 * MIN);
    expect(expectedRunTime(job({ jobTypeName: 'unknown' }), table)).toBe(
      15 * MIN,
    );
    expect(
      expectedRunTime(job({ jobTypeName: 'unknown', platform: 'mac' }), table),
    ).toBeCloseTo(20.8 * MIN);
    expect(familyKey('a-wdspec-headless-12')).toBe('a-wdspec-headless');
  });

  test('stages the shippable build chain', () => {
    expect(buildStage(job({ jobTypeName: 'toolchain-clang' }))).toBe(0);
    expect(buildStage(job({ jobTypeName: 'instrumented-build-mac' }))).toBe(1);
    expect(buildStage(job({ jobTypeName: 'generate-profile-mac' }))).toBe(2);
    expect(buildStage(job({ jobTypeName: 'build-macosx64/opt' }))).toBe(3);
    expect(buildStage(job({ jobTypeName: 'test-x' }))).toBeNull();
  });
});

describe('estimatePush', () => {
  const pushedAt = (NOW - 60 * MIN) * 1000;

  test('says nothing for a finished or empty push', () => {
    expect(estimatePush([], table, { now: nowMs, pushedAt })).toBeNull();
    expect(
      estimatePush([job({ end: NOW - MIN })], table, { now: nowMs, pushedAt }),
    ).toBeNull();
  });

  test('headline is when 90% of jobs are in, with a longer tail', () => {
    // 18 done, one queued job in an observed pool, one straggler.
    const done = Array.from({ length: 18 }, (_, i) =>
      job({ submit: NOW - 50 * MIN, start: NOW - 45 * MIN, end: NOW - i * MIN }),
    );
    const queued = job({ state: 'pending', submit: NOW - 2 * MIN });
    const straggler = job({
      state: 'pending',
      submit: NOW - 2 * MIN,
      jobTypeName: 'test-linux/opt-xpcshell-1',
    });
    const eta = estimatePush([...done, queued, straggler], table, {
      now: nowMs,
      pushedAt,
    });

    expect(eta.confidence).toBe('firm');
    // Pool wait 5 min; queued: submit(-2) + 5 + 10 run = +13 min.
    // 20 projections, p90 index 18 → the queued job.
    expect(eta.mostAt).toBe((NOW + 13 * MIN) * 1000);
    // Straggler: -2 + 5 + 20 = +23 min, stretched by 1.25 → +28.75.
    expect(eta.allAt).toBe((NOW + 28.75 * MIN) * 1000);
    expect(eta.mostFraction).toBeGreaterThan(0);
    expect(eta.mostFraction).toBeLessThan(1);
  });

  test('stays honest too early: no times while estimating', () => {
    const eta = estimatePush(
      [job({ state: 'pending', submit: NOW - MIN, platform: 'mac' })],
      table,
      { now: nowMs, pushedAt: (NOW - 3 * MIN) * 1000 },
    );
    expect(eta.confidence).toBe('estimating');
    expect(eta.mostAt).toBeNull();
    expect(eta.allAt).toBeNull();
  });

  test('names the running build that unscheduled tests wait on', () => {
    const chain = [
      job({
        state: 'running',
        jobTypeName: 'generate-profile-macosx64-shippable/opt',
        platform: 'macosx64-shippable',
        submit: NOW - 30 * MIN,
        start: NOW - 20 * MIN,
      }),
      job({
        state: 'unscheduled',
        jobTypeName: 'build-macosx64-shippable/opt',
        platform: 'macosx64-shippable',
        submit: NOW - 30 * MIN,
      }),
      ...Array.from({ length: 5 }, () =>
        job({
          state: 'unscheduled',
          jobTypeName: 'test-macosx1500/opt-talos',
          platform: 'macosx1500-aarch64',
          submit: NOW - 30 * MIN,
        }),
      ),
    ];
    const eta = estimatePush(chain, table, { now: nowMs, pushedAt });

    expect(eta.confidence).toBe('blockedOnBuild');
    expect(eta.blockingBuild.name).toBe(
      'generate-profile-macosx64-shippable/opt',
    );
    // generate-profile: started -20 + 20.8 run; build: that + wait 10 + 20.8.
    expect(eta.blockingBuild.finishAt).toBeCloseTo(
      (NOW + (0.8 + 10 + 20.8) * MIN) * 1000,
    );
    // The unscheduled build shares a pool with the running stage, whose wait
    // is observed, so only the five tests count as blocked.
    expect(eta.blockingBuild.blockedJobs).toBe(5);
    expect(eta.mostAt).toBeNull();
  });
});
