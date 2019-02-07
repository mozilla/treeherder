import React from 'react';
import PropTypes from 'prop-types';

import SimpleTooltip from '../shared/SimpleTooltip';

import TooltipGraph from './TooltipGraph';
import { displayNumber } from './helpers';

const TableAverage = ({ value, stddev, stddevpct, replicates }) => {
  let tooltipText;
  if (replicates.length > 1) {
    tooltipText = `Runs: < ${replicates.join(' ')} > ${displayNumber(
      stddev,
    )} = ${displayNumber(stddevpct)}% standard deviation)`;
  } else if (replicates.length === 1) {
    tooltipText = 'Only one run (consider more for greater confidence)';
  }

  // we don't want to show the tooltip graph if there's only one value
  // or the sum of all values is 0
  const notZeroSum =
    replicates.length > 1 &&
    replicates.reduce((accumulator, current) => accumulator + current);

  return (
    <td>
      {replicates.length ? (
        <SimpleTooltip
          textClass="detail-hint"
          text={
            replicates.length === 1
              ? displayNumber(value)
              : `${displayNumber(value)} ${'\u00B1'} ${displayNumber(
                  stddevpct,
                )}`
          }
          tooltipText={
            notZeroSum ? (
              <React.Fragment>
                <p className="py-1">{tooltipText}</p>
                <TooltipGraph replicates={replicates} />
              </React.Fragment>
            ) : (
              tooltipText
            )
          }
          tooltipClass={replicates.length > 1 ? 'compare-table-tooltip' : ''}
        />
      ) : (
        <span className="text-muted">No results</span>
      )}
    </td>
  );
};

TableAverage.propTypes = {
  value: PropTypes.number,
  stddev: PropTypes.number,
  stddevpct: PropTypes.number,
  replicates: PropTypes.arrayOf(PropTypes.number).isRequired,
};

TableAverage.defaultProps = {
  value: PropTypes.null,
  stddev: PropTypes.null,
  stddevpct: PropTypes.null,
};

export default TableAverage;
