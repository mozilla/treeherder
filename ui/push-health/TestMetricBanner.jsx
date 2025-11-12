import React from 'react';
import PropTypes from 'prop-types';
import { Button, Spinner } from 'reactstrap';

const TestMetricBanner = ({
  isLimited,
  displayedCount,
  totalFailedJobsInPush,
  onShowAll,
  loading,
}) => {
  if (!isLimited) {
    return null;
  }

  // Determine banner text based on the number of failures displayed
  const getBannerText = () => {
    if (displayedCount === 0) {
      return 'No new failures found';
    }

    // Build the total jobs context message
    const totalJobsText = totalFailedJobsInPush
      ? ` ${totalFailedJobsInPush} task${
          totalFailedJobsInPush === 1 ? '' : 's'
        } total failed in the push.`
      : ' There could also be parent commit failures.';

    if (displayedCount < 50) {
      // Fewer than 50 failures - show actual count
      return `Showing ${displayedCount} NEW failure${
        displayedCount === 1 ? '' : 's'
      }.${totalJobsText}`;
    }

    // Exactly 50 failures - likely more exist
    return `Showing first ${displayedCount} NEW failures (more may exist).${totalJobsText}`;
  };

  return (
    <div className="alert alert-info d-flex justify-content-between align-items-center mb-3">
      <span>{getBannerText()}</span>
      <Button
        color="darker-info"
        size="sm"
        onClick={onShowAll}
        disabled={loading}
        title="Show all failure types (new, intermittent, and fixed) without limit"
      >
        {loading ? <Spinner size="sm" /> : 'Show All Failures'}
      </Button>
    </div>
  );
};

TestMetricBanner.propTypes = {
  isLimited: PropTypes.bool.isRequired,
  displayedCount: PropTypes.number.isRequired,
  totalFailedJobsInPush: PropTypes.number,
  onShowAll: PropTypes.func.isRequired,
  loading: PropTypes.bool,
};

TestMetricBanner.defaultProps = {
  totalFailedJobsInPush: null,
  loading: false,
};

export default TestMetricBanner;
