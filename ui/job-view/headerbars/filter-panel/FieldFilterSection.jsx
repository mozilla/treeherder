import { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimesCircle } from '@fortawesome/free-solid-svg-icons';

import { getFieldChoices } from '../../../helpers/filter';
import { usePushesStore } from '../../../shared/stores/pushesStore';

import { getFieldValueSuggestions } from './helpers';

// tier and failure_classification_id have dedicated controls in
// TierClassificationSection; everything else in getFieldChoices is fair game.
const getTextFieldChoices = () => {
  const choices = getFieldChoices();

  delete choices.tier;
  delete choices.failure_classification_id;
  return choices;
};

function SuggestionsDatalist({ id, field, jobMap }) {
  return (
    <datalist id={id}>
      {getFieldValueSuggestions(jobMap, field).map((value) => (
        <option value={value} key={value} />
      ))}
    </datalist>
  );
}

SuggestionsDatalist.propTypes = {
  id: PropTypes.string.isRequired,
  field: PropTypes.string.isRequired,
  jobMap: PropTypes.shape({}).isRequired,
};

function FieldFilterSection({ filterModel }) {
  const jobMap = usePushesStore((state) => state.jobMap);
  const [draftField, setDraftField] = useState('');
  const [draftValue, setDraftValue] = useState('');
  const fieldChoices = getTextFieldChoices();

  const activeFieldFilters = Object.keys(fieldChoices).flatMap((field) =>
    (filterModel.urlParams[field] || []).map((value) => ({ field, value })),
  );

  const addDraftFilter = () => {
    if (draftField && draftValue) {
      filterModel.addFilter(draftField, draftValue);
      setDraftValue('');
    }
  };

  const editFilter = (field, oldValue, newValue) => {
    if (newValue !== oldValue) {
      filterModel.removeFilter(field, oldValue);
      if (newValue) {
        filterModel.addFilter(field, newValue);
      }
    }
  };

  return (
    <div className="filter-panel-section" data-testid="field-filter-section">
      <div className="filter-panel-label">Field filters</div>
      {activeFieldFilters.map(({ field, value }) => (
        <div className="filter-panel-row" key={`${field}-${value}`}>
          <span className="filter-panel-field-name">{fieldChoices[field].name}</span>
          <Form.Control
            size="sm"
            defaultValue={value}
            aria-label={`${fieldChoices[field].name} filter value`}
            list={`filter-suggestions-${field}`}
            onBlur={(evt) => editFilter(field, value, evt.target.value.trim())}
            onKeyDown={(evt) => evt.key === 'Enter' && evt.target.blur()}
          />
          <SuggestionsDatalist
            id={`filter-suggestions-${field}`}
            field={field}
            jobMap={jobMap}
          />
          <Button
            size="sm"
            variant="outline-secondary"
            title={`Remove filter: ${field}: ${value}`}
            onClick={() => filterModel.removeFilter(field, value)}
          >
            <FontAwesomeIcon icon={faTimesCircle} />
          </Button>
        </div>
      ))}
      <div className="filter-panel-row">
        <Form.Select
          size="sm"
          aria-label="Field"
          value={draftField}
          onChange={(evt) => setDraftField(evt.target.value)}
        >
          <option value="" disabled>
            select field
          </option>
          {Object.entries(fieldChoices).map(([field, obj]) => (
            <option value={field} key={field}>
              {obj.name}
            </option>
          ))}
        </Form.Select>
        <Form.Control
          size="sm"
          type="text"
          placeholder="enter filter value"
          aria-label="New filter value"
          value={draftValue}
          list="filter-suggestions-draft"
          onChange={(evt) => setDraftValue(evt.target.value)}
          onKeyDown={(evt) => evt.key === 'Enter' && addDraftFilter()}
        />
        {draftField && (
          <SuggestionsDatalist
            id="filter-suggestions-draft"
            field={draftField}
            jobMap={jobMap}
          />
        )}
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={addDraftFilter}
          disabled={!draftField || !draftValue}
        >
          add
        </Button>
      </div>
    </div>
  );
}

FieldFilterSection.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
};

export default FieldFilterSection;
