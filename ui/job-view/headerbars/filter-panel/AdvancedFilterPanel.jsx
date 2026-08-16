import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Button, Overlay, Popover } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

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
          <b>Filters</b>
          <span>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => filterModel.clearNonStatusFilters()}
            >
              Clear all
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              aria-label="Close filter panel"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTimes} />
            </Button>
          </span>
        </Popover.Header>
        <Popover.Body className="advanced-filter-panel-body">
          <StatusSection filterModel={filterModel} />
          <TierClassificationSection
            filterModel={filterModel}
            classificationTypes={classificationTypes}
          />
          <FieldFilterSection filterModel={filterModel} />
          <PushRangeSection />
          <PresetsSection filterModel={filterModel} />
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
