#!/usr/bin/env node
// Download every *_testsummary.jsonl artifact for a given revision and build an
// inventory of what *survives* the mozlog TestSummaryFormatter — i.e. what is
// NOT filtered out.
//
// The TestSummaryFormatter
// (firefox/testing/mozbase/mozlog/mozlog/formatters/testsummary.py) is a
// passthrough formatter whose output is the *_testsummary.jsonl artifact. It
// drops a few action types / non-ERROR logs and strips a fixed set of fields.
// This script inspects the *output* across a whole push and reports the action
// types, per-action field usage, and value distributions that actually make it
// through, so we can judge whether the formatter keeps the right things and spot
// anything that arguably should still be filtered.
//
// Usage:
//   node scripts/testsummary-inventory.mjs <revision> \
//     [--project mozilla-central] \
//     [--out-dir ./testsummary-cache/<revision>] \
//     [--th-url https://treeherder.mozilla.org] \
//     [--root-url https://firefox-ci-tc.services.mozilla.com] \
//     [--concurrency 8]
//
// Requires Node >= 22 (global fetch). No external dependencies.

import { mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Reference: the formatter's own rules, mirrored from testsummary.py so the
// report can label findings as "expected to survive" vs "should be filtered".
// ---------------------------------------------------------------------------
const FORMATTER = {
  // actions dropped entirely
  DROPPED_ACTIONS: ['process_output', 'mozleak_total'],
  // `log` records survive only at level ERROR
  LOG_KEPT_LEVEL: 'ERROR',
  // fields stripped from every emitted record
  ALWAYS_STRIP: ['thread', 'pid', 'source', 'extra', 'tests'],
  // any field starting with this prefix is also stripped
  STRIP_PREFIX: 'stackwalk_',
};

const SUMMARY_ARTIFACT_SUFFIX = '_testsummary.jsonl';

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    revision: null,
    project: 'mozilla-central',
    outDir: null,
    thUrl: 'https://treeherder.mozilla.org',
    rootUrl: 'https://firefox-ci-tc.services.mozilla.com',
    concurrency: 8,
    cleanup: false,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--project':
        opts.project = argv[++i];
        break;
      case '--out-dir':
        opts.outDir = argv[++i];
        break;
      case '--th-url':
        opts.thUrl = argv[++i].replace(/\/$/, '');
        break;
      case '--root-url':
        opts.rootUrl = argv[++i].replace(/\/$/, '');
        break;
      case '--concurrency':
        opts.concurrency = Math.max(1, parseInt(argv[++i], 10) || 8);
        break;
      case '--cleanup':
        opts.cleanup = true;
        break;
      case '-h':
      case '--help':
        opts.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        rest.push(arg);
    }
  }
  opts.revision = rest[0] ?? null;
  if (!opts.outDir && opts.revision) {
    opts.outDir = path.join('testsummary-cache', opts.revision);
  }
  return opts;
}

const HELP = `Download every *_testsummary.jsonl for a revision and inventory what survives the formatter.

Usage:
  node scripts/testsummary-inventory.mjs <revision> [options]

Options:
  --project <name>      Treeherder project/repo (default: mozilla-central)
  --out-dir <dir>       Cache + report directory (default: ./testsummary-cache/<revision>)
  --th-url <url>        Treeherder base URL (default: https://treeherder.mozilla.org)
  --root-url <url>      Taskcluster root URL (default: https://firefox-ci-tc.services.mozilla.com)
  --concurrency <n>     Parallel downloads (default: 8)
  --cleanup             Delete the downloaded *.jsonl files after building the
                        report (report.txt / report.json are kept)
  -h, --help            Show this help
`;

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
async function fetchJson(url) {
  const resp = await fetch(url, { headers: { 'User-Agent': 'testsummary-inventory' } });
  if (!resp.ok) {
    throw new Error(`GET ${url} -> ${resp.status} ${resp.statusText}`);
  }
  return resp.json();
}

// ---------------------------------------------------------------------------
// Stage 1: revision -> push -> jobs
// ---------------------------------------------------------------------------
async function resolvePushId(opts) {
  const url = `${opts.thUrl}/api/project/${opts.project}/push/?revision=${encodeURIComponent(
    opts.revision,
  )}`;
  const data = await fetchJson(url);
  const results = data.results ?? [];
  if (results.length === 0) {
    throw new Error(
      `No push found for revision "${opts.revision}" on project "${opts.project}". ` +
        `Try a different --project (e.g. autoland, try, mozilla-central).`,
    );
  }
  return results[0].id;
}

