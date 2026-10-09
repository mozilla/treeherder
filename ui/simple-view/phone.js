import { FULL_VIEW_KEY, MOBILE_UA, MOBILE_UA_PREFIX } from './constants';

export const isMobileUserAgent = (ua = '') =>
  MOBILE_UA.test(ua) || MOBILE_UA_PREFIX.test(ua.slice(0, 4));

export const isPhone = () =>
  isMobileUserAgent(navigator.userAgent || navigator.vendor || window.opera);

export const prefersFullView = () => {
  try {
    return sessionStorage.getItem(FULL_VIEW_KEY) === '1';
  } catch {
    return false;
  }
};

export const chooseFullView = () => {
  try {
    sessionStorage.setItem(FULL_VIEW_KEY, '1');
  } catch {
  }
};

// Where a jobs-view URL goes on a phone, or null to stay put. Every parameter
// is kept so a link still points at what it was for.
export const simpleViewFor = (search, { phone, fullView }) => {
  if (!phone || fullView) return null;
  const query = new URLSearchParams(search).toString();
  return query ? `/simple?${query}` : '/simple';
};
