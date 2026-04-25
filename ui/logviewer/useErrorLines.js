import { useState, useEffect } from 'react';

import { errorLinesCss } from '../helpers/display';
import { getData } from '../helpers/http';
import { getProjectJobUrl } from '../helpers/location';
import { textLogErrorsEndpoint } from '../helpers/url';

/**
 * Fetches text-log errors for a job and applies their CSS marker styles.
 * Returns the parsed errors and the first error's line number (for default scroll).
 */
export function useErrorLines(jobId) {
  const [errors, setErrors] = useState([]);
  const [firstErrorLine, setFirstErrorLine] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    getData(getProjectJobUrl(textLogErrorsEndpoint, jobId)).then(
      ({ data, failureStatus }) => {
        if (cancelled || failureStatus || !data.length) return;

        const parsed = data.map((error) => ({
          line: error.line,
          lineNumber: error.line_number + 1,
        }));

        errorLinesCss(parsed);
        setErrors(parsed);
        setFirstErrorLine(parsed[0].lineNumber);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  return { errors, firstErrorLine };
}
