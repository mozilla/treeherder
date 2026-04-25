import { useEffect } from 'react';

import { getPerfAnalysisUrl, isResourceUsageProfile } from '../helpers/url';

/**
 * Window-level keyboard shortcuts for the logviewer:
 *   Shift+L  open raw log in a new tab
 *   N / P    next / previous error line
 *   G        open the resource-usage profile in the Firefox Profiler
 *
 * Suppressed when an input or textarea has focus.
 */
export function useLogviewerKeyboardShortcuts({
  rawLogUrl,
  jobDetails,
  job,
  onNextError,
  onPrevError,
}) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA'
      ) {
        return;
      }

      if (event.shiftKey && event.key === 'L') {
        event.preventDefault();
        if (rawLogUrl) window.open(rawLogUrl, '_blank');
        return;
      }

      if (event.key === 'n') {
        event.preventDefault();
        onNextError();
        return;
      }

      if (event.key === 'p') {
        event.preventDefault();
        onPrevError();
        return;
      }

      if (event.key === 'g') {
        event.preventDefault();
        const resourceUsageProfile = jobDetails.find((artifact) =>
          isResourceUsageProfile(artifact.value),
        );
        if (resourceUsageProfile) {
          window.open(
            getPerfAnalysisUrl(resourceUsageProfile.url, job),
            '_blank',
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rawLogUrl, jobDetails, job, onNextError, onPrevError]);
}
