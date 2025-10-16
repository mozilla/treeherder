import React from 'react';

import { getCrashViewerUrl, getPerfAnalysisUrl } from './url';

/**
 * Helper to insert a link into a log line by replacing text
 * @param {string} line - The full log line
 * @param {string} textToReplace - The text to turn into a link
 * @param {string} key - React key for the link element
 * @param {string} href - The URL for the link
 * @param {string} title - The title/tooltip for the link
 * @param {string|React.Element} linkText - The text to display in the link (defaults to textToReplace)
 * @param {Function} onLinkClick - Optional click handler
 * @returns {Array} - [before, link, after]
 */
function insertLink(
  line,
  textToReplace,
  key,
  href,
  title,
  linkText,
  onLinkClick,
) {
  const [before, after] = line.split(textToReplace);
  return [
    before,
    <a
      key={key}
      className="log-line-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title}
      onClick={onLinkClick}
    >
      {linkText || textToReplace}
    </a>,
    after,
  ];
}

/**
 * Formats a log line by detecting patterns and adding clickable links
 * @param {string} line - The log line text
 * @param {Array} jobDetails - Array of job artifacts
 * @param {Object} job - The job object (optional, needed for profile names)
 * @param {Object} options - Additional options for rendering
 * @param {Function} options.onLinkClick - Optional click handler for links (e.g., to stop propagation)
 * @returns {string|Array} - The original line or an array of strings and React elements
 */
export default function formatLogLineWithLinks(
  line,
  jobDetails,
  job,
  options = {},
) {
  if (!jobDetails || !jobDetails.length) {
    return line;
  }

  // Check for profile uploaded
  const hasProfile = line.match(/profile uploaded in (profile_.*\.js\.json)/);
  if (hasProfile) {
    const artifact = jobDetails.find(
      (artifact) => artifact.value === hasProfile[1],
    );
    if (artifact) {
      return insertLink(
        line,
        hasProfile[0],
        'profile-link',
        getPerfAnalysisUrl(artifact.url, job),
        'open in Firefox Profiler',
        `open ${artifact.value} in the Firefox Profiler`,
        options.onLinkClick,
      );
    }
  }

  // Check for PROCESS-CRASH or INFO crashed process with UUID
  const processCrash = line.match(
    /(?:PROCESS-CRASH|INFO crashed process) \| ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  if (processCrash) {
    const crashId = processCrash[1];
    const crashArtifact = jobDetails.find(
      (artifact) => artifact.value === `${crashId}.json`,
    );
    if (crashArtifact) {
      return insertLink(
        line,
        crashId,
        'crash-link',
        getCrashViewerUrl(crashArtifact.url),
        'open in crash viewer',
        null,
        options.onLinkClick,
      );
    }
  }

  return line;
}
