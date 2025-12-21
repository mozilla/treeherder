import {
  faCheck,
  faClock,
  faExclamationTriangle,
} from '@fortawesome/free-solid-svg-icons';

import dayjs from './dayjs';
import { getArtifactsUrl } from './url';
import { alertsViewDatetimeFormat, mercurialDatetimeFormat } from './constants';

export const longDateFormat = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hour12: false,
};

export const shortDateFormat = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hour12: false,
};

export const toDateStr = function toDateStr(timestamp) {
  return new Date(timestamp * 1000).toLocaleString('en-US', longDateFormat);
};

/**
 * @param { Date } awareDatetime Must contain the time zone information embedded in it
 */
export function toMercurialDateStr(awareDatetime) {
  return `${dayjs.utc(awareDatetime).format(mercurialDatetimeFormat)}`;
}

/**
 * @param { Date } awareDatetime Must contain the time zone information embedded in it
 */
export function toMercurialShortDateStr(awareDatetime) {
  return `${dayjs.utc(awareDatetime).format(alertsViewDatetimeFormat)}`;
}

export const toShortDateStr = function toDateStr(timestamp) {
  return new Date(timestamp * 1000).toLocaleString('en-US', shortDateFormat);
};

// remove any words that are 1 letter long for matching
export const getSearchWords = function getHighlighterArray(text) {
  const tokens = text.split(/[^a-zA-Z0-9_-]+/);

  return tokens.reduce(
    (acc, token) => (token.length > 1 ? [...acc, token] : acc),
    [],
  );
};

export const getPercentComplete = function getPercentComplete(counts) {
  const { pending, running, completed } = counts;
  const total = completed + pending + running;

  // pushes older than our 4-month data cutoff we want to display as 100% complete
  // in the status progress indicator even though the total counts will be 0
  return total > 0 ? Math.floor((completed / total) * 100) : 100;
};

export const formatArtifacts = function formatArtifacts(data, artifactParams) {
  return data.map((item) => {
    const value = item.name.replace(/.*\//, '');
    artifactParams.artifactPath = item.name;
    // for backwards compatibility with JobDetail API
    const title = 'artifact uploaded';
    return { url: getArtifactsUrl(artifactParams), value, title };
  });
};

export const errorLinesCss = function errorLinesCss(errors) {
  const style = document.createElement('style');
  const rule = errors
    .map(({ lineNumber }) => `a[id="${lineNumber}"]+span`)
    .join(',')
    .concat('{background:#fbe3e3;color:#a94442}');

  style.type = 'text/css';
  document.getElementsByTagName('head')[0].appendChild(style);
  style.sheet.insertRule(rule);
};

export const resultColorMap = {
  pass: 'success',
  fail: 'danger',
  indeterminate: 'secondary',
  done: 'darker-info',
  'in progress': 'secondary',
  none: 'darker-info',
  unknown: 'secondary',
};

export const getIcon = (result) => {
  switch (result) {
    case 'pass':
      return faCheck;
    case 'fail':
      return faExclamationTriangle;
    case 'in progress':
      return faClock;
  }
  return faClock;
};
