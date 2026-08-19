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
    <Dropdown className="me-0 text-nowrap">
      <Dropdown.Toggle
        variant="secondary"
        aria-label="Highlight Options Dropdown"
      >
        Highlight
      </Dropdown.Toggle>

      <Dropdown.Menu className="overflow-auto dropdown-menu-height">
        {highlightOptions.map(({ key, label, isChecked }) => (
          <Dropdown.Item
            key={key}
            as="button"
            className="d-flex align-items-center"
            onClick={() => updateStateParams({ [key]: !isChecked })}
            role="menuitemcheckbox"
            aria-checked={isChecked}
          >
            <span
              className="border border-secondary rounded me-2 d-flex align-items-center justify-content-center"
              style={{ width: '18px', height: '18px' }}
              aria-hidden="true"
            >
              {isChecked && (
                <FontAwesomeIcon
                  icon={faCheck}
                  style={{ fontSize: '12px' }}
                />
              )}
            </span>
            {label}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export default HighlightOptionsDropdown;
