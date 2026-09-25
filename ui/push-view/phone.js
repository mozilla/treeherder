// Phones visiting the jobs view get the push view instead, since the jobs
// view is laid out for a desktop. Choosing the full view from the push view
// turns this off for the rest of the browser session.

const FULL_VIEW_KEY = 'pushViewFullView';

// A small touch screen. This reads the screen, not the window: the jobs view
// has no viewport tag, so a phone lays it out about 980px wide and a
// max-width query never matches there. A desktop window dragged thin isn't
// touch, so it keeps the jobs view.
export const isPhone = () =>
  Math.min(window.screen.width, window.screen.height) <= 640 &&
  !!window.matchMedia?.('(pointer: coarse)').matches;

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
    // Without storage the redirect can't be skipped; the link still works on
    // anything that isn't a phone.
  }
};

// Where a jobs-view URL goes on a phone, or null to stay put. A link to one
// push keeps pointing at that push.
export const pushViewFor = (search, { phone, fullView }) => {
  if (!phone || fullView) return null;
  const params = new URLSearchParams(search);
  const next = new URLSearchParams();
  for (const key of ['repo', 'revision']) {
    if (params.get(key)) next.set(key, params.get(key));
  }
  const query = next.toString();
  return query ? `/push?${query}` : '/push';
};
