#!/usr/bin/env node
/* eslint-disable no-console */
//
// audit-testsummary-fields.mjs
//
// Fetch every `*_testsummary.jsonl` artifact for a given revision (push) and
// report which mozlog actions and fields appear in those artifacts but are
// NEVER consumed by the job-view Summary tab (`ui/helpers/testSummary.js` →
// `buildTestSummary`). Anything flagged here is dead weight in the artifact and
// is a candidate for removal from whatever emits `_testsummary.jsonl`.
//
// Usage:
//   node scripts/audit-testsummary-fields.mjs --revision <rev> [options]
//
// Options:
//   --revision <rev>     Push revision (40-char hash). REQUIRED.
//   --repo <name>        Treeherder project. Default: autoland
//   --root <url>         Treeherder root. Default: https://treeherder.mozilla.org
//   --max-jobs <n>       Only inspect the first N jobs of the push (debug/speed).
//   --concurrency <n>    Parallel artifact requests. Default: 12
//   --json <path>        Also write the full machine-readable report here.
//
// Example:
//   node scripts/audit-testsummary-fields.mjs --repo autoland \
//        --revision 0123456789abcdef0123456789abcdef01234567
//
// No dependencies — relies on Node >=22 global fetch.

// ---------------------------------------------------------------------------
// 1. What the Summary tab actually reads.
//
// This is the source-of-truth mirror of `buildTestSummary` /
// `buildFailureSuggestions` in ui/helpers/testSummary.js. If that parser
// changes, update this map. `action` is read for EVERY line (the switch key),
// so it is implicitly used everywhere.
// ---------------------------------------------------------------------------
const USED = {
  group_start: ['action', 'name'],
  group_end: ['action'],
  test_start: ['action', 'test', 'group', 'time'],
  // `expected` is only tested for presence, `subtest`/`message` enrich the
  // parent failure message.
  test_status: ['action', 'test', 'expected', 'subtest', 'message'],
  test_end: ['action', 'test', 'group', 'status', 'time', 'expected', 'message'],
  crash: ['action', 'test', 'group', 'signature'],
};
const USED_ACTIONS = new Set(Object.keys(USED));
// `action` is consumed for any line regardless of its value.
const GLOBALLY_USED_FIELDS = new Set(['action']);

// ---------------------------------------------------------------------------
// 2. Argument parsing.
// ---------------------------------------------------------------------------
const parseArgs = (argv) => {
  const opts = {
    repo: 'autoland',
    root: 'https://treeherder.mozilla.org',
    concurrency: 12,
    maxJobs: Infinity,
    json: null,
    revision: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[(i += 1)];
    switch (arg) {
      case '--revision':
        opts.revision = next();
        break;
      case '--repo':
        opts.repo = next();
        break;
      case '--root':
        opts.root = next().replace(/\/$/, '');
        break;
      case '--max-jobs':
        opts.maxJobs = Number(next());
        break;
      case '--concurrency':
        opts.concurrency = Number(next());
        break;
      case '--json':
        opts.json = next();
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}`);
        opts.help = true;
    }
  }
  return opts;
};

// ---------------------------------------------------------------------------
// 3. Small helpers.
// ---------------------------------------------------------------------------
const getJSON = async (url) => {
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`GET ${url} -> ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
};

// Run `worker` over `items` with a bounded number of concurrent calls.
const mapPool = async (items, concurrency, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    },
  );
  await Promise.all(runners);
  return results;
};

// ---------------------------------------------------------------------------
// 4. Treeherder + Taskcluster fetching.
// ---------------------------------------------------------------------------
const getTcRootUrl = async (root, repo) => {
  const repos = await getJSON(`${root}/api/repository/`);
  const match = repos.find((r) => r.name === repo);
  if (!match) throw new Error(`Repository "${repo}" not found`);
  return match.tc_root_url;
};

const getPushId = async (root, repo, revision) => {
  const data = await getJSON(
    `${root}/api/project/${repo}/push/?revision=${revision}`,
  );
  if (!data.results || !data.results.length) {
    throw new Error(`No push found for revision ${revision} in ${repo}`);
  }
  return data.results[0].id;
};

