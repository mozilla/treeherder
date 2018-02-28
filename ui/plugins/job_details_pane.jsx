import PropTypes from 'prop-types';
import { getBugUrl, getSlaveHealthUrl, getInspectTaskUrl, getWorkerExplorerUrl } from '../helpers/urlHelper';

import treeherder from '../js/treeherder';

// using ES6 arrow function syntax throws an error for this particular component
function ClassificationsPane(props) {

    const filterClassificationsText = (text) => {
        const url = props.linkifyURLsFilter(text);
        return props.linkifyClassificationsFilter(url, props.repoName);
    };

    const repoURLHTML = { __html: filterClassificationsText(props.classifications[0].text) };

    const failureId = props.classifications[0].failure_classification_id;
    let iconClass = (failureId === 7 ?
        "fa-star-o" : "fa fa-star") + " star-" + props.job.result;

    const classificationName = props.classificationTypes.classifications[failureId];

    return (
        <ul className="list-unstyled content-spacer">
            <li>
                <span title={classificationName.name}><i className={`fa ${iconClass}`} />
                <span className="ml-1">{classificationName.name}</span></span>
                {props.bugs.length > 0 &&
                <a target="_blank" rel="noopener" href={getBugUrl(props.bugs[0].bug_id)}
                title={`View bug ${props.bugs[0].bug_id}`}
                ><em> {props.bugs[0].bug_id}</em></a>}
            </li>
            {props.classifications[0].text.length > 0 &&
            <li><em dangerouslySetInnerHTML={repoURLHTML} /></li>}
            <li className="revision-comment">
                {props.dateFilter(props.classifications[0].created, 'EEE MMM d, H:mm:ss')}</li>
                <li className="revision-comment">
                {props.classifications[0].who}
            </li>
        </ul>
    );
}


const JobStatusPane = props => (
    <ul className="list-unstyled">
        <li id="result-status-pane" className={`small ${props.resultStatusShading}`}>
            <div>
                <label>Result:</label>
                <span> {props.job.result}</span>
            </div>
            <div>
                <label>State:</label>
                <span> {props.job.state}</span>
            </div>
        </li>
    </ul>
);


const JobDetailsListItem = props => (
    <li className="small">
        <label>{props.label}</label>
        {props.labelHref &&
        <a title={props.labelTitle}
           href={props.labelHref}
           onClick={props.labelOnclick}
           target={props.labelTarget}
           rel="noopener"
        >
           {props.labelText} <span className="fa fa-pencil-square-o icon-superscript" />: </a>}
        {!props.href ? <span className="ml-1">{props.text}</span> :
        <a title={props.title}
           className="ml-1"
           href={props.href}
           onClick={props.onclick}
           target={props.target}
           rel="noopener"
        >
           {props.text}</a>}
           {props.iconClass && <span className={`ml-1${props.iconClass}`} />}
    </li>
);


class JobDetailsList extends React.Component {
    constructor(props) {
        super(props);

        this.filterTextEvent = this.filterTextEvent.bind(this);

        this.state = {
            machineUrl: ''
        };
    }

    componentWillReceiveProps(nextProps) {
        if (_.isEmpty(nextProps.job)) {
            return;
        }

        this.setJobMachineUrl(nextProps);
    }

    async setJobMachineUrl(props) {
        let machineUrl = null;

        try {
            machineUrl = await this.getJobMachineUrl(props);
        } catch (err) {
            machineUrl = '';
        }

        if (this.state.machineUrl !== machineUrl) {
          this.setState({ machineUrl });
        }
    }

    getJobMachineUrl(props) {
        const { build_system_type, machine_name } = props.job;
        const machineUrl = (machine_name !== 'unknown' && build_system_type === 'buildbot') ?
            getSlaveHealthUrl(machine_name) :
            getWorkerExplorerUrl(props.job.taskcluster_metadata.task_id);

        return machineUrl;
    }

    filterTextEvent(event, input) {
        event.preventDefault();
        this.props.filterByJobSearchStr(input);
    }

