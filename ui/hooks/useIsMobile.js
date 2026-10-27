import useMediaQuery from './useMediaQuery';

// Narrow screens, plus phones turned to landscape (short touch screens).
// The CSS media queries that style the phone layout must use the same query.
export const MOBILE_QUERY =
  '(max-width: 767.98px), (pointer: coarse) and (max-height: 500px)';

export default function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY);
}