// The jobs endpoint returns a columnar form: `results` is an array of arrays,
// decoded against `job_property_names`. Normalise to plain objects.
const getJobs = async (root, repo, pushId) => {
  const jobs = [];
  let offset = 0;
  const count = 2000;
  for (;;) {
    const data = await getJSON(
      `${root}/api/project/${repo}/jobs/?push_id=${pushId}&count=${count}&offset=${offset}`,
    );
    const names = data.job_property_names;
    const page = (data.results || []).map((row) =>
      Array.isArray(row)
        ? Object.fromEntries(names.map((n, idx) => [n, row[idx]]))
        : row,
    );
    jobs.push(...page);
    if (page.length < count) break;
    offset += count;
  }
  return jobs;
};

const listArtifacts = async (rootUrl, taskId, run) => {
  const url = `${rootUrl}/api/queue/v1/task/${taskId}/runs/${run}/artifacts`;
  try {
    const data = await getJSON(url);
    return data.artifacts || [];
  } catch {
    // Expired tasks / missing runs are expected; skip silently.
    return [];
  }
};

const fetchText = async (url) => {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`GET ${url} -> ${resp.status}`);
  return resp.text();
};

// ---------------------------------------------------------------------------
// 5. Inventory accumulation.
// ---------------------------------------------------------------------------
const makeInventory = () => ({
  totalLines: 0,
  totalArtifacts: 0,
  // action -> { lines, fields: Map(field -> count) }
  actions: new Map(),
});

const recordLine = (inventory, obj) => {
  inventory.totalLines += 1;
  const action = obj.action ?? '(no action field)';
  if (!inventory.actions.has(action)) {
    inventory.actions.set(action, { lines: 0, fields: new Map() });
  }
  const bucket = inventory.actions.get(action);
  bucket.lines += 1;
  for (const field of Object.keys(obj)) {
    bucket.fields.set(field, (bucket.fields.get(field) || 0) + 1);
  }
};

const ingestArtifact = (inventory, text) => {
  inventory.totalArtifacts += 1;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj && typeof obj === 'object') recordLine(inventory, obj);
  }
};