// The jobs response may be object form (results: [{...}]) or column-array form
// (job_property_names + results: [[...]]). Normalise to objects.
function normaliseJobs(data) {
  const results = data.results ?? [];
  const names = data.job_property_names;
  if (results.length && Array.isArray(results[0]) && Array.isArray(names)) {
    return results.map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  }
  return results;
}

async function fetchJobs(opts, pushId) {
  const jobs = [];
  const count = 2000;
  let offset = 0;
  for (;;) {
    const url = `${opts.thUrl}/api/project/${opts.project}/jobs/?push_id=${pushId}&count=${count}&offset=${offset}&format=json`;
    const data = await fetchJson(url);
    const batch = normaliseJobs(data);
    jobs.push(...batch);
    if (batch.length < count) break;
    offset += count;
  }
  return jobs;
}

// ---------------------------------------------------------------------------
// Stage 2: discover *_testsummary.jsonl artifacts per job
// ---------------------------------------------------------------------------
function artifactsListUrl(opts, taskId, runId) {
  return `${opts.rootUrl}/api/queue/v1/task/${taskId}/runs/${runId}/artifacts`;
}

function artifactDownloadUrl(opts, taskId, runId, name) {
  return `${opts.rootUrl}/api/queue/v1/task/${taskId}/runs/${runId}/artifacts/${name}`;
}

async function discoverArtifacts(opts, jobs) {
  const found = [];
  let withTaskInfo = 0;
  await runPool(
    jobs,
    opts.concurrency,
    async (job) => {
      const taskId = job.task_id;
      const runId = job.retry_id;
      if (!taskId || runId === undefined || runId === null) return;
      withTaskInfo += 1;
      let listing;
      try {
        listing = await fetchJson(artifactsListUrl(opts, taskId, runId));
      } catch {
        return; // task may be expired / no artifacts
      }
      for (const artifact of listing.artifacts ?? []) {
        if (artifact.name?.endsWith(SUMMARY_ARTIFACT_SUFFIX)) {
          found.push({
            taskId,
            runId,
            name: artifact.name,
            jobId: job.id,
            jobType: job.job_type_name,
            platform: job.platform,
            url: artifactDownloadUrl(opts, taskId, runId, artifact.name),
          });
        }
      }
    },
  );
  return { found, withTaskInfo };
}

// ---------------------------------------------------------------------------
// Stage 3: download with caching
// ---------------------------------------------------------------------------
function cacheFileName(artifact) {
  const base = artifact.name.split('/').pop();
  return `${artifact.taskId}_${artifact.runId}_${base}`;
}

async function fileExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function downloadAll(opts, artifacts) {
  let downloaded = 0;
  let cached = 0;
  let failed = 0;
  await runPool(artifacts, opts.concurrency, async (artifact) => {
    const dest = path.join(opts.outDir, cacheFileName(artifact));
    artifact.localPath = dest;
    if (await fileExists(dest)) {
      cached += 1;
      return;
    }
    try {
      const resp = await fetch(artifact.url, {
        headers: { 'User-Agent': 'testsummary-inventory' },
      });
      if (!resp.ok || !resp.body) {
        failed += 1;
        artifact.localPath = null;
        return;
      }
      await pipeline(Readable.fromWeb(resp.body), createWriteStream(dest));
      downloaded += 1;
    } catch {
      failed += 1;
      artifact.localPath = null;
    }
  });
  return { downloaded, cached, failed };
}

// ---------------------------------------------------------------------------
// Stage 4: aggregate the survivor inventory
// ---------------------------------------------------------------------------
function newInventory() {
  return {
    actionCounts: {}, // action -> count
    fieldsByAction: {}, // action -> { field -> count }
    logLevels: {}, // level -> count (for action === 'log')
    testStatus: { expected: 0, unexpected: 0, noExpected: 0 },
    leakage: {
      strippedFields: {}, // field -> count (thread/pid/source/extra/tests/stackwalk_*)
      droppedActions: {}, // process_output / mozleak_total -> count
      nonErrorLogs: {}, // level -> count
    },
    totalRecords: 0,
    totalBytes: 0,
    parseErrors: 0,
    filesScanned: 0,
  };
}

