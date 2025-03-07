import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tooltip,
  FormGroup,
  Input,
  Label,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronCircleDown,
  faChevronCircleUp,
  faSpinner,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

import {
  bugzillaBugsApi,
  bzBaseUrl,
  bzComponentEndpoint,
  getApiUrl,
} from '../helpers/url';
import { create } from '../helpers/http';
import { notify } from '../job-view/redux/stores/notifications';

export const omittedLeads = [
  'TEST-UNEXPECTED-FAIL',
  'PROCESS-CRASH',
  'TEST-UNEXPECTED-ERROR',
  'REFTEST ERROR',
];
/*
 *  Find the first thing in the summary line that looks like a filename.
 */
const findFilename = (summary) => {
  // Take left side of any reftest comparisons, as the right side is the reference file
  // eslint-disable-next-line prefer-destructuring
  summary = summary.split('==')[0];
  // Take the leaf node of unix paths
  summary = summary.split('/').pop();
  // Take the leaf node of Windows paths
  summary = summary.split('\\').pop();
  // Remove leading/trailing whitespace
  summary = summary.trim();
  // If there's a space in what's remaining, take the first word
  // eslint-disable-next-line prefer-destructuring
  summary = summary.split(' ')[0];
  return summary;
};
/*
 *  Remove extraneous junk from the start of the summary line
 *  and try to find the failing test name from what's left
 */
export const parseSummary = (suggestion) => {
  let summary = suggestion.search;
  const searchTerms = suggestion.search_terms;
  // Strip out some extra stuff at the start of some failure paths
  let re = /file:\/\/\/.*?\/build\/tests\/reftest\/tests\//gi;
  summary = summary.replace(re, '');
  re = /chrome:\/\/mochitests\/content\/a11y\//gi;
  summary = summary.replace(re, '');
  re = /http:\/\/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):([0-9]+)\/tests\//gi;
  summary = summary.replace(re, '');
  re = /xpcshell([-a-zA-Z0-9]+)?.(ini|toml):/gi;
  summary = summary.replace(re, '');
  summary = summary.replace('/_mozilla/', 'mozilla/tests/');
  // We don't want to include "REFTEST" when it's an unexpected pass
  summary = summary.replace(
    'REFTEST TEST-UNEXPECTED-PASS',
    'TEST-UNEXPECTED-PASS',
  );
  const summaryParts = summary.split(' | ');

  // If the search_terms used for finding bug suggestions
  // contains any of the omittedLeads, that lead is needed
  // for the full string match, so don't omit it in this case.
  // If it's not needed, go ahead and omit it.
  if (searchTerms.length && summaryParts.length > 1) {
    omittedLeads.forEach((lead) => {
      if (!searchTerms[0].includes(lead) && summaryParts[0].includes(lead)) {
        summaryParts.shift();
      }
    });
  }

  // Some of the TEST-FOO bits aren't removed from the summary,
  // so we sometimes end up with them instead of the test path here.
  const summaryName =
    summaryParts[0].startsWith('TEST-') && summaryParts.length > 1
      ? summaryParts[1]
      : summaryParts[0];
  const possibleFilename = findFilename(summaryName);

  return [summaryParts, possibleFilename];
};

export const getCrashSignatures = (failureLine) => {
  const crashRegex = /(\[@ .+\])/g;
  const crashSignatures = failureLine.search.match(crashRegex);
  return crashSignatures ? [crashSignatures[0]] : [];
};
