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
    const [path, value] = item.name
      .replace(/^public\//, '')
      .match(/^(?:(.*)\/)?(.*)$/)
      .slice(1);
    artifactParams.artifactPath = item.name;
    return {
      url: getArtifactsUrl(artifactParams),
      value,
      path: path || '',
      contentLength: item.contentLength,
      expires: item.expires,
      // for backwards compatibility with JobDetail API
      title: 'artifact uploaded',
    };
  });
};

export const formatByteSize = function formatByteSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(i === 0 || size >= 10 ? 0 : 1)} ${units[i]}`;
};

export const formatExpires = function formatExpires(expires) {
  if (!expires) return '';
  const days = Math.floor((new Date(expires).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return '';
  if (days <= 0) return 'expired';
  if (days < 60) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
};

export const formatSizeTooltip = function formatSizeTooltip(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  return `${bytes.toLocaleString()} bytes`;
};

export const formatExpiresTooltip = function formatExpiresTooltip(expires) {
  if (!expires) return '';
  const date = new Date(expires);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', longDateFormat);
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
