import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

class PerfData extends React.PureComponent {
  render() {
    const { perfJobDetail = [], selectedJobFull } = this.props;

    const sortedDetails = perfJobDetail.slice();

    // These styles are shared across all of the table cells.
    const cellClassName = 'nowrap ps-2 pe-2';

    return (
      <>
        <h3 className="font-size-16 mt-3 mb-2">
          Results for: {selectedJobFull.job_type_name}
        </h3>
        <table className="table table-sm performance-panel-data">
          <thead>
            <tr>
              <th scope="col" className={`text-right ${cellClassName}`}>
                Value
              </th>
              <th scope="col" className={cellClassName}>
                Unit
              </th>
              <th scope="col" className={cellClassName}>
                Better
              </th>
              <th scope="col" className={cellClassName}>
                History
              </th>
              <th scope="col" className={cellClassName}>
                Name
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDetails.map(
              (
                {
                  value,
                  url,
                  measurementUnit,
                  lowerIsBetter,
                  title,
                  suite,
                  perfdocs,
                },
                idx,
              ) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={idx}>
                  {/* Ensure the value and measurement are visually next to each
                  other in the chart, by aligning the value to the right. */}
                  <td className={`text-right ${cellClassName}`}>{value}</td>
                  <td className={cellClassName}>{measurementUnit || '–'}</td>
                  <td className={cellClassName}>
                    {lowerIsBetter ? 'Lower' : 'Higher'}
                  </td>
                  <td className={cellClassName}>
                    <a
                      href={url}
                      className="btn btn-outline-darker-secondary btn-sm performance-panel-view-button"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View
                    </a>
                  </td>
                  <td className="w-100">
                    {perfdocs.hasDocumentation() ? (
                      <div>
                        <a
                          href={perfdocs.documentationURL}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {`${suite} `}
                        </a>
                        {`${perfdocs.remainingName}`}
                      </div>
                    ) : (
                      title
                    )}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </>
    );
  }
}

PerfData.propTypes = {
  perfJobDetail: PropTypes.arrayOf(PropTypes.shape({})),
};

const mapStateToProps = (state) => ({
  decisionTaskMap: state.pushes.decisionTaskMap,
});

export default connect(mapStateToProps)(PerfData);
