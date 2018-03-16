import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';

import treeherder from '../js/treeherder';
import { getBugUrl } from '../helpers/urlHelper';
import { thEvents } from "../js/constants";

function RelatedBugSaved(props) {
  const { deleteBug, bug } = props;
  const bug_id = bug.bug_id;

  return (
    <span className="btn-group pinboard-related-bugs-btn">
      <a
        className="btn btn-xs annotations-bug related-bugs-link"
        href={getBugUrl(bug_id)}
        target="_blank"
        rel="noopener"
        title={`View bug ${bug_id}`}
      >
        <em>{bug_id}</em>
      </a>
      <span
        className="btn classification-delete-icon hover-warning btn-xs pinned-job-close-btn annotations-bug"
        onClick={() => deleteBug(bug)}
        title={`Delete relation to bug ${bug_id}`}
      >
        <i className="fa fa-times-circle" />
      </span>
    </span>
  );
}

RelatedBugSaved.propTypes = {
  deleteBug: PropTypes.func.isRequired,
  bug: PropTypes.object.isRequired,
};

function RelatedBug(props) {
  const { bugs, deleteBug } = props;

  return (
    <span>
      <p className="annotations-bug-header font-weight-bold">Bugs</p>
      <ul className="annotations-bug-list">
        {bugs.map(bug => (
          <li key={bug.bug_id}>
            <RelatedBugSaved
              bug={bug}
              deleteBug={deleteBug}
            />
          </li>))}
      </ul>
    </span>
  );
}

RelatedBug.propTypes = {
  deleteBug: PropTypes.func.isRequired,
  bugs: PropTypes.array.isRequired,
};

function TableRow(props) {
  const { deleteClassification, classification, classificationTypes, dateFilter } = props;
  const { created, who, name, text } = classification;
  const deleteEvent = () => { deleteClassification(classification); };
  const failureId = classification.failure_classification_id;
  const iconClass = failureId === 7 ? "fa-star-o" : "fa fa-star";
  const classificationName = classificationTypes.classifications[failureId];

  return (
    <tr>
      <td>{dateFilter(created, 'EEE MMM d, H:mm:ss')}</td>
      <td>{who}</td>
      <td>
        {/* TODO: the classification label & star has been used in the job_details_pane.jxs
            so it should probably be made its own component when we start using import */}
        <span title={name}>
          <i className={`fa ${iconClass}`} />
          <span className="ml-1">{classificationName.name}</span>
        </span>
      </td>
      <td>{text}</td>
      <td>
        <span
          onClick={deleteEvent}
          className="classification-delete-icon hover-warning pointable"
          title="Delete this classification"
        >
          <i className="fa fa-times-circle" />
        </span>
      </td>
    </tr>
  );
}

TableRow.propTypes = {
  deleteClassification: PropTypes.func.isRequired,
  classification: PropTypes.object.isRequired,
  classificationTypes: PropTypes.object.isRequired,
  dateFilter: PropTypes.func.isRequired,
};

function AnnotationsTable(props) {
  const {
    classifications, deleteClassification, classificationTypes, dateFilter
  } = props;

  return (
    <table className="table-super-condensed table-hover">
      <thead>
        <tr>
          <th>Classified</th>
          <th>Author</th>
          <th>Classification</th>
          <th>Comment</th>
        </tr>
      </thead>
      <tbody>
        {classifications.map(classification => (
          <TableRow
            key={classification.id}
            dateFilter={dateFilter}
            classification={classification}
            deleteClassification={deleteClassification}
            classificationTypes={classificationTypes}
          />))
        }
      </tbody>
    </table>
  );
}

AnnotationsTable.propTypes = {
  deleteClassification: PropTypes.func.isRequired,
  classifications: PropTypes.array.isRequired,
  classificationTypes: PropTypes.object.isRequired,
  dateFilter: PropTypes.func.isRequired,
};

export default class AnnotationsTab extends React.Component {
  constructor(props) {
    super(props);

    const { $injector } = props;
    this.$rootScope = $injector.get('$rootScope');
    this.thNotify = $injector.get('thNotify');
    this.ThResultSetStore = $injector.get('ThResultSetStore');

    this.deleteBug = this.deleteBug.bind(this);
    this.deleteClassification = this.deleteClassification.bind(this);
  }

  componentDidMount() {
    const { classifications, bugs } = this.props;

    this.$rootScope.$on(thEvents.deleteClassification, () => {
      if (classifications[0]) {
        this.deleteClassification(classifications[0]);
        // Delete any number of bugs if they exist
        bugs.forEach((bug) => { this.deleteBug(bug); });
      } else {
        this.thNotify.send("No classification on this job to delete", 'warning');
      }
    });
  }

  deleteClassification(classification) {
    const jobMap = this.ThResultSetStore.getJobMap();
    const job = jobMap[`${classification.job_id}`].job_obj;

    job.failure_classification_id = 1;
    this.ThResultSetStore.updateUnclassifiedFailureMap(job);

    classification.delete().then(
      () => {
        this.thNotify.send("Classification successfully deleted", "success");
        // also be sure the job object in question gets updated to the latest
        // classification state (in case one was added or removed).
        this.ThResultSetStore.fetchJobs([job.id]);
        this.$rootScope.$emit(
          thEvents.jobsClassified,
          { jobs: { [job.id]: job } }
        );
      },
      () => {
        this.thNotify.send(
          "Classification deletion failed",
          "danger",
          { sticky: true }
        );
      });
  }

  deleteBug(bug) {
    const { selectedJob } = this.props;

    bug.delete()
      .then(() => {
        this.thNotify.send(
            `Association to bug ${bug.bug_id} successfully deleted`,
            "success"
          );
        this.$rootScope.$emit(
            thEvents.bugsAssociated,
            { jobs: { [selectedJob.id]: selectedJob } }
          );
      }, () => {
        this.thNotify.send(
            `Association to bug ${bug.bug_id} deletion failed`,
            "danger",
            { sticky: true }
          );
      }
      );
  }

  render() {
    const {
      $injector, classifications, classificationTypes,
      bugs
    } = this.props;
    const dateFilter = $injector.get('$filter')('date');

    return (
      <div className="container-fluid">
        <div className="row h-100">
          <div className="col-sm-10 classifications-pane job-tabs-content">
            {classifications.length ?
              <AnnotationsTable
                classifications={classifications}
                dateFilter={dateFilter}
                deleteClassification={this.deleteClassification}
                classificationTypes={classificationTypes}
              /> :
              <p>This job has not been classified</p>
            }
          </div>

          {!!classifications.length && !!bugs.length &&
          <div className="col-sm-2 bug-list-pane">
            <RelatedBug
              bugs={bugs}
              deleteBug={this.deleteBug}
            />
          </div>}
        </div>
      </div>
    );
  }
}

AnnotationsTab.propTypes = {
  $injector: PropTypes.object.isRequired,
  classificationTypes: PropTypes.object.isRequired,
  classifications: PropTypes.array,
  bugs: PropTypes.array,
  selectedJob: PropTypes.object,
};

AnnotationsTab.defaultProps = {
  classifications: [],
  bugs: [],
  selectedJob: null,
};

treeherder.component('annotationsTab', react2angular(
  AnnotationsTab,
  ['classificationTypes', 'classifications', 'bugs', 'selectedJob'],
  ['$injector']));