    render() {
        const job = this.props.job;
        const jobLogUrls = this.props.jobLogUrls;
        const jobMachineName = job.machine_name;
        let buildUrl = null;
        let iconCircleClass = null;

        if (job.build_system_type === 'buildbot' && jobLogUrls.length > 0) {
            buildUrl = jobLogUrls[0].buildUrl;
        }
        if (job.job_type_description) {
            iconCircleClass = "fa fa-info-circle";
        }
        return (
            <ul className="list-unstyled content-spacer">
                <JobDetailsListItem
                                label="Job"
                                labelTitle="Filter jobs with this unique SHA signature"
                                labelHref={this.props.jobSearchSignatureHref}
                                labelOnclick={event => this.filterTextEvent(event, this.props.jobSearchSignature)}
                                labelText="(sig)"
                                title="Filter jobs containing these keywords"
                                href={this.props.jobSearchStrHref}
                                onclick={event => this.filterTextEvent(event, this.props.jobSearchStr)}
                                text={this.props.jobSearchStr}
                />

                {jobMachineName &&
                <JobDetailsListItem
                                label="Machine: "
                                text={jobMachineName}
                                title="Inspect machine"
                                target="_blank"
                                href={this.state.machineUrl}
                />}

                {this.props.job.taskcluster_metadata &&
                <JobDetailsListItem
                                label="Task:" text={this.props.job.taskcluster_metadata.task_id}
                                href={getInspectTaskUrl(this.props.job.taskcluster_metadata.task_id)} target="_blank"
                />}

                {this.props.visibleFields &&
                Object.keys(this.props.visibleFields).map(keyName =>
                    (<JobDetailsListItem
                                    key={keyName}
                                    label={`${keyName}:`}
                                    title="Open build directory in a new tab"
                                    href={buildUrl}
                                    target="_blank"
                                    text={this.props.visibleFields[keyName]}
                                    iconClass={iconCircleClass}
                    />))}

                {this.props.visibleTimeFields && <span>
                <JobDetailsListItem label="Requested:" text={this.props.visibleTimeFields.requestTime} />

                {this.props.visibleTimeFields.startTime &&
                <JobDetailsListItem label="Started:" text={this.props.visibleTimeFields.startTime} />}

                {this.props.visibleTimeFields.endTime &&
                <JobDetailsListItem label="Ended:" text={this.props.visibleTimeFields.endTime} />}

                <JobDetailsListItem label="Duration:" text={this.props.visibleTimeFields.duration} />
                </span>}

                {!this.props.jobLogUrls ? <JobDetailsListItem label="Log parsing status: " text="No logs" /> :
                this.props.jobLogUrls.map(data =>
                    <JobDetailsListItem label="Log parsing status: " text={data.parse_status} key={data} />)}
            </ul>
        );
    }
}


class JobDetailsPane extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            classifications: [],
            bugs: []
        };
    }

    componentWillReceiveProps(nextProps) {
        this.updateState(nextProps.classifications, { classifications: nextProps.classifications });
        this.updateState(nextProps.bugs, { bugs: nextProps.bugs });
    }

    updateState(propsReceived, stateChanges) {
        if (propsReceived) {
            this.setState(stateChanges);
        }
    }

    render() {
        const dateFilter = this.props.$injector.get('$filter')('date');
        const linkifyURLsFilter = this.props.$injector.get('$filter')('linkifyURLs');
        const linkifyClassificationsFilter = this.props.$injector.get('$filter')('linkifyClassifications');

        return (
            <div>
                {this.props.jobDetailLoading &&
                <div className="overlay">
                    <div>
                        <span className="fa fa-spinner fa-pulse th-spinner-lg" />
                    </div>
                </div>}

                {this.state.classifications.length > 0 &&
                <ClassificationsPane
                    job={this.props.job}
                    classifications={this.state.classifications}
                    bugs={this.state.bugs}
                    dateFilter={dateFilter}
                    linkifyURLsFilter={linkifyURLsFilter}
                    linkifyClassificationsFilter={linkifyClassificationsFilter}
                    classificationTypes={this.props.classificationTypes}
                    repoName={this.props.repoName}
                />}

                <JobStatusPane job={this.props.job} resultStatusShading={this.props.resultStatusShading} />

                <JobDetailsList
                    job={this.props.job}
                    jobSearchSignatureHref={this.props.jobSearchSignatureHref}
                    jobSearchSignature={this.props.jobSearchSignature}
                    filterByJobSearchStr={this.props.filterByJobSearchStr}
                    jobSearchStrHref={this.props.jobSearchStrHref}
                    jobSearchStr={this.props.jobSearchStr}
                    visibleTimeFields={this.props.visibleTimeFields}
                    jobLogUrls={this.props.jobLogUrls}
                    visibleFields={this.props.visibleFields}
                    buildUrl={this.props.buildUrl}
                />
            </div>
        );
    }
}

JobDetailsPane.propTypes = {
    classifications: PropTypes.array,
    bugs: PropTypes.array,
    job: PropTypes.object,
    resultStatusShading: PropTypes.string,
    $injector: PropTypes.object,
    jobSearchSignatureHref: PropTypes.string,
    jobSearchSignature: PropTypes.string,
    filterByJobSearchStr: PropTypes.func,
    jobSearchStrHref: PropTypes.string,
    jobSearchStr: PropTypes.string,
    visibleTimeFields: PropTypes.object,
    jobLogUrls: PropTypes.array,
    visibleFields: PropTypes.object,
    buildUrl: PropTypes.string,
    classificationTypes: PropTypes.object,
    jobDetailLoading: PropTypes.bool,
    repoName: PropTypes.string
};

treeherder.directive('jobDetailsPane', ['reactDirective', '$injector', (reactDirective, $injector) =>
reactDirective(JobDetailsPane, undefined, {}, { $injector })]);