// ---------------------------------------------------------------------------
// 6. Report.
// ---------------------------------------------------------------------------
const buildReport = (inventory) => {
  const unusedActions = [];
  const unusedFields = [];
  const usedSummary = [];

  for (const [action, bucket] of [...inventory.actions.entries()].sort()) {
    const fieldEntries = [...bucket.fields.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    if (!USED_ACTIONS.has(action)) {
      unusedActions.push({
        action,
        lines: bucket.lines,
        fields: fieldEntries.map(([f]) => f),
      });
      continue;
    }
    const usedFields = new Set([...USED[action], ...GLOBALLY_USED_FIELDS]);
    const deadHere = fieldEntries.filter(([field]) => !usedFields.has(field));
    const liveHere = fieldEntries.filter(([field]) => usedFields.has(field));
    usedSummary.push({
      action,
      lines: bucket.lines,
      usedFields: liveHere.map(([f]) => f),
    });
    for (const [field, count] of deadHere) {
      unusedFields.push({ action, field, count, lines: bucket.lines });
    }
  }
  return { unusedActions, unusedFields, usedSummary };
};

const printReport = (inventory, report, ctx) => {
  const { unusedActions, unusedFields, usedSummary } = report;
  console.log('');
  console.log('='.repeat(72));
  console.log(`Testsummary field audit — ${ctx.repo} @ ${ctx.revision}`);
  console.log('='.repeat(72));
  console.log(
    `Artifacts inspected : ${inventory.totalArtifacts} (` +
      `${ctx.jobsWithArtifact} of ${ctx.totalJobs} jobs had a _testsummary.jsonl)`,
  );
  console.log(`Total JSONL lines   : ${inventory.totalLines}`);
  console.log(`Distinct actions    : ${inventory.actions.size}`);

  console.log('\n--- Actions CONSUMED by SummaryTab (kept) ---');
  for (const a of usedSummary) {
    console.log(
      `  ${a.action.padEnd(14)} ${String(a.lines).padStart(8)} lines | uses: ${a.usedFields.join(', ')}`,
    );
  }

  console.log('\n--- Actions NOT consumed by SummaryTab (removable) ---');
  if (!unusedActions.length) {
    console.log('  (none — every action present is used)');
  } else {
    for (const a of unusedActions) {
      console.log(
        `  ${a.action.padEnd(20)} ${String(a.lines).padStart(8)} lines | fields: ${a.fields.join(', ')}`,
      );
    }
  }

  console.log(
    '\n--- Fields present on USED actions but never read (removable) ---',
  );
  if (!unusedFields.length) {
    console.log('  (none — every field on every used action is consumed)');
  } else {
    const byAction = new Map();
    for (const f of unusedFields) {
      if (!byAction.has(f.action)) byAction.set(f.action, []);
      byAction.get(f.action).push(f);
    }
    for (const [action, fields] of byAction) {
      console.log(`  ${action}:`);
      for (const f of fields) {
        const pct = ((f.count / f.lines) * 100).toFixed(0);
        console.log(
          `      ${f.field.padEnd(22)} present on ${String(f.count).padStart(8)}/${f.lines} lines (${pct}%)`,
        );
      }
    }
  }
  console.log('');
};

// ---------------------------------------------------------------------------
// 7. Main.
// ---------------------------------------------------------------------------
const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.revision) {
    console.log(
      'Usage: node scripts/audit-testsummary-fields.mjs --revision <rev> [--repo autoland] [--root url] [--max-jobs n] [--concurrency n] [--json path]',
    );
    process.exit(opts.revision ? 0 : 1);
  }

  console.error(`Resolving ${opts.repo} root URL…`);
  const tcRootUrl = await getTcRootUrl(opts.root, opts.repo);

  console.error(`Finding push for revision ${opts.revision}…`);
  const pushId = await getPushId(opts.root, opts.repo, opts.revision);

  console.error(`Listing jobs for push ${pushId}…`);
  let jobs = await getJobs(opts.root, opts.repo, pushId);
  const totalJobs = jobs.length;
  if (Number.isFinite(opts.maxJobs)) jobs = jobs.slice(0, opts.maxJobs);
  console.error(`  ${totalJobs} jobs (inspecting ${jobs.length}).`);

  console.error('Scanning Taskcluster artifacts for _testsummary.jsonl…');
  const inventory = makeInventory();
  let jobsWithArtifact = 0;
  let scanned = 0;

  await mapPool(jobs, opts.concurrency, async (job) => {
    const taskId = job.task_id;
    const run = job.retry_id ?? 0;
    scanned += 1;
    if (scanned % 100 === 0) {
      console.error(`  …${scanned}/${jobs.length} jobs scanned`);
    }
    if (!taskId) return;
    const artifacts = await listArtifacts(tcRootUrl, taskId, run);
    const summaries = artifacts.filter((a) =>
      a.name.endsWith('_testsummary.jsonl'),
    );
    if (!summaries.length) return;
    jobsWithArtifact += 1;
    for (const artifact of summaries) {
      const url = `${tcRootUrl}/api/queue/v1/task/${taskId}/runs/${run}/artifacts/${artifact.name}`;
      try {
        ingestArtifact(inventory, await fetchText(url));
      } catch (err) {
        console.error(`    ! failed ${url}: ${err.message}`);
      }
    }
  });

  const report = buildReport(inventory);
  const ctx = {
    repo: opts.repo,
    revision: opts.revision,
    totalJobs,
    jobsWithArtifact,
  };
  printReport(inventory, report, ctx);

  if (opts.json) {
    const out = {
      context: { ...ctx, pushId, scannedJobs: jobs.length },
      totals: {
        artifacts: inventory.totalArtifacts,
        lines: inventory.totalLines,
      },
      actionsPresent: Object.fromEntries(
        [...inventory.actions.entries()].map(([action, b]) => [
          action,
          { lines: b.lines, fields: Object.fromEntries(b.fields) },
        ]),
      ),
      ...report,
    };
    const { writeFile } = await import('node:fs/promises');
    await writeFile(opts.json, JSON.stringify(out, null, 2));
    console.error(`Wrote machine-readable report to ${opts.json}`);
  }
};

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
