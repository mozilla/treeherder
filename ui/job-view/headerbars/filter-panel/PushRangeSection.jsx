import { useEffect, useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { useLocation, useNavigate } from 'react-router';

import { getAllUrlParams, setUrlParams } from '../../../helpers/location';
import { usePushesStore } from '../../../shared/stores/pushesStore';
import PushModel from '../../../models/push';

import { DATE_RANGE_PRESETS, PUSH_SUGGESTIONS_DAYS } from './constants';
import {
  getDateDaysAgo,
  getPushSuggestions,
  isValidDateRange,
} from './helpers';

// One lazy fetch of recent pushes per repo per session, shared across
// panel opens; suggestions are best-effort enrichment only.
const pushSuggestionsCache = {};

function PushRangeSection() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = getAllUrlParams(location);
  const repoName = params.get('repo');

  const urlStartdate = params.get('startdate') || '';
  const urlEnddate = params.get('enddate') || '';
  const urlAuthor = params.get('author') || '';
  const urlRevision = params.get('revision') || '';

  const [startdate, setStartdate] = useState(urlStartdate);
  const [enddate, setEnddate] = useState(urlEnddate);
  const [author, setAuthor] = useState(urlAuthor);
  const [revision, setRevision] = useState(urlRevision);

  const isDirty =
    startdate !== urlStartdate ||
    enddate !== urlEnddate ||
    author !== urlAuthor ||
    revision !== urlRevision;

  const pushList = usePushesStore((state) => state.pushList);
  const [fetchedPushes, setFetchedPushes] = useState(
    () => pushSuggestionsCache[repoName] || [],
  );

  useEffect(() => {
    if (!repoName || pushSuggestionsCache[repoName]) {
      return undefined;
    }
    let cancelled = false;

    PushModel.getList({
      repo: repoName,
      startdate: getDateDaysAgo(PUSH_SUGGESTIONS_DAYS),
    })
      .then(({ data, failureStatus }) => {
        if (!failureStatus && data.results) {
          pushSuggestionsCache[repoName] = data.results;
          if (!cancelled) {
            setFetchedPushes(data.results);
          }
        }
      })
      .catch(() => {
        // Suggestions are a best-effort enhancement; typing still works
        // without them, so network failures are deliberately ignored.
      });
    return () => {
      cancelled = true;
    };
  }, [repoName]);

  const { authors, revisions } = useMemo(
    () => getPushSuggestions([...pushList, ...fetchedPushes]),
    [pushList, fetchedPushes],
  );

  const validRange = isValidDateRange(startdate, enddate);

  const applyRange = () => {
    const queryParams = setUrlParams([
      ['startdate', startdate || null],
      ['enddate', enddate || null],
      ['author', author || null],
      ['revision', revision || null],
    ]);

    navigate({ search: queryParams });
  };

  const applyDatePreset = (days) => {
    setStartdate(getDateDaysAgo(days));
    setEnddate('');
  };

  return (
    <div className="filter-panel-section" data-testid="push-range-section">
      <div className="filter-panel-label">Push range</div>
      <div className="filter-panel-row">
        <span className="filter-panel-hint">Quick:</span>
        {DATE_RANGE_PRESETS.map(({ label, days }) => (
          <Button
            key={label}
            size="sm"
            variant="outline-secondary"
            title={`Show pushes from the ${label}`}
            onClick={() => applyDatePreset(days)}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="filter-panel-row filter-panel-dates">
        <Form.Control
          size="sm"
          type="date"
          aria-label="Start date"
          value={startdate}
          onChange={(evt) => setStartdate(evt.target.value)}
        />
        <span aria-hidden="true">→</span>
        <Form.Control
          size="sm"
          type="date"
          aria-label="End date"
          value={enddate}
          onChange={(evt) => setEnddate(evt.target.value)}
        />
      </div>
      <div className="filter-panel-row">
        <span className="filter-panel-input-wrap">
          <Form.Control
            size="sm"
            type="text"
            placeholder="author (email)"
            aria-label="Author"
            value={author}
            list="push-author-suggestions"
            onChange={(evt) => setAuthor(evt.target.value)}
          />
          {author && (
            <button
              type="button"
              className="filter-panel-input-clear"
              aria-label="Clear author"
              title="Clear author"
              onClick={() => setAuthor('')}
            >
              <FontAwesomeIcon icon={faTimesCircle} />
            </button>
          )}
          <datalist id="push-author-suggestions">
            {authors.map((value) => (
              <option value={value} key={value} />
            ))}
          </datalist>
        </span>
        <span className="filter-panel-input-wrap">
          <Form.Control
            size="sm"
            type="text"
            placeholder="revision (hash)"
            aria-label="Revision"
            value={revision}
            list="push-revision-suggestions"
            onChange={(evt) => setRevision(evt.target.value)}
          />
          {revision && (
            <button
              type="button"
              className="filter-panel-input-clear"
              aria-label="Clear revision"
              title="Clear revision"
              onClick={() => setRevision('')}
            >
              <FontAwesomeIcon icon={faTimesCircle} />
            </button>
          )}
          <datalist id="push-revision-suggestions">
            {revisions.map((value) => (
              <option value={value} key={value} />
            ))}
          </datalist>
        </span>
      </div>
      <div className="filter-panel-row filter-panel-apply-row">
        {isDirty && (
          <span className="filter-panel-hint fw-bold">
            STAGED — takes effect on Apply (reloads pushes)
          </span>
        )}
        <Button
          size="sm"
          variant="primary"
          className="push-range-apply"
          onClick={applyRange}
          disabled={!validRange || !isDirty}
        >
          Apply
        </Button>
      </div>
      {!validRange && (
        <div className="filter-panel-error">start date must not be after end date</div>
      )}
    </div>
  );
}

export default PushRangeSection;
