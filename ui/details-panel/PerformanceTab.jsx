import PropTypes from 'prop-types';
import { react2angular } from "react2angular/index.es2015";

import treeherder from '../js/treeherder';
import PerfSeriesModel from '../models/PerfSeriesModel';

class PerformanceTab extends React.Component {
  constructor(props) {
    super(props);

    this.perfSeriesModel = new PerfSeriesModel();
  }

  async componentDidMount() {
    const { tabService, repoName, job } = this.props;
    const seriesData = await this.perfSeriesModel.getSeriesData(
        repoName, { job_id: job.id });

    const performanceData = _.flatten(Object.values(seriesData));
    if (performanceData) {
        const signatureIds = _.uniq(_.map(performanceData, 'signature_id'));
        Promise.all(_.chunk(signatureIds, 20).map(
            signatureIdChunk => this.perfSeriesModel.getSeriesList(repoName, { id: signatureIdChunk })
        )).then((seriesListList) => {
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
            this.setState({ perfJobDetail });
            tabService.tabs.perfDetails.enabled = true;
        });
    }

  }

  render() {
    const { repoName, revision, perfJobDetail } = this.props;
    console.log("perfJobDetail", perfJobDetail);
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
  tabService: PropTypes.func.isRequired,
  repoName: PropTypes.string.isRequired,
  revision: PropTypes.string,
  job: PropTypes.object,
  perfJobDetail: PropTypes.array,
};

PerformanceTab.defaultProps = {
  revision: '',
  perfJobDetail: null,
  job: null,
};

treeherder.component('performanceTab', react2angular(
  PerformanceTab,
  ['tabService', 'repoName', 'revision', 'job', 'perfJobDetail']));
