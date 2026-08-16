import PropTypes from 'prop-types';

function FilterPill({ label, isOn, onToggle, title }) {
  return (
    <button
      type="button"
      className={`filter-pill ${isOn ? 'filter-pill-on' : ''}`}
      role="checkbox"
      aria-checked={isOn}
      title={title || `Toggle ${label}`}
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
};

FilterPill.defaultProps = {
  title: null,
};

export default FilterPill;
