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

  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      // Panel just opened - move focus into it.
      if (popoverRef.current) {
        popoverRef.current.focus();
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
      >
        <Popover.Header className="advanced-filter-panel-header">
          <b>Advanced Filters</b>
          <span className="advanced-filter-panel-actions">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => filterModel.clearNonStatusFilters()}
            >
              Clear all
            </Button>
            <CloseButton aria-label="Close filter panel" onClick={onClose} />
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
