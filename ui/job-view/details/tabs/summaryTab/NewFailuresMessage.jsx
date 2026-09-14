import PropTypes from 'prop-types';
import { Button } from 'react-bootstrap';

// The banner heading a failure list that has new failure lines, worded as the
// Failure Summary tab worded it. The first new line carries the "NEW" button.
const NewFailuresMessage = ({ count }) =>
  count > 0 ? (
    <Button
      className="failure-summary-new-message border-0"
      title="New Test Failure"
    >
      {count} new failure line(s). First one is flagged, it might be good to
      look at all failures in this job.
    </Button>
  ) : null;

NewFailuresMessage.propTypes = {
  count: PropTypes.number.isRequired,
};

export default NewFailuresMessage;