function bump(obj, key, by = 1) {
  obj[key] = (obj[key] ?? 0) + by;
}

function recordOne(inv, rec) {
  const action = rec.action ?? '<no-action>';
  bump(inv.actionCounts, action);

  inv.fieldsByAction[action] ??= {};
  for (const field of Object.keys(rec)) {
    bump(inv.fieldsByAction[action], field);
    // leakage: stripped fields that survived
    if (FORMATTER.ALWAYS_STRIP.includes(field) || field.startsWith(FORMATTER.STRIP_PREFIX)) {
      bump(inv.leakage.strippedFields, field);
    }
  }

  if (action === 'log') {
    const level = rec.level ?? '<no-level>';
    bump(inv.logLevels, level);
    if (level !== FORMATTER.LOG_KEPT_LEVEL) {
      bump(inv.leakage.nonErrorLogs, level);
    }
  }

  if (action === 'test_status') {
    if (rec.expected === undefined) {
      inv.testStatus.noExpected += 1;
    } else if (rec.status === rec.expected) {
      inv.testStatus.expected += 1;
    } else {
      inv.testStatus.unexpected += 1;
    }
  }

  if (FORMATTER.DROPPED_ACTIONS.includes(action)) {
    bump(inv.leakage.droppedActions, action);
  }
}

