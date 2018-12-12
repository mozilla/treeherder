import { countBy } from 'lodash-es';
import React from 'react';

export const stringOverlap = function stringOverlap(str1, str2) {
  // Get a measure of the similarity of two strings by a simple process
  // of tokenizing and then computing the ratio of the tokens in common to
  // the total tokens

  const tokens = [str1, str2]
    .map(str =>
      // Replace paths like /foo/bar/baz.html with just the filename baz.html
      str.replace(/[^\s]+\/([^\s]+)\s/, (m, p1) => ` ${p1} `),
    )
    .map(str =>
      // Split into tokens on whitespace / ,  and |
      str.split(/[\s/,|]+/).filter(x => x !== ''),
    );

  if (tokens[0].length === 0 || tokens[1].length === 0) {
    return 0;
  }

  const tokenCounts = tokens.map(tokens => countBy(tokens, x => x));

  const overlap = Object.keys(tokenCounts[0]).reduce((overlap, x) => {
    if (Object.prototype.hasOwnProperty.call(tokenCounts[1], x)) {
      overlap += 2 * Math.min(tokenCounts[0][x], tokenCounts[1][x]);
    }
    return overlap;
  }, 0);

  return overlap / (tokens[0].length + tokens[1].length);
};

export const highlightLogLine = function highlightLogLine(logLine) {
  const parts = logLine.split(' | ', 3);
  return (
    <span>
      {parts[0].startsWith('TEST-UNEXPECTED') && (
        <span>
          <strong className="failure-line-status">{parts[0]}</strong>
          <strong>{parts[1]}</strong>
        </span>
      )}
      {!parts[0].startsWith('TEST-UNEXPECTED') && logLine}
    </span>
  );
};
