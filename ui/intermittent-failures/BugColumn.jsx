import React from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

import { getBugUrl } from '../helpers/url';

// we're passing the mainview location object to bugdetails because using history.goBack()
// in bugdetailsview to navigate back to mainview displays this console warning:
// "Hash history go(n) causes a full page reload in this browser"

function BugColumn({
  tree,
  startday,
  endday,
  data,
  location,
  graphData,
  tableData,
  updateAppState,
}) {
  const { id, summary } = data;
  return (
    <div>
      <a
        className="ml-1"
        target="_blank"
        rel="noopener noreferrer"
        href={getBugUrl(id)}
      >
        {id}
      </a>
      &nbsp;
      <Link
        className="ml-1 small-text bug-details"
        onClick={() => updateAppState({ graphData, tableData })}
        to={{
          pathname: '/bugdetails',
          search: `?startday=${startday}&endday=${endday}&tree=${tree}&bug=${id}`,
          state: { startday, endday, tree, id, summary, location },
        }}
      >
        details
      </Link>
    </div>
  );
}

BugColumn.propTypes = {
  data: PropTypes.shape({
    id: PropTypes.number.isRequired,
    summary: PropTypes.string.isRequired,
  }).isRequired,
  startday: PropTypes.string.isRequired,
  endday: PropTypes.string.isRequired,
  tree: PropTypes.string.isRequired,
  location: PropTypes.shape({}),
  graphData: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.shape({})),
    PropTypes.shape({}),
  ]),
  tableData: PropTypes.arrayOf(PropTypes.shape({})),
  updateAppState: PropTypes.func.isRequired,
};

BugColumn.defaultProps = {
  location: null,
  graphData: null,
  tableData: null,
};

export default BugColumn;
