import PropTypes from 'prop-types';
import { Form } from 'react-bootstrap';

import FilterPill from './FilterPill';

const TIERS = ['1', '2', '3'];
const CLASSIFIED_STATES = ['classified', 'unclassified'];

function TierClassificationSection({ filterModel, classificationTypes }) {
  const { tier = [], classifiedState = [] } = filterModel.urlParams;
  const classificationId =
    filterModel.urlParams.failure_classification_id?.[0] || '';

  const onClassificationChange = (value) => {
    if (value) {
      filterModel.replaceFilter('failure_classification_id', value);
    } else {
      filterModel.removeFilter('failure_classification_id');
    }
  };

  return (
    <div className="filter-panel-section filter-panel-columns">
      <div>
        <div className="filter-panel-label">Tier</div>
        <div className="filter-panel-row">
          {TIERS.map((t) => (
            <FilterPill
              key={t}
              label={t}
              isOn={tier.includes(t)}
              onToggle={() => filterModel.toggleFilter('tier', t)}
              title={`Toggle tier ${t} jobs`}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="filter-panel-label">Classified state</div>
        <div className="filter-panel-row">
          {CLASSIFIED_STATES.map((state) => (
            <FilterPill
              key={state}
              label={state}
              isOn={classifiedState.includes(state)}
              onToggle={() => filterModel.toggleClassifiedFilter(state)}
            />
          ))}
        </div>
      </div>
      <div className="filter-panel-grow">
        <div className="filter-panel-label">Failure classification</div>
        <Form.Select
          size="sm"
          aria-label="Failure classification"
          value={classificationId}
          onChange={(evt) => onClassificationChange(evt.target.value)}
        >
          <option value="">any</option>
          {classificationTypes.map((type) => (
            <option value={type.id} key={type.id}>
              {type.name}
            </option>
          ))}
        </Form.Select>
      </div>
    </div>
  );
}

TierClassificationSection.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
  classificationTypes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default TierClassificationSection;
