import { useSyncExternalStore } from 'react';

const query = '(max-width: 767.98px)';

const subscribe = (onChange) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

const getSnapshot = () => window.matchMedia(query).matches;

export default function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
