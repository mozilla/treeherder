import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router';

import { getAllUrlParams, setUrlParams } from '../../../helpers/location';

import { DATE_RANGE_PRESETS } from './constants';
import { getDateDaysAgo, isValidDateRange } from './helpers';

function PushRangeSection() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = getAllUrlParams(location);

  const [startdate, setStartdate] = useState(params.get('startdate') || '');
  const [enddate, setEnddate] = useState(params.get('enddate') || '');
  const [author, setAuthor] = useState(params.get('author') || '');
  const [revision, setRevision] = useState(params.get('revision') || '');

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
          onChange={(evt) => setAuthor(evt.target.value)}
        />
        <Form.Control
          size="sm"
          type="text"
          placeholder="revision (hash)"
          aria-label="Revision"
          value={revision}
          onChange={(evt) => setRevision(evt.target.value)}
        />
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
