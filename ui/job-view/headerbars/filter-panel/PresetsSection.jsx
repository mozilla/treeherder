import { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Form } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useLocation } from 'react-router';

import { thDefaultRepo } from '../../../helpers/constants';
import { getAllUrlParams } from '../../../helpers/location';

import {
  buildPresetParams,
  deletePreset,
  getPresetQueryString,
  loadPresets,
  savePreset,
} from './helpers';

function PresetsSection({ filterModel }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [presets, setPresets] = useState(loadPresets);
  const [draftName, setDraftName] = useState('');

  const onSave = () => {
    setPresets(savePreset(draftName.trim(), buildPresetParams(filterModel)));
    setDraftName('');
  };

  const onApply = (preset) => {
    const currentRepo =
      getAllUrlParams({ search: location.search }).get('repo') || thDefaultRepo;
    navigate({ search: getPresetQueryString(preset.params, currentRepo) });
  };

  return (
    <div className="filter-panel-section filter-panel-presets">
      <div className="filter-panel-label">Presets</div>
      <div className="filter-panel-row">
        {presets.map((preset) => (
          <span className="filter-panel-preset" key={preset.name}>
            <Button
              size="sm"
              variant="outline-secondary"
              title={`Apply preset: ${preset.name}`}
              onClick={() => onApply(preset)}
            >
              {preset.name}
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              aria-label={`Delete preset ${preset.name}`}
              title={`Delete preset ${preset.name}`}
              onClick={() => setPresets(deletePreset(preset.name))}
            >
              <FontAwesomeIcon icon={faTimesCircle} />
            </Button>
          </span>
        ))}
        <Form.Control
          size="sm"
          type="text"
          placeholder="preset name"
          aria-label="Preset name"
          value={draftName}
          onChange={(evt) => setDraftName(evt.target.value)}
        />
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={onSave}
          disabled={!draftName.trim()}
        >
          Save current
        </Button>
      </div>
    </div>
  );
}

PresetsSection.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
};

export default PresetsSection;
