import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import {
  buildTestSummary,
  buildFailureSuggestions,
  matchBugSuggestions,
} from '../../../../helpers/testSummary';
import { thEvents } from '../../../../helpers/constants';
import { isReftest } from '../../../../helpers/job';
import { getReftestUrl } from '../../../../helpers/url';
import BugFiler from '../../../../shared/BugFiler';
import InternalIssueFiler from '../../../../shared/InternalIssueFiler';
import BugSuggestionsModel from '../../../../models/bugSuggestions';

import SummaryItem from './SummaryItem';

const SummaryTab = ({
  artifactUrl = null,
  selectedJob,
  jobLogUrls = [],
  jobDetails = [],
  logViewerFullUrl = null,
  addBug = null,
  pinJob,
  currentRepo,
}) => {
  const [summary, setSummary] = useState(null);
  const [bugSuggestions, setBugSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isBugFilerOpen, setIsBugFilerOpen] = useState(false);
  const [isInternalIssueFilerOpen, setIsInternalIssueFilerOpen] =
    useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(null);

  useEffect(() => {
    if (!artifactUrl) {
      setSummary(null);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(artifactUrl)
      .then((resp) => {
        if (!resp.ok) {
          throw new Error(`Failed to load summary (${resp.status})`);
        }
        return resp.text();
      })
      .then((text) => {
        if (!cancelled) {
          setSummary(buildTestSummary(text));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [artifactUrl]);

  const jobId = selectedJob?.id;

  useEffect(() => {
    if (!jobId) {
      setBugSuggestions([]);
      return undefined;
    }

    let cancelled = false;
    BugSuggestionsModel.get(jobId)
      .then((data) => {
        if (!cancelled) {
          setBugSuggestions(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBugSuggestions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const suggestions = useMemo(
    () => matchBugSuggestions(buildFailureSuggestions(summary), bugSuggestions),
    [summary, bugSuggestions],
  );

  const fileBug = useCallback(
    (suggestion) => {
      pinJob(selectedJob);
      setActiveSuggestion(suggestion);
      setIsBugFilerOpen(true);
    },
    [pinJob, selectedJob],
  );

  const fileInternalIssue = useCallback(
    (suggestion) => {
      pinJob(selectedJob);
      setActiveSuggestion(suggestion);
      setIsInternalIssueFilerOpen(true);
    },
    [pinJob, selectedJob],
  );

  const bugFilerCallback = async (data) => {
    await addBug({ id: data.id, newBug: data.id });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
    window.open(data.url);
  };

  const internalIssueFilerCallback = async (data) => {
    await addBug({ ...data, newBug: `i${data.internal_id}` });
    window.dispatchEvent(new CustomEvent(thEvents.saveClassification));
  };

  if (isLoading) {
    return (
      <div id="summary-tab" role="region" aria-label="Summary">
        <p className="failure-summary-line-empty mb-0">
          <FontAwesomeIcon icon={faSpinner} pulse className="me-2" />
          Loading summary…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div id="summary-tab" role="region" aria-label="Summary">
        <p className="failure-summary-line-empty text-danger mb-0">{error}</p>
      </div>
    );
  }

  const logs = jobLogUrls.filter(
    (jlu) => !jlu.name.includes('perfherder-data'),
  );

  return (
    <div id="summary-tab" role="region" aria-label="Summary">
      {!!summary && (
        <p className="failure-summary-line-empty mb-0">
          <strong>{summary.counts.total}</strong> tests:{' '}
          <span className="text-success">
            {summary.counts.PASS || 0} passed
          </span>
          {', '}
          <span className="text-danger">{suggestions.length} failed</span>
          {summary.counts.SKIP > 0 && (
            <>
              {', '}
              <span className="text-muted">{summary.counts.SKIP} skipped</span>
            </>
          )}
        </p>
      )}
      <ul className="list-unstyled w-100 h-100 mb-0 overflow-auto text-small font-size-11">
        {suggestions.length === 0 && (
          <li>
            <p className="failure-summary-line-empty mb-0">
              No failures found in the summary.
            </p>
          </li>
        )}
        {suggestions.map((suggestion, index) => (
          <SummaryItem
            key={`${selectedJob.id}-${index}`} // eslint-disable-line react/no-array-index-key
            suggestion={suggestion}
            toggleBugFiler={fileBug}
            toggleInternalIssueFiler={fileInternalIssue}
            selectedJob={selectedJob}
            jobDetails={jobDetails}
            addBug={addBug}
          />
        ))}
      </ul>
      {isBugFilerOpen && (
        <BugFiler
          isOpen={isBugFilerOpen}
          toggle={() => setIsBugFilerOpen(false)}
          suggestion={activeSuggestion}
          suggestions={suggestions}
          fullLog={logs[0]?.url}
          parsedLog={logViewerFullUrl}
          reftestUrl={
            isReftest(selectedJob) && logs[0] ? getReftestUrl(logs[0].url) : ''
          }
          successCallback={bugFilerCallback}
          selectedJob={selectedJob}
          currentRepo={currentRepo}
          platform={selectedJob.platform}
        />
      )}
      {isInternalIssueFilerOpen && (
        <InternalIssueFiler
          isOpen={isInternalIssueFilerOpen}
          suggestion={activeSuggestion}
          toggle={() => setIsInternalIssueFilerOpen(false)}
          jobGroupName={selectedJob.job_group_name}
          jobTypeName={selectedJob.job_type_name}
          successCallback={internalIssueFilerCallback}
        />
      )}
    </div>
  );
};

SummaryTab.propTypes = {
  artifactUrl: PropTypes.string,
  selectedJob: PropTypes.shape({}).isRequired,
  jobLogUrls: PropTypes.arrayOf(PropTypes.shape({})),
  jobDetails: PropTypes.arrayOf(PropTypes.shape({})),
  logViewerFullUrl: PropTypes.string,
  addBug: PropTypes.func,
  pinJob: PropTypes.func.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
};

export default SummaryTab;
