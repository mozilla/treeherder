import PropTypes from 'prop-types';

const RelatedBugSaved = (props) => {

    const deleteBugEvent = () => {
        props.deleteBug(props.bug);
    };

    return (
        <span className="btn-group pinboard-related-bugs-btn">
            <a className="btn btn-xs annotations-bug related-bugs-link"
               href={props.getBugUrl(props.bug.bug_id)}
               target="_blank"
               rel="noopener"
               title={`View bug ${props.bug.bug_id}`}
            >
            <em>{props.bug.bug_id}</em>
            </a>
            <span className="btn classification-delete-icon hover-warning btn-xs pinned-job-close-btn annotations-bug"
                  onClick={deleteBugEvent}
                  title={`Delete relation to bug ${props.bug.bug_id}`}
            >
            <i className="fa fa-times-circle" />
            </span>
      </span>
    );
};


const RelatedBug = props => (
    <span>
        <p className="annotations-bug-header font-weight-bold">Bugs</p>
        <ul className="annotations-bug-list">
            {props.bugs.map((bug, index) =>
            (<li key={index} >
                <RelatedBugSaved bug={bug} getBugUrl={props.getBugUrl} deleteBug={props.deleteBug} />
            </li>))}
        </ul>
    </span>
);


function TableRow(props) {

    const deleteEvent = () => {
        props.deleteClassification(props.classification);
    };

    const failureId = props.classification.failure_classification_id;
    let iconClass = failureId === 7 ? "fa-star-o" : "fa fa-star";
    const classificationName = props.classificationTypes.classifications[failureId];

    return (
        <tr>
            <td>
                {props.dateFilter(props.classification.created, 'EEE MMM d, H:mm:ss')}
            </td>
            <td>
                {props.classification.who}
            </td>
            <td>
                {/* TODO: the classification label & star has been used in the job_details_pane.jxs
                 so it should probably be made its own component when we start using import */}
                <span title={classificationName.name}><i className={`fa ${iconClass}`} />
                <span className="ml-1">{classificationName.name}</span></span>
            </td>
            <td>
                {props.classification.text}
            </td>
            <td>
                <span onClick={deleteEvent}
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
    return (
        <table className="table-super-condensed table-hover">
            <thead>
                <tr><th>Classified</th><th>Author</th><th>Classification</th><th>Comment</th></tr>
            </thead>
            <tbody>
                {props.classifications.map((classification, index) =>
                    (<TableRow
                            key={index} dateFilter={props.dateFilter} classification={classification}
                            deleteClassification={props.deleteClassification}
                            classificationTypes={props.classificationTypes}
                    />))}
            </tbody>
        </table>
    );
}


export default class AnnotationsTab extends React.Component {
    render() {
        const dateFilter = this.props.$injector.get('$filter')('date');

        return (
            <div className="row h-100">
                <div className="col-sm-10 classifications-pane job-tabs-content">
                    {this.props.classifications && this.props.classifications.length > 0 ?
                    <AnnotationsTable
                                    classifications={this.props.classifications} dateFilter={dateFilter}
                                    deleteClassification={this.props.deleteClassification}
                                    classificationTypes={this.props.classificationTypes}
                    /> :
                    <p>This job has not been classified</p>}
                </div>

                {this.props.classifications && this.props.classifications.length > 0 && this.props.bugs &&
                <div className="col-sm-2 bug-list-pane">
                    <RelatedBug
                            bugs={this.props.bugs} getBugUrl={this.props.getBugUrl}
                            deleteBug={this.props.deleteBug}
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
