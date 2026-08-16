import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button, CloseButton, Overlay, Popover } from 'react-bootstrap';

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
  const popoverRef = useRef(null);
  const wasOpen = useRef(isOpen);

  // Enter anywhere in the panel applies the staged push range, if it is
  // dirty (the Apply button's disabled state encodes dirty + valid).
  // Controls with their own Enter semantics stopPropagation, and a focused
  // button's Enter should only click that button.
  const onPanelKeyDown = (evt) => {
    if (evt.key !== 'Enter' || evt.target.tagName === 'BUTTON') {
      return;
    }
    // currentTarget is the popover element itself; Overlay overrides the
    // child ref it clones, so popoverRef cannot be relied on here.
    const applyButton = evt.currentTarget.querySelector('.push-range-apply');

    if (applyButton && !applyButton.disabled) {
      applyButton.click();
    }
  };

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      // Panel just opened - move focus into it. Overlay overrides the
      // child ref it clones, so look the element up by id instead.
      const panel =
        popoverRef.current || document.getElementById('advanced-filter-panel');

      if (panel) {
        panel.focus();
      }
    } else if (!isOpen && wasOpen.current) {
      // Panel just closed - restore focus to the trigger.
      if (target.current) {
        target.current.focus();
      }
    }
    wasOpen.current = isOpen;
  }, [isOpen, target]);

  return (
    <Overlay
      target={target.current}
      show={isOpen}
      placement="bottom-end"
      rootClose
      onHide={onClose}
    >
      <Popover
        id="advanced-filter-panel"
        className="advanced-filter-panel"
        ref={popoverRef}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
      >
        <Popover.Header className="advanced-filter-panel-header">
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
        </Popover.Header>
        <Popover.Body className="advanced-filter-panel-body">
          <PushRangeSection />
          <FieldFilterSection filterModel={filterModel} />
          <TierClassificationSection
            filterModel={filterModel}
            classificationTypes={classificationTypes}
          />
          <PresetsSection filterModel={filterModel} />
          <StatusSection filterModel={filterModel} />
        </Popover.Body>
      </Popover>
    </Overlay>
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
