'use strict';

const JobDetailsListItem = props => (
    <li className="small">
        <label>{props.category} </label>
        <a title={props.title1}
            href={props.href1}
            onClick={props.filterText(props.value1)}>
            {props.text1}<span className="fa fa-pencil-square-o icon-superscript"></span></a>
        <label>: </label>
        {/* <a title={props.title2}
            href={props.href2}
            prevent-default-on-left-click={true}
            onClick={props.filter(props.href2)}
            copy-value={this.props.text2}>
            {props.text2}</a> */}
    </li>
);
// Need to figure out how to translate Angular-bootstrap directives to just bootstrap
// copy-value={props.value1}
// prevent-default-on-left-click

//     categoryLabel: "Job",
//     title1: "Filter jobs with this unique SHA signature",
//     href1: this.props.jobSearchSignatureHref,
//     filter: this.props.filterByJobSearchStr,
//     value1: this.props.jobSearchSignature,
//     text1: "(sig)",
//     title2: "Filter jobs containing these keywords",
//     href2: this.props.jobSearchStrHref,
//     text2: this.props.jobSearchStr,
//     value2: React.PropTypes.string.isRequired


JobDetailsListItem.propTypes = {
    category: React.PropTypes.string.isRequired,
    filterText: React.PropTypes.func.isRequired,
    title1: React.PropTypes.string.isRequired,
    title2: React.PropTypes.string.isRequired,
    heading1: React.PropTypes.string.isRequired,
    heading2: React.PropTypes.string.isRequired,
    href1: React.PropTypes.string.isRequired,
    href2: React.PropTypes.string.isRequired,
    value1: React.PropTypes.string.isRequired,
};

const SimpleJobDetailsListItem = props => (
    <li className="small">
        <label>{props.label}</label><span> {props.text}</span>
    </li>
);


SimpleJobDetailsListItem.propTypes = {
    label: React.PropTypes.string.isRequired,
    text: React.PropTypes.string.isRequired,
};


class JobDetailsPane extends React.Component {
    constructor(props) {
        super(props);
    }
    render() {
        // const dateFilter = this.props.$injector.get('$filter')('date');
        console.log(this.props.job_log_urls);
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
            <ul className="content-spacer list-unstyled">
                <JobDetailsListItem category="Job"
                    title1="Filter jobs with this unique SHA signature"
                    href1={this.props.jobSearchSignatureHref}
                    filterText={this.props.filterByJobSearchStr}
                    value1={this.props.jobSearchSignature}
                    text1="(sig)"
                    title2="Filter jobs containing these keywords"
                    href2={this.props.jobSearchStrHref}
                    text2={this.props.jobSearchStr}
                />
                {/* requestTime is undefined until response returns */}
                <SimpleJobDetailsListItem label="Requested: " text={this.props.visibleTimeFields.requestTime}/>
                {this.props.visibleTimeFields.startTime ? <SimpleJobDetailsListItem label="Started: " text={this.props.visibleTimeFields.startTime}/>
                : <span></span>}
                {this.props.visibleTimeFields.endTime ? <SimpleJobDetailsListItem label="Ended: " text={this.props.visibleTimeFields.endTime}/>
                : <span></span>}
                <SimpleJobDetailsListItem label="Duration: " text={this.props.visibleTimeFields.duration}/>
                {/* Is the job_log_urls undefined b/c response hasn't returned yet? */}
                {this.props.job_log_urls === undefined ? <SimpleJobDetailsListItem label="Log parsing status: " text="No logs"/>:
                <SimpleJobDetailsListItem label="Log parsing status: " text={this.props.job_log_urls.parse_status}/>}
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
    $injector: React.PropTypes.object.isRequired,
    jobSearchSignatureHref: React.PropTypes.string.isRequired,
    jobSearchSignature: React.PropTypes.string.isRequired,
    filterByJobSearchStr: React.PropTypes.func.isRequired,
    jobSearchStrHref: React.PropTypes.string.isRequired,
    jobSearchStr: React.PropTypes.string.isRequired,
    visibleTimeFields: React.PropTypes.object.isRequired,
    job_log_urls: React.PropTypes.array.isRequired
};

module.exports = {
    JobDetailsPane,
    JobDetailsListItem,
    SimpleJobDetailsListItem
};

// treeherder.value('JobDetailsPane', JobDetailsPane);
treeherder.directive('jobDetailsPane', ['reactDirective', '$injector', (reactDirective, $injector) =>
reactDirective(JobDetailsPane, undefined, {}, { $injector })]);

