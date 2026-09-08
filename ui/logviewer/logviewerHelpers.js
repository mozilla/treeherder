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
 * Read the console-line URL params written by getLogViewerConsoleLineUrl:
 * `{ line, anchorLine, message }`, or null when absent.
 */
export const getUrlConsoleLine = () => {
  const line = parseInt(getUrlParam('consoleLine'), 10);
  const message = getUrlParam('consoleAnchor');
  if (!(line > 0) || !message) return null;
  const anchorLine = parseInt(getUrlParam('consoleAnchorLine'), 10);
  return { line, anchorLine: anchorLine > 0 ? anchorLine : 1, message };
};

/**
 * Replace the console-line params with the log line they resolved to (or
 * drop them when `lineNumber` is null), in a single history entry.
 */
export const writeResolvedConsoleLine = (lineNumber) => {
  const params = getAllUrlParams();
  params.delete('consoleLine');
  params.delete('consoleAnchorLine');
  params.delete('consoleAnchor');
  if (lineNumber) {
    params.set('lineNumber', lineNumber);
  }
  replaceLocation(params);
};

// A line written by mozharness's logger: `HH:MM:SS LEVEL - ...`, optionally
// behind the worker's `[task <timestamp>] ` prefix.
const MOZHARNESS_LINE_RE = /^(\[task [^\]]+\] )?\d\d:\d\d:\d\d\s+[A-Z]+ - /;

/**
 * Translate a line counted by mozharness (the `line` of a summary.jsonl
 * record) into a 1-based line number of the task log.
 *
 * mozharness only counts the lines it writes itself, whereas the task log
 * also holds a preamble and lines the worker injects at any time. So the
 * anchor message (mozharness's first console line, at `anchorLine` in its own
 * count) is located in the log, and only mozharness-formatted lines are
 * counted from there on. Returns null when the anchor is missing or the line
 * falls past the end of the log.
 */
export const resolveConsoleLine = (lines, anchorMessage, anchorLine, consoleLine) => {
  if (!lines || !anchorMessage || !(consoleLine > 0)) return null;
  const start = lines.findIndex((line) => line.includes(anchorMessage));
  if (start < 0) return null;
  let remaining = consoleLine - (anchorLine > 0 ? anchorLine : 1);
  if (remaining < 0) return null;
  for (let i = start; i < lines.length; i++) {
    if (i === start || MOZHARNESS_LINE_RE.test(lines[i])) {
      if (remaining === 0) return i + 1;
      remaining -= 1;
    }
  }
  return null;
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