async function aggregate(opts, artifacts) {
  const inv = newInventory();
  for (const artifact of artifacts) {
    if (!artifact.localPath) continue;
    inv.filesScanned += 1;
    try {
      const st = await stat(artifact.localPath);
      inv.totalBytes += st.size;
    } catch {
      /* ignore */
    }
    const rl = createInterface({
      input: createReadStream(artifact.localPath),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let rec;
      try {
        rec = JSON.parse(trimmed);
      } catch {
        inv.parseErrors += 1;
        continue;
      }
      inv.totalRecords += 1;
      recordOne(inv, rec);
    }
  }
  return inv;
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
function sortedEntries(obj) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

function pad(str, width) {
  str = String(str);
  return str.length >= width ? str : str + ' '.repeat(width - str.length);
}

function renderReport(opts, meta, inv) {
  const lines = [];
  const h = (t) => {
    lines.push('');
    lines.push(`== ${t} ==`);
  };

  lines.push('TestSummaryFormatter survivor inventory');
  lines.push(`revision : ${opts.revision}`);
  lines.push(`project  : ${opts.project}`);
  lines.push(`push_id  : ${meta.pushId}`);

  h('Totals');
  lines.push(`jobs scanned              : ${meta.jobCount}`);
  lines.push(`jobs with task/run info   : ${meta.withTaskInfo}`);
  lines.push(`summary artifacts found   : ${meta.artifactCount}`);
  lines.push(`  downloaded              : ${meta.downloaded}`);
  lines.push(`  from cache              : ${meta.cached}`);
  lines.push(`  failed                  : ${meta.failed}`);
  lines.push(`files scanned             : ${inv.filesScanned}`);
  lines.push(`total records             : ${inv.totalRecords}`);
  lines.push(`total bytes               : ${inv.totalBytes}`);
  lines.push(`json parse errors         : ${inv.parseErrors}`);

  h('Actions that survive (by record count)');
  for (const [action, count] of sortedEntries(inv.actionCounts)) {
    const note = FORMATTER.DROPPED_ACTIONS.includes(action)
      ? '  <-- formatter is supposed to DROP this action'
      : '';
    lines.push(`${pad(action, 24)} ${pad(count, 10)}${note}`);
  }

  h('Fields present per surviving action (field: record-count)');
  for (const [action] of sortedEntries(inv.actionCounts)) {
    lines.push(`[${action}]`);
    for (const [field, count] of sortedEntries(inv.fieldsByAction[action])) {
      const stripped =
        FORMATTER.ALWAYS_STRIP.includes(field) || field.startsWith(FORMATTER.STRIP_PREFIX);
      const note = stripped ? '  <-- formatter is supposed to STRIP this field' : '';
      lines.push(`  ${pad(field, 22)} ${pad(count, 10)}${note}`);
    }
  }

  h('log level distribution (action === "log")');
  if (Object.keys(inv.logLevels).length === 0) {
    lines.push('(no log records)');
  } else {
    for (const [level, count] of sortedEntries(inv.logLevels)) {
      const note =
        level !== FORMATTER.LOG_KEPT_LEVEL ? '  <-- only ERROR is supposed to survive' : '';
      lines.push(`${pad(level, 24)} ${pad(count, 10)}${note}`);
    }
  }

  h('test_status: expected vs unexpected');
  lines.push(`unexpected (status != expected) : ${inv.testStatus.unexpected}`);
  lines.push(
    `expected   (status == expected) : ${inv.testStatus.expected}  ` +
      `(docstring says these should be dropped; current code keeps them)`,
  );
  lines.push(`no "expected" field             : ${inv.testStatus.noExpected}`);

  h('Leakage check (records present that the formatter rules say to remove)');
  const leakLines = [];
  for (const [action, count] of sortedEntries(inv.leakage.droppedActions)) {
    leakLines.push(`dropped action present : ${action} (${count})`);
  }
  for (const [field, count] of sortedEntries(inv.leakage.strippedFields)) {
    leakLines.push(`stripped field present : ${field} (${count})`);
  }
  for (const [level, count] of sortedEntries(inv.leakage.nonErrorLogs)) {
    leakLines.push(`non-ERROR log present  : ${level} (${count})`);
  }
  if (leakLines.length === 0) {
    lines.push('none — output matches the formatter rules');
  } else {
    lines.push(...leakLines);
  }

  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Tiny concurrency pool
// ---------------------------------------------------------------------------
async function runPool(items, concurrency, worker) {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = index++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(HELP);
    process.exit(2);
  }
  if (opts.help || !opts.revision) {
    console.log(HELP);
    process.exit(opts.help ? 0 : 2);
  }

  await mkdir(opts.outDir, { recursive: true });

  console.error(`Resolving push for revision ${opts.revision} on ${opts.project}...`);
  const pushId = await resolvePushId(opts);
  console.error(`push_id = ${pushId}`);

  console.error('Fetching jobs...');
  const jobs = await fetchJobs(opts, pushId);
  console.error(`${jobs.length} jobs`);

  console.error('Discovering *_testsummary.jsonl artifacts...');
  const { found: artifacts, withTaskInfo } = await discoverArtifacts(opts, jobs);
  console.error(`${artifacts.length} summary artifacts`);

  console.error(`Downloading into ${opts.outDir} (cached files skipped)...`);
  const dl = await downloadAll(opts, artifacts);
  console.error(`downloaded ${dl.downloaded}, cached ${dl.cached}, failed ${dl.failed}`);

  console.error('Aggregating survivor inventory...');
  const inv = await aggregate(opts, artifacts);

  const meta = {
    pushId,
    jobCount: jobs.length,
    withTaskInfo,
    artifactCount: artifacts.length,
    downloaded: dl.downloaded,
    cached: dl.cached,
    failed: dl.failed,
  };

  const report = renderReport(opts, meta, inv);
  const txtPath = path.join(opts.outDir, 'report.txt');
  const jsonPath = path.join(opts.outDir, 'report.json');
  await writeFile(txtPath, report, 'utf8');
  await writeFile(
    jsonPath,
    JSON.stringify(
      {
        revision: opts.revision,
        project: opts.project,
        meta,
        formatterRules: FORMATTER,
        inventory: inv,
        artifacts: artifacts.map((a) => ({
          jobId: a.jobId,
          jobType: a.jobType,
          platform: a.platform,
          taskId: a.taskId,
          runId: a.runId,
          name: a.name,
          localPath: a.localPath,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(report);
  console.error(`\nWrote ${txtPath} and ${jsonPath}`);

  if (opts.cleanup) {
    let removed = 0;
    await runPool(artifacts, opts.concurrency, async (artifact) => {
      if (!artifact.localPath) return;
      try {
        await rm(artifact.localPath);
        removed += 1;
      } catch {
        /* already gone */
      }
    });
    console.error(`Cleaned up ${removed} downloaded *.jsonl file(s)`);
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
