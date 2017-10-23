'use strict';

class JobDetailsPane extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        // const dateFilter = this.props.$injector.get('$filter')('date');
        return <span>
            {/* {this.props.classifications.length > 0 || this.props.bugs.length > 0 ?
            <ul className="list-unstyled content-spacer">
                {this.props.classifications.length > 0 ? <li>
                    <span th-failure-classification failure-id="classifications[0].failure_classification_id"
                    job-result="job.result"></span>
                    <a target="_blank" ng-repeat="bug in bugs"
                    href="{this.props.getBugUrl(this.props.bugs.bug_id)}"
                    title={`View bug ${this.props.bugs[0].bug_id}`}><em> {this.props.bugs.bug_id}</em></a>
                </li> : <li></li>}
                {this.props.classifications[0].text.length > 0 ? <li><em {this.props.classifications[0].text|linkifyURLs|linkifyClassifications:repoName"></em></li> : <li></li>}
                <li className="revision-comment">
                    {dateFilter(this.props.classifications[0].created)}</li>
                    <li className="revision-comment">
                    {this.props.classifications[0].who}
                </li>
            </ul> : <ul></ul>} */}
            <ul className="list-unstyled">
                <li id="result-status-pane" className={`small ${this.props.resultStatusShading}`}>
                    <div>
                        <label>Result:</label>
                        <span> {this.props.result}</span>
                    </div>
                    <div>
                        <label>State:</label>
                        <span> {this.props.jobState}</span>
                    </div>
                    {this.props.jobState === 'running' ? <div>
                        {this.props.eta > 0 ? <span>Time remaining: ~{this.props.eta} minutes</span> : <span></span>}
                        {this.props.eta < 0 ? <span>{this.props.eta_abs} mins overdue, typically takes ~{this.props.average_duration} mins</span> : <span></span>}
                        {this.props.eta === 0 ? <span>Due any minute now, typically takes ~{this.props.average_duration} mins</span> : <span></span>}
                    </div> : <div></div>}
                    {this.props.jobState === 'pending' ? <div>
                        <span>Typically takes ~{this.props.average_duration} mins once started</span>
                    </div> : <div></div>}
                </li>
            </ul>
        </span>;
    }
}

JobDetailsPane.propTypes = {
    classifications: React.PropTypes.array.isRequired,
    bugs: React.PropTypes.array.isRequired,
    getBugUrl: React.PropTypes.func.isRequired,
    result: React.PropTypes.string.isRequired,
    jobState: React.PropTypes.string.isRequired,
    resultStatusShading: React.PropTypes.string.isRequired,
    $injector: React.PropTypes.object.isRequired
};

module.exports = {
    JobDetailsPane
};

// treeherder.value('JobDetailsPane', JobDetailsPane);
treeherder.directive('jobDetailsPane', ['reactDirective', '$injector', (reactDirective, $injector) =>
reactDirective(JobDetailsPane, undefined, {}, { $injector })]);

