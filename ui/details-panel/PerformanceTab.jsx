import PropTypes from 'prop-types';
import { react2angular } from "react2angular/index.es2015";

import treeherder from '../js/treeherder';
import PerfSeriesModel from '../models/PerfSeriesModel';

class PerformanceTab extends React.Component {

  static getDerivedStateFromProps(nextProps) {
    if (nextProps.job) {
      return { canFetchPerfData: true };
    }
    return { canFetchPerfData: false };
  }

  constructor(props) {
    super(props);

    this.state = {
      perfSeriesModel: new PerfSeriesModel(),
      canFetchPerfData: false,
    };
  }

  async componentDidMount() {
    const { repoName, job } = this.props;
    const { perfSeriesModel, canFetchPerfData } = this.state;

    if (!canFetchPerfData) {
      console.log("can't fetch data");
      return null;
    }

    const seriesData = await perfSeriesModel.getSeriesData(repoName, { job_id: job.id });
    const performanceData = _.flatten(Object.values(seriesData));
    console.log("series and perf", seriesData, performanceData);

    if (performanceData) {
      await this.fetchPerfJobDetail(performanceData);
    }

  }

  async fetchPerfJobDetail(performanceData) {
    const { tabService, repoName, job } = this.props;
    const { perfSeriesModel } = this.state;
    console.log("we have performanceData");
    const signatureIds = _.uniq(_.map(performanceData, 'signature_id'));
    const seriesListList = await Promise.all(_.chunk(signatureIds, 20).map(
        signatureIdChunk => perfSeriesModel.getSeriesList(repoName, { id: signatureIdChunk })
    ));

    console.log("promises are done");
    const seriesList = _.flatten(seriesListList);
    const perfJobDetail = performanceData.map(d => ({
        series: seriesList.find(s => d.signature_id === s.id),
        ...d
    })).filter(d => !d.series.parentSignature).map(d => ({
        url: `/perf.html#/graphs?series=${[repoName, d.signature_id, 1, d.series.frameworkId]}&selected=${[repoName, d.signature_id, job.result_set_id, d.id]}`,
        value: d.value,
        title: d.series.name
    }));
    console.log("perfJobDetail set now", perfJobDetail);
    tabService.tabs.perfDetails.enabled = true;
    this.setState({ perfJobDetail });

  }

  render() {
    const { repoName, revision } = this.props;
    const { perfJobDetail } = this.state;
    console.log("render perfJobDetail", perfJobDetail, this.props.job);
    const sortedDetails = perfJobDetail ? perfJobDetail.slice() : [];
    sortedDetails.sort((a, b) => a.title.localeCompare(b.title));

    return (
      <div className="performance-panel">
        {!!sortedDetails.length && <ul>
          <li>Perfherder:
            {sortedDetails.map((detail, idx) => (
              <ul
                key={idx} // eslint-disable-line react/no-array-index-key
              >
                <li>{detail.title}:
                  <a href={detail.url}>{detail.value}</a>
                </li>
              </ul>
            ))}
          </li>
        </ul>}
        <ul>
          <li>
            <a
              href={`perf.html#/comparechooser?newProject=${repoName}&newRevision=${revision}`}
              target="_blank"
              rel="noopener"
            >Compare result against another revision</a>
          </li>
        </ul>
      </div>
    );
  }
}

PerformanceTab.propTypes = {
  // tabService: PropTypes.object.isRequired,
  repoName: PropTypes.string.isRequired,
  revision: PropTypes.string,
  job: PropTypes.object,
};

PerformanceTab.defaultProps = {
  revision: '',
  job: null,
};

treeherder.component('performanceTab', react2angular(
  PerformanceTab,
  ['tabService', 'repoName', 'revision', 'job', 'perfJobDetail']));
