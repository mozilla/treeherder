import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

function FilterCoachMark({ onDismiss }) {
  return (
    <div className="filter-coach-mark" role="status">
      <Button
        size="sm"
        variant="primary"
        className="float-end ms-2"
        onClick={onDismiss}
      >
        Got it
      </Button>
      <b>New: advanced filters.</b> Status, tiers, fields, date ranges and saved
      presets — all in one place.
    </div>
  );
}

FilterCoachMark.propTypes = {
  onDismiss: PropTypes.func.isRequired,
};

export default FilterCoachMark;
