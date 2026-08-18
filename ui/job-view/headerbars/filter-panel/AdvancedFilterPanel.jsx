import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button, CloseButton } from 'react-bootstrap';

import StatusSection from './StatusSection';
import TierClassificationSection from './TierClassificationSection';
import FieldFilterSection from './FieldFilterSection';
import PushRangeSection from './PushRangeSection';
import PresetsSection from './PresetsSection';

function AdvancedFilterPanel({
  isOpen,
  onClose,
  target,
  filterModel,
  classificationTypes,
}) {
  const panelRef = useRef(null);
  const wasOpen = useRef(isOpen);

  // Enter anywhere in the panel applies the staged push range, if it is
  // dirty (the Apply button's disabled state encodes dirty + valid).
  // Controls with their own Enter semantics stopPropagation, and a focused
  // button's Enter should only click that button. Escape closes the panel.
  const onPanelKeyDown = (evt) => {
    if (evt.key === 'Escape') {
      evt.stopPropagation();
      onClose();
      return;
    }
    if (evt.key !== 'Enter' || evt.target.tagName === 'BUTTON') {
      return;
    }
    const applyButton = evt.currentTarget.querySelector('.push-range-apply');

    if (applyButton && !applyButton.disabled) {
      applyButton.click();
    }
  };

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      // Panel just opened - move focus into it.
      if (panelRef.current) {
        panelRef.current.focus();
      }
    } else if (!isOpen && wasOpen.current) {
      // Panel just closed - restore focus to the trigger.
      if (target.current) {
        target.current.focus();
      }
    }
    wasOpen.current = isOpen;
  }, [isOpen, target]);

  if (!isOpen) {
    return null;
  }

  return (
    <section
      id="advanced-filter-panel"
      className="advanced-filter-panel"
      aria-label="Advanced filters"
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={onPanelKeyDown}
    >
      <div className="advanced-filter-panel-header">
        <b>Advanced Filters</b>
        <span className="advanced-filter-panel-actions">
          <Button
            size="sm"
            variant="outline-light"
            onClick={() => filterModel.clearNonStatusFilters()}
          >
            Clear all
          </Button>
          <CloseButton
            variant="white"
            aria-label="Close filter panel"
            onClick={onClose}
          />
        </span>
      </div>
      <div className="advanced-filter-panel-body">
        <PushRangeSection />
        <FieldFilterSection filterModel={filterModel} />
        <TierClassificationSection
          filterModel={filterModel}
          classificationTypes={classificationTypes}
        />
        <StatusSection filterModel={filterModel} />
        <PresetsSection filterModel={filterModel} />
      </div>
    </section>
  );
}

AdvancedFilterPanel.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  target: PropTypes.shape({ current: PropTypes.instanceOf(Element) }).isRequired,
  filterModel: PropTypes.shape({}).isRequired,
  classificationTypes: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default AdvancedFilterPanel;
