import PropTypes from 'prop-types';

const RelatedBugSaved = (props) => {
  const { deleteBug, bug } = props;
  const bug_id = bug.bug_id;

  const deleteBugEvent = () => {
    deleteBug(bug);
  };

  return (
    <span className="btn-group pinboard-related-bugs-btn">
      <a
        className="btn btn-xs annotations-bug related-bugs-link"
        href={props.getBugUrl(bug_id)}
        target="_blank"
        rel="noopener"
        title={`View bug ${bug_id}`}
      >
      <em>{bug_id}</em>
      </a>
      <span
        className="btn classification-delete-icon hover-warning btn-xs pinned-job-close-btn annotations-bug"
        onClick={deleteBugEvent}
        title={`Delete relation to bug ${bug_id}`}
      >
      <i className="fa fa-times-circle" />
      </span>
      </span>
  );
};

const RelatedBug = (props) => {
  const { bugs, getBugUrl, deleteBug } = props;

  return (
    <span>
      <p className="annotations-bug-header font-weight-bold">Bugs</p>
      <ul className="annotations-bug-list">
        {bugs.map((bug, index) => (
          <li key={index}>
            <RelatedBugSaved
              bug={bug}
              getBugUrl={getBugUrl}
              deleteBug={deleteBug}
            />
          </li>))}
      </ul>
    </span>
  );
};

function TableRow(props) {
  const { deleteClassification, classification, classificationTypes } = props;
  const { created, who, name, text } = classification;
  const deleteEvent = () => { deleteClassification(classification); };
  const failureId = classification.failure_classification_id;
  const iconClass = failureId === 7 ? "fa-star-o" : "fa fa-star";
  const classificationName = classificationTypes.classifications[failureId];

  return (
    <tr>
      <td>{props.dateFilter(created, 'EEE MMM d, H:mm:ss')}</td>
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
        {classifications.map((classification, index) => (
          <TableRow
            key={index} dateFilter={dateFilter}
            classification={classification}
            deleteClassification={deleteClassification}
            classificationTypes={classificationTypes}
          />))
        }
      </tbody>
    </table>
  );
}

export default class AnnotationsTab extends React.Component {
  render() {
    const {
      $injector, classifications, deleteClassification, classificationTypes,
      bugs, getBugUrl, deleteBug
    } = this.props;
    const dateFilter = $injector.get('$filter')('date');

    return (
      <div className="row h-100">
        <div className="col-sm-10 classifications-pane job-tabs-content">
          {classifications && classifications.length > 0 ?
            <AnnotationsTable
              classifications={classifications}
              dateFilter={dateFilter}
              deleteClassification={deleteClassification}
              classificationTypes={classificationTypes}
            /> :
            <p>This job has not been classified</p>
          }
        </div>

        {classifications && classifications.length > 0 && bugs &&
        <div className="col-sm-2 bug-list-pane">
          <RelatedBug
            bugs={bugs}
            getBugUrl={getBugUrl}
            deleteBug={deleteBug}
          />
        </div>}
      </div>
    );
  }
}

AnnotationsTab.propTypes = {
  classifications: PropTypes.array,
  deleteClassification: PropTypes.func,
  $injector: PropTypes.object,
  classificationTypes: PropTypes.object,
  getBugUrl: PropTypes.func,
  bugs: PropTypes.array,
  deleteBug: PropTypes.func
};

treeherder.directive('annotationsPanel', ['reactDirective', '$injector', (reactDirective, $injector) =>
  reactDirective(AnnotationsTab, undefined, {}, { $injector })]);
