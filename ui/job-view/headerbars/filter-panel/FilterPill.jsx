import PropTypes from 'prop-types';

function FilterPill({ label, isOn, onToggle, title, status }) {
  return (
    <button
      type="button"
      className={`filter-pill ${isOn ? 'filter-pill-on' : ''}`}
      role="checkbox"
      aria-checked={isOn}
      aria-label={title || `Toggle ${label}`}
      title={title || `Toggle ${label}`}
      data-status={status || undefined}
      onClick={onToggle}
    >
      {label}
    </button>
  );
}

FilterPill.propTypes = {
  label: PropTypes.string.isRequired,
  isOn: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  title: PropTypes.string,
  status: PropTypes.string,
};

FilterPill.defaultProps = {
  title: null,
  status: null,
};

export default FilterPill;
