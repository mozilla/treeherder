import {
  getAllUrlParams,
  getUrlParam,
  replaceLocation,
  setUrlParam,
} from '../helpers/location';

/**
 * Split raw log text into display lines using the SAME line-boundary rules the
 * backend log parser uses, so displayed line numbers line up with the error
 * `line_number`s the backend records.
 *
 * The parser counts lines via `requests.iter_lines()` (Python's
 * `bytes.splitlines()`), which breaks on `\n`, `\r`, AND `\r\n`. A plain
 * `text.split('\n')` misses bare carriage returns — common in test progress
 * output — so every line after a `\r` drifts, and the red error highlight lands
 * a few lines off from the actual failure line. Splitting on the same set of
 * separators keeps the viewer aligned with the parser. Handling `\r\n` as one
 * break (rather than splitting on `\n` alone) also drops the stray trailing
 * `\r` that CRLF logs would otherwise leave on every line.
 */
export const splitLogIntoLines = (text) => text.split(/\r\n|\r|\n/);

/**
 * Read the lineNumber URL param as an array of one or two ints, or null.
 */
export const getUrlLineNumber = () => {
  const param = getUrlParam('lineNumber');
  if (!param) return null;
  return param.split('-').map((line) => parseInt(line, 10));
};

/**
 * Write a highlight (array of one or two line numbers) to the URL param.
 * Empty/null clears the param.
 */
export const writeLineNumberParam = (highlight) => {
  if (!highlight || highlight.length === 0) {
    setUrlParam('lineNumber', null);
  } else if (highlight.length > 1) {
    setUrlParam('lineNumber', `${highlight[0]}-${highlight[1]}`);
  } else {
    setUrlParam('lineNumber', highlight[0]);
  }
};

/**
 * Read the record URL params written by getLogViewerRecordUrl:
 * `{ texts, time }`, or null when absent. `time` is null when not given.
 */
export const getUrlLogTarget = () => {
  const texts = getAllUrlParams()
    .getAll('lineText')
    .filter((text) => text);
  if (!texts.length) return null;
  const time = parseInt(getUrlParam('lineTime'), 10);
  return { texts, time: Number.isFinite(time) ? time : null };
};

/**
 * Replace the record params with the log line they resolved to (or drop them
 * when `lineNumber` is null), in a single history entry.
 */
export const writeResolvedLogTarget = (lineNumber) => {
  const params = getAllUrlParams();
  params.delete('lineText');
  params.delete('lineTime');
  if (lineNumber) {
    params.set('lineNumber', lineNumber);
  }
  replaceLocation(params);
};

// The time run-task stamps on every line it relays: `[task <ISO 8601>] `.
const TASK_STAMP_RE = /^\[task ([^\]]+)\]/;

const taskTimeOf = (line) => {
  const match = TASK_STAMP_RE.exec(line);
  return match ? Date.parse(match[1]) : NaN;
};

// The harness and run-task read the same clock, but not always at the same
// resolution: on Windows a line can be stamped a timer tick (~16ms) before its
// record. Keep this well under the time a test takes to run again, which
// test-verify does in a few hundred milliseconds.
const CLOCK_TOLERANCE_MS = 100;

/**
 * Find the task log line of a summary.jsonl record: 1-based, or null.
 *
 * The task log belongs to the worker, which adds lines of its own at any
 * time, so a record cannot know its line number. It is located by content
 * instead, among the lines containing every one of `texts` (falling back to
 * the first text alone, the test path, when none does). Repeated runs of a
 * test print the same text, so the record's `time` (ms) picks one: a line is
 * printed once its record exists, never before, and possibly much later
 * (xpcshell replays a failing test's statuses when the test ends). The first
 * match run-task stamped from that time on wins, else the last one before it.
 * Without a time or stamps, the first match is returned.
 */
export const resolveLogLine = (lines, texts, time) => {
  if (!lines || !texts || !texts.length) return null;
  const matching = (needles) => {
    const found = [];
    lines.forEach((line, index) => {
      if (needles.every((needle) => line.includes(needle))) found.push(index);
    });
    return found;
  };
  let candidates = matching(texts);
  if (!candidates.length && texts.length > 1) {
    candidates = matching(texts.slice(0, 1));
  }
  if (!candidates.length) return null;

  if (!Number.isFinite(time)) return candidates[0] + 1;
  const stamped = candidates
    .map((index) => ({ index, at: taskTimeOf(lines[index]) }))
    .filter((candidate) => Number.isFinite(candidate.at));
  if (!stamped.length) return candidates[0] + 1;
  const printedAfter = stamped.find(
    (candidate) => candidate.at >= time - CLOCK_TOLERANCE_MS,
  );
  return (printedAfter ?? stamped[stamped.length - 1]).index + 1;
};

/**
 * Find the next error line strictly greater than `current`, wrapping to the first.
 * Returns null if `errorLineNumbers` is empty.
 */
export const findNextErrorLine = (errorLineNumbers, current) => {
  if (!errorLineNumbers || errorLineNumbers.length === 0) return null;
  const next = errorLineNumbers.find((ln) => ln > current);
  return next ?? errorLineNumbers[0];
};

/**
 * Find the previous error line strictly less than `current`, wrapping to the last.
 * Returns null if `errorLineNumbers` is empty.
 */
export const findPrevErrorLine = (errorLineNumbers, current) => {
  if (!errorLineNumbers || errorLineNumbers.length === 0) return null;
  for (let i = errorLineNumbers.length - 1; i >= 0; i--) {
    if (errorLineNumbers[i] < current) return errorLineNumbers[i];
  }
  return errorLineNumbers[errorLineNumbers.length - 1];
};

/**
 * Copy the user's currently-selected log text into the BugFiler's summary
 * input in the opener window. Used by the Bug-Filer integration: the user
 * highlights text in the log, the BugFiler is opened in another window, and
 * this helper inserts the highlighted text at the input's caret position.
 */
export const copySelectedLogToBugFiler = () => {
  const selection = window.getSelection();
  const insideLog = document
    .querySelector('.log-contents')
    ?.contains(selection.anchorNode);
  if (!insideLog) return;
  const text = selection.toString().trim();
  if (!text) return;

  const descriptionField =
    window.opener?.document.getElementById('summary-input');
  if (!descriptionField) return;

  const startPos = descriptionField.selectionStart;
  const endPos = descriptionField.selectionEnd;
  descriptionField.value =
    descriptionField.value.substring(0, startPos) +
    text +
    descriptionField.value.substring(endPos, descriptionField.value.length);
  descriptionField.selectionStart = startPos + text.length;
  descriptionField.selectionEnd = startPos + text.length;

  const event = document.createEvent('HTMLEvents');
  event.initEvent('change', true, true);
  descriptionField.dispatchEvent(event);
};
