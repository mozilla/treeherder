import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import {
  faStar as faStarSolid,
  faTimesCircle,
} from '@fortawesome/free-solid-svg-icons';

import { thEvents } from '../../../helpers/constants';
import { getBugUrl } from '../../../helpers/url';
import { longDateFormat } from '../../../helpers/display';
import { notify } from '../../redux/stores/notifications';
import { recalculateUnclassifiedCounts } from '../../redux/stores/pushes';

function RelatedBugSaved(props) {
  const { deleteBug, bug } = props;

  return (
    <span className="btn-group pinboard-related-bugs-btn">
      {!bug.bug_id && (
        <span className="btn btn-xs">
          <em>i{bug.bug_internal_id}</em>
        </span>
      )}
      {bug.bug_id && (
        <a
          className="btn btn-xs annotations-bug related-bugs-link"
          href={getBugUrl(bug.bug_id)}
          target="_blank"
          rel="noopener noreferrer"
          title={`View bug ${bug.bug_id}`}
        >
          <em>{bug.bug_id}</em>
        </a>
      )}
      <Button
        color="link"
        size="xs"
        className="classification-delete-icon hover-warning pinned-job-close-btn annotations-bug"
        onClick={() => deleteBug(bug)}
        title={`Delete relation to bug ${bug.bug_internal_id ?? bug.bug_id}`}
      >
        <FontAwesomeIcon icon={faTimesCircle} title="Delete" />
      </Button>
    </span>
  );
}

RelatedBugSaved.propTypes = {
  deleteBug: PropTypes.func.isRequired,
  bug: PropTypes.shape({}).isRequired,
};

function RelatedBug(props) {
  const { bugs, deleteBug } = props;

  return (
    <span>
      <p className="annotations-bug-header font-weight-bold">Bugs</p>
      <ul className="annotations-bug-list">
        {bugs.map((bug) => (
          <li key={bug.internal_id}>
            <RelatedBugSaved bug={bug} deleteBug={() => deleteBug(bug)} />
          </li>
        ))}
      </ul>
    </span>
  );
}

RelatedBug.propTypes = {
  deleteBug: PropTypes.func.isRequired,
  bugs: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

function TableRow(props) {
  const { deleteClassification, classification, classificationMap } = props;
  const { created, who, name, text } = classification;
  const deleteEvent = () => {
    deleteClassification(classification);
  };
  const failureId = classification.failure_classification_id;
  const icon = failureId === 7 ? faStarRegular : faStarSolid;
  const classificationName = classificationMap[failureId];

  return (
    <tr>
      <td>{new Date(created).toLocaleString('en-US', longDateFormat)}</td>
      <td>{who}</td>
      <td>
        {/* TODO: the classification label & star has been used in the job_details_pane.jxs
            so it should probably be made its own component when we start using import */}
        <span title={name}>
          <FontAwesomeIcon
            icon={icon}
            title={failureId === 7 ? 'Auto classified' : 'Classified'}
          />
          <span className="ml-1">{classificationName.name}</span>
        </span>
      </td>
      <td>{text}</td>
      <td>
        <Button
          color="link"
          onClick={deleteEvent}
          className="classification-delete-icon hover-warning pointable"
          title="Delete this classification"
        >
          <FontAwesomeIcon icon={faTimesCircle} title="Delete classification" />
        </Button>
      </td>
    </tr>
  );
}

TableRow.propTypes = {
  deleteClassification: PropTypes.func.isRequired,
  classification: PropTypes.shape({}).isRequired,
  classificationMap: PropTypes.shape({}).isRequired,
};

function AnnotationsTable(props) {
  const { classifications, deleteClassification, classificationMap } = props;

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
        {classifications.map((classification) => (
          <TableRow
            key={classification.id}
            classification={classification}
            deleteClassification={deleteClassification}
            classificationMap={classificationMap}
          />
        ))}
      </tbody>
    </table>
  );
}

AnnotationsTable.propTypes = {
  deleteClassification: PropTypes.func.isRequired,
  classifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  classificationMap: PropTypes.shape({}).isRequired,
};

class AnnotationsTab extends React.Component {
  componentDidMount() {
    window.addEventListener(
      thEvents.deleteClassification,
      this.onDeleteClassification,
    );
  }

  componentWillUnmount() {
    window.removeEventListener(
      thEvents.deleteClassification,
      this.onDeleteClassification,
    );
  }

  onDeleteClassification = () => {
    const { classifications, bugs, notify } = this.props;

    if (classifications.length) {
      this.deleteClassification(classifications[0]);
      // Delete any number of bugs if they exist
      bugs.forEach((bug) => {
        this.deleteBug(bug);
      });
    } else {
      notify('No classification on this job to delete', 'warning');
    }
  };

  deleteClassification = async (classification) => {
    const {
      selectedJobFull,
      recalculateUnclassifiedCounts,
      notify,
    } = this.props;

    selectedJobFull.failure_classification_id = 1;
    recalculateUnclassifiedCounts();

    const { failureStatus } = await classification.destroy();

    if (!failureStatus) {
      notify('Classification successfully deleted', 'success');
      // also be sure the job object in question gets updated to the latest
      // classification state (in case one was added or removed).
      window.dispatchEvent(new CustomEvent(thEvents.classificationChanged));
    } else {
      notify('Classification deletion failed', 'danger', { sticky: true });
    }
  };

  deleteBug = async (bug) => {
    const { notify } = this.props;
    const { failureStatus } = await bug.destroy();

    if (!failureStatus) {
      notify(
        `Association to bug ${
          bug.bug_id ?? bug.bug_internal_id
        } successfully deleted`,
        'success',
      );
      window.dispatchEvent(new CustomEvent(thEvents.classificationChanged));
    } else {
      notify(
        `Association to bug ${
          bug.bug_id ?? bug.bug_internal_id
        } deletion failed`,
        'danger',
        {
          sticky: true,
        },
      );
    }
  };

  render() {
    const { classifications, classificationMap, bugs } = this.props;

    return (
      <div className="container-fluid" role="region" aria-label="Annotations">
        <div className="row h-100">
          <div className="col-sm-10 classifications-pane">
            {classifications.length ? (
              <AnnotationsTable
                classifications={classifications}
                deleteClassification={this.deleteClassification}
                classificationMap={classificationMap}
              />
            ) : (
              <p>This job has not been classified</p>
            )}
          </div>

          {!!classifications.length && !!bugs.length && (
            <div className="col-sm-2 bug-list-pane">
              <RelatedBug bugs={bugs} deleteBug={this.deleteBug} />
            </div>
          )}
        </div>
      </div>
    );
  }
}

AnnotationsTab.propTypes = {
  classificationMap: PropTypes.shape({}).isRequired,
  bugs: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  classifications: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  recalculateUnclassifiedCounts: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
  selectedJobFull: PropTypes.shape({}).isRequired,
};

export default connect(null, { notify, recalculateUnclassifiedCounts })(
  AnnotationsTab,
);
