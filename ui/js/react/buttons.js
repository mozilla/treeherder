'use strict';
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": ".*Factory$" }] */

var jobCountComponent = (props) => {
    var classes = [ props.className, 'btn', 'group-btn', 'btn-xs', 'job-group-count', 'filter-shown'];
    return React.DOM.button(
        {
            className: classes.join(' '),
            title: props.title,
            onClick: props.onClick,
            key: props.key
        },
        props.count
    );
};
jobCountComponent.propsTypes = {
    count: React.PropTypes.number.isRequired,
    classes: React.PropTypes.array.isRequired,
    title: React.PropTypes.string.isRequired,
    onClick: React.PropTypes.func.isRequired,
    key: React.PropTypes.number
};

class JobButtonComponent extends React.Component {
    constructor(props) {
        super(props);
        this.$rootScope = this.props.$injector.get('$rootScope');
        this.thEvents = this.props.$injector.get('thEvents');
        this.thResultStatusInfo = this.props.$injector.get('thResultStatusInfo');
        this.thResultStatus = this.props.$injector.get('thResultStatus');
        this.ThResultSetStore = this.props.$injector.get('ThResultSetStore');
        this.thUrl = this.props.$injector.get('thUrl');
        var status = this.thResultStatus(this.props.job);

        this.state = {
            selected: this.props.job.id === this.$rootScope.selectedJob,
            runnable: (status === 'runnable')
        };

        this.onMouseDown = this.onMouseDown.bind(this);
        this.changeJobSelection = this.changeJobSelection.bind(this);

        if (!this.props.hasGroup) {
            this.$rootScope.$on(
                this.thEvents.changeSelection, this.changeJobSelection
            );
        }
    }
    componentWillMount() {
        // Modify styles in response to currently selected job id
        this.unbindSelectionWatch = this.$rootScope.$watch('selectedJob', () => {
            if (this.$rootScope.selectedJob &&
               (this.$rootScope.selectedJob.id === this.props.job.id)) {
                this.setState({ selected: true });
            } else {
                this.setState({ selected: false });
            }
        });
    }
    componentWillUnmount() {
        this.unbindSelectionWatch();
    }
    changeJobSelection(e, direction) {
        if (e.targetScope.selectedJob.id === this.props.job.id) {
            this.context.selectJobFromAdjacentGroup(direction, this);
        }
    }
    handleJobClick() {
        this.context.selectJob(this.props.job);
    }
    handleLogViewerClick() {
        // Open logviewer in a new window
        this.props.$injector.get('ThJobModel').get(
            this.$rootScope.repoName,
            this.props.job.id
        ).then((data) => {
            if (data.logs.length > 0) {
                window.open(location.origin + '/' +
                    this.thUrl.getLogViewerUrl(this.props.job.id));
            }
        });
    }
    handleRunnableClick() {
        this.ThResultSetStore.toggeleSelectedRunnableJob(
            this.$rootScope.repoName,
            this.context.resultsetId,
            this.props.job.ref_data_name
        );
        this.setState({ selected: !this.state.selected });
    }
    onMouseDown(ev) {
        if (ev.button === 1) { // Middle click
            this.handleLogViewerClick();
        } else if (this.state.runnable) {
            this.handleRunnableClick();
        } else {
            this.handleJobClick();
        }
    }
    render() {
        if (!this.props.job.visible) return null;
        var status = this.thResultStatus(this.props.job);
        var statusInfo = this.thResultStatusInfo(status, this.props.job.failure_classification_id);
        var title = `${this.props.job.job_type_name} - ${status}`;

        if (this.props.job.state === 'completed') {
            var duration = Math.round((this.props.job.end_timestamp - this.props.job.start_timestamp) / 60);
            title += ` (${duration} mins)`;
        }

        var key = `key${this.props.job.id}`;
        var classes = ['btn', key, statusInfo.btnClass];

        if (this.state.runnable) {
            classes.push('runnable-job-btn', 'runnable');
        } else {
            classes.push('job-btn');
        }

        if (this.state.selected) {
            classes.push(this.state.runnable ? 'runnable-job-btn-selected' : 'selected-job');
            classes.push('btn-lg-xform');
        } else {
            classes.push('btn-xs');
        }

        if (this.props.job.visible) classes.push('filter-shown');

        var attributes = {
            onMouseDown: this.onMouseDown,
            className: classes.join(' '),
            'data-jmkey': key,
            'data-ignore-job-clear-on-click': true,
            title
        };
        if (status === 'runnable') {
            attributes['data-buildername'] = this.props.job.ref_data_name;
        }
        return React.DOM.button(
            attributes,
            this.props.job.job_type_symbol
        );
    }
}
JobButtonComponent.propTypes = {
    $injector: React.PropTypes.object.isRequired,
    job: React.PropTypes.object.isRequired,
    hasGroup: React.PropTypes.bool.isRequired
};
JobButtonComponent.contextTypes = {
    platform: React.PropTypes.object,
    selectJob: React.PropTypes.func.isRequired,
    selectJobFromAdjacentGroup: React.PropTypes.func.isRequired,
    resultsetId: React.PropTypes.number.isRequired
};
var jobButtonComponentFactory = React.createFactory(JobButtonComponent);

