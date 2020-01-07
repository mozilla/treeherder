import React from 'react';
import PropTypes from 'prop-types';
import {
  VictoryChart,
  VictoryBar,
  VictoryLegend,
  VictoryTooltip,
} from 'victory';

import { errorMessageClass } from '../../helpers/constants';
import ErrorBoundary from '../../shared/ErrorBoundary';
import PerfSeriesModel from '../../models/perfSeries';
import { getData } from '../../helpers/http';
import { createApiUrl, perfSummaryEndpoint } from '../../helpers/url';
import { noDataFoundMessage } from '../constants';
import LoadingSpinner from '../../shared/LoadingSpinner';

export default class ReplicatesGraph extends React.Component {
  // TODO: sync parent with children IRT dataLoading
  constructor(props) {
    super(props);

    this.state = { dataLoading: true };
  }

  async componentDidMount() {
    this.syncGraphData();
  }

  syncGraphData = async () => {
    const { title } = this.props;

    const { replicateData, drawingData } = await this.fetchReplicateGraphData();
    const { replicateDataError } = replicateData;
    const numRuns = drawingData ? drawingData.numRuns : 0;

    return this.setState({
      drawingData,
      graphTitle: this.getGraphTitle(title, numRuns, replicateDataError),
      dataLoading: false,
    });
  };

  getGraphTitle = (title, numRuns, error = false) =>
    !error
      ? `${title} replicates over ${numRuns} run${numRuns > 1 ? 's' : ''}`
      : `${title} replicates`;

  fetchReplicateGraphData = async () => {
    const {
      projectName,
      revision,
      subtestSignature,
      getData,
      getReplicateData,
    } = this.props;
    const replicateData = {};

    const perfDatumResponse = await getData(
      createApiUrl(perfSummaryEndpoint, {
        revision,
        repository: projectName,
        signature: subtestSignature,
      }),
    );
    const perfDatum = perfDatumResponse.data[0];

    if (!perfDatum.values.length) {
      replicateData.replicateDataError = true;
      return { replicateData };
    }
    const numRuns = perfDatum.values.length;
    const replicatePromises = perfDatum.job_ids.map(jobId =>
      getReplicateData({ job_id: jobId }),
    );

    return Promise.all(replicatePromises).then(
      localReplicateData => {
        let replicateValues = localReplicateData.concat.apply(
          [],
          localReplicateData.map(data => {
            const testSuite = data.suites.find(
              suite => suite.name === this.props.filters.testSuite,
            );
            const subtest = testSuite.subtests.find(
              subtest => subtest.name === this.props.filters.subtest,
            );
            return subtest.replicates;
          }),
        );

        replicateValues = replicateValues.map((value, index) => ({
          x: index + 1,
          y: value,
        }));

        return {
          replicateData,
          drawingData: { numRuns, replicateValues },
        };
      },
      () => {
        replicateData.replicateDataError = true;
        return { replicateData };
      },
    );
  };

  render() {
    const { graphTitle, drawingData, dataLoading } = this.state;
    const data =
      drawingData && drawingData.replicateValues
        ? drawingData.replicateValues
        : [];

    return dataLoading ? (
      <LoadingSpinner />
    ) : (
      <ErrorBoundary
        errorClasses={errorMessageClass}
        message="Failed to display replicates graph"
      >
        {data.length > 0 ? (
          <React.Fragment>
            <VictoryChart
              width={1000}
              height={300}
              domainPadding={{ x: 13 }}
              style={{ parent: { maxHeight: '300px' } }}
            >
              <VictoryLegend
                x={375}
                y={0}
                title={graphTitle}
                centerTitle
                orientation="horizontal"
                gutter={20}
                style={{
                  title: {
                    fontSize: 16,
                    fontFamily: 'Helvetica Neue',
                    fontWeight: 'bold',
                  },
                }}
                data={[]}
              />
              <VictoryBar
                name="bar"
                data={data}
                style={{
                  data: { fill: '#17a2b8', width: 25 },
                }}
                labels={({ datum }) =>
                  `replicates: ${datum.x} value: ${datum.y}`
                }
                labelComponent={<VictoryTooltip />}
              />
            </VictoryChart>
          </React.Fragment>
        ) : (
          <p className="lead text-left">{noDataFoundMessage}</p>
        )}
      </ErrorBoundary>
    );
  }
}

ReplicatesGraph.propTypes = {
  title: PropTypes.string.isRequired, // TODO: stands for targetId
  projectName: PropTypes.string.isRequired,
  revision: PropTypes.string.isRequired,
  subtestSignature: PropTypes.string.isRequired,
  filters: PropTypes.shape({
    testSuite: PropTypes.string.isRequired,
    subtest: PropTypes.string.isRequired,
  }).isRequired,
  getData: PropTypes.func,
  getReplicateData: PropTypes.func,
};

ReplicatesGraph.defaultProps = {
  // leverage dependency injection
  // to improve code testability
  getData,
  getReplicateData: PerfSeriesModel.getReplicateData,
};
