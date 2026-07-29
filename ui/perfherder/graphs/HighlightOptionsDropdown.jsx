import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

const HighlightOptionsDropdown = ({
  highlightAlerts,
  highlightChangelogData,
  highlightCommonAlerts,
  highlightInitialDataPoints,
  updateStateParams,
}) => {
  const highlightOptions = [
    {
      key: 'highlightAlerts',
      label: 'Highlight alerts',
      isChecked: highlightAlerts,
    },
    {
      key: 'highlightChangelogData',
      label: 'Highlight infra changes',
      isChecked: highlightChangelogData,
    },
    {
      key: 'highlightCommonAlerts',
      label: 'Highlight common alerts',
      isChecked: highlightCommonAlerts,
    },
    {
      key: 'highlightInitialDataPoints',
      label: 'Highlight initial data points',
      isChecked: highlightInitialDataPoints,
    },
  ];

  return (
    <Dropdown
      className="me-0 text-nowrap"
      title="Highlight Options Dropdown"
      aria-label="Highlight Options Dropdown"
    >
      <Dropdown.Toggle variant="secondary">Highlight</Dropdown.Toggle>
      
      <Dropdown.Menu className="overflow-auto dropdown-menu-height">
        {highlightOptions.map(({ key, label, isChecked }) => (
          <Dropdown.Item
            key={key}
            as="button"
            onClick={() => updateStateParams({ [key]: !isChecked })}
          >
            <FontAwesomeIcon
              icon={faCheck}
              className={`me-2 ${isChecked ? '' : 'hide'}`}
              title={isChecked ? 'Selected' : ''}
            />
            {label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default HighlightOptionsDropdown;