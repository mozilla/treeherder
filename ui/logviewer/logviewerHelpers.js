import { getUrlParam, setUrlParam } from '../helpers/location';

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
