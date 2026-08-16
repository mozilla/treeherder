import { useEffect, useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
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

  const [startdate, setStartdate] = useState(params.get('startdate') || '');
  const [enddate, setEnddate] = useState(params.get('enddate') || '');
  const [author, setAuthor] = useState(params.get('author') || '');
  const [revision, setRevision] = useState(params.get('revision') || '');

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
      <div className="filter-panel-label">
        Push range
        <span className="filter-panel-hint">
          staged — takes effect on Apply (reloads pushes)
        </span>
      </div>
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
        <Form.Control
          size="sm"
          type="text"
          placeholder="author (email)"
          aria-label="Author"
          value={author}
          list="push-author-suggestions"
          onChange={(evt) => setAuthor(evt.target.value)}
        />
        <datalist id="push-author-suggestions">
          {authors.map((value) => (
            <option value={value} key={value} />
          ))}
        </datalist>
        <Form.Control
          size="sm"
          type="text"
          placeholder="revision (hash)"
          aria-label="Revision"
          value={revision}
          list="push-revision-suggestions"
          onChange={(evt) => setRevision(evt.target.value)}
        />
        <datalist id="push-revision-suggestions">
          {revisions.map((value) => (
            <option value={value} key={value} />
          ))}
        </datalist>
        <Button size="sm" variant="primary" onClick={applyRange} disabled={!validRange}>
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
