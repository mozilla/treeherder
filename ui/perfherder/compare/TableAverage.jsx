import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from 'reactstrap';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { replicatesMaxLength } from '../perf-helpers/constants';
import { displayNumber, formatNumber } from '../perf-helpers/helpers';

import TooltipGraph from './TooltipGraph';

const TableAverage = ({ value, stddev, stddevpct, replicates, app }) => {
  let tooltipText;
  if (replicates.length > 1) {
    let replicatesStr = replicates
      .map((value) => formatNumber(value))
      .join(' ');

    if (replicatesStr.length > replicatesMaxLength) {
      tooltipText = (
        <>
          {`Runs: < ${replicatesStr.slice(
            0,
            Math.floor(replicatesMaxLength / 2),
          )}`}
          ...
          {`${replicatesStr.slice(
            replicatesStr.length - Math.floor(replicatesMaxLength / 2),
          )} > `}
          {`${formatNumber(displayNumber(stddev))} = ${formatNumber(
            displayNumber(stddevpct),
          )}% `}
          standard deviation
          <br />
          (use JSON download button to see more)
        </>
      );
    } else {
      tooltipText = (
        <>
          {`Runs: < ${replicatesStr} > ${formatNumber(
            displayNumber(stddev),
          )} = ${formatNumber(displayNumber(stddevpct))}% standard deviation`}
        </>
      );
    }
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
        <React.Fragment>
          <SimpleTooltip
            textClass="detail-hint"
            text={
              replicates.length === 1
                ? formatNumber(displayNumber(value))
                : `${formatNumber(
                    displayNumber(value),
                  )} ${'\u00B1'} ${formatNumber(displayNumber(stddevpct))}`
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
            innerClassName={
              replicates.length > 1 ? 'compare-table-tooltip' : ''
            }
          />
        </React.Fragment>
      ) : (
        <span className="text-muted">No results</span>
      )}
      {app && (
        <p className="d-flex align-items-start m-0">
          <Badge color="light">{app}</Badge>
        </p>
      )}
    </td>
  );
};

TableAverage.propTypes = {
  value: PropTypes.number,
  stddev: PropTypes.number,
  stddevpct: PropTypes.number,
  replicates: PropTypes.arrayOf(PropTypes.number),
};

TableAverage.defaultProps = {
  value: PropTypes.null,
  stddev: PropTypes.null,
  stddevpct: PropTypes.null,
  replicates: [],
};

export default TableAverage;
