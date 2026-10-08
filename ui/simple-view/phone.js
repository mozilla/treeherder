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

export const simpleViewFor = (search, { phone, fullView }) => {
  if (!phone || fullView) return null;
  const params = new URLSearchParams(search);
  const next = new URLSearchParams();
  for (const key of ['repo', 'revision', 'author']) {
    if (params.get(key)) next.set(key, params.get(key));
  }
  const query = next.toString();
  return query ? `/simple?${query}` : '/simple';
};
