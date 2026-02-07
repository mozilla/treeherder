
import PropTypes from 'prop-types';

export default function ErrorsList(props) {
  const errorListItem = props.errors.map((error) => (
    <li key={error.line_number}>
      {error.line}
      <a
        title="Open in Log Viewer"
        target="_blank"
        rel="noopener noreferrer"
        href={error.logViewerUrl}
      >
        <span className="ms-1">View log</span>
      </a>
    </li>
  ));

  return (
    <li>
      No Bug Suggestions Available.
      <br />
      <span className="font-weight-bold">Failure Lines</span>
      <ul>{errorListItem}</ul>
    </li>
  );
}

ErrorsList.propTypes = {
  errors: PropTypes.arrayOf({
    line: PropTypes.string.isRequired,
    lineNumber: PropTypes.number.isRequired,
  }).isRequired,
};
