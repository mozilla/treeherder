'use strict';
/* global JobButtonComponent, jobButtonComponentFactory, jobCountComponent */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": ".*Factory$" }] */

class JobGroupComponent extends React.Component {
    constructor(props) {
        super(props);
        var $injector = this.props.$injector;
        this.$rootScope = $injector.get('$rootScope');
        this.thEvents = $injector.get('thEvents');
        this.thResultStatus = $injector.get('thResultStatus');
        this.thResultStatusInfo = $injector.get('thResultStatusInfo');

        this.toggleExpanded = this.toggleExpanded.bind(this);
        this.changeJobSelection = this.changeJobSelection.bind(this);
        this.groupButtonsAndCounts = this.groupButtonsAndCounts.bind(this);
        this.selectFirstVisibleJob = this.selectFirstVisibleJob.bind(this);
        this.selectLastVisibleJob = this.selectLastVisibleJob.bind(this);

        var $location = $injector.get('$location');
        var showDuplicateJobs = $location.search().duplicate_jobs === 'visible';
        // The group should be expanded initially if the global group state is expanded
        var expanded = $location.search().group_state === 'expanded';
        // It should also be expanded if the currently selected job is in the group
        // $rootScope.selectedJob will not be set on initial load: attempt to find an ID in the querystring:
        if (!expanded) {
            var selectedJobId = parseInt($location.search().selectedJob);
            if (selectedJobId && _.some(this.props.group.jobs, { id: selectedJobId })) {
                expanded = true;
            }
        }
        this.state = {
            expanded,
            showDuplicateJobs
        };

        // Possible "[tier n]" text
        this.tierEl = null;
        if (this.props.group.tier) {
            this.tierEl = React.DOM.span(
                { className: 'small text-muted' },
                `[tier ${this.props.group.tier}]`
            );
        }

        this.$rootScope.$on(
            this.thEvents.duplicateJobsVisibilityChanged,
            () => {
                this.setState({ showDuplicateJobs: !this.state.showDuplicateJobs });
            }
        );

        this.$rootScope.$on(
            this.thEvents.groupStateChanged,
            (e, newState) => {
                this.setState({ expanded:  newState === 'expanded' });
            }
        );

        this.$rootScope.$on(
            this.thEvents.changeSelection, this.changeJobSelection
        );
    }
    toggleExpanded() {
        this.setState({ expanded: !this.state.expanded });
    }
    changeJobSelection(e, direction) {
        // Ignore job change event if this group has no visible jobs
        if (_.isEmpty(this.refs)) return;
        var selectedButton = _.find(this.refs, (component) =>
            component.props.job.id === e.targetScope.selectedJob.id);
        if (!selectedButton) return;
        var index = selectedButton.props.refOrder;

        if (direction === 'next' && index + 1 < _.size(this.refs)) {
            this.context.selectJob(this.refs[index + 1].props.job);
            return;
        } else if (direction === 'previous' && index !== 0) {
            this.context.selectJob(this.refs[index - 1].props.job);
            return;
        }
        this.context.selectJobFromAdjacentGroup(direction, this);
    }
    selectFirstVisibleJob() {
        var first = this.refs[Object.keys(this.refs)[0]];
        if (first instanceof JobButtonComponent) {
            this.context.selectJob(first.props.job);
        } else {
            this.context.selectJobFromAdjacentGroup('next', this);
        }
    }
    selectLastVisibleJob() {
        var refKeys = Object.keys(this.refs);
        var last = this.refs[refKeys[refKeys.length - 1]];
        if (last instanceof JobButtonComponent) {
            this.context.selectJob(last.props.job);
        } else {
            this.context.selectJobFromAdjacentGroup('previous', this);
        }
    }
    groupButtonsAndCounts() {
        var buttons = [];
        var counts = [];
        var stateCounts = {};
        if (this.state.expanded) {
            // All buttons should be shown when the group is expanded
            buttons = this.props.group.jobs;
        } else {
            var typeSymbolCounts = _.countBy(this.props.group.jobs, "job_type_symbol");
            this.props.group.jobs.map((job) => {
                if (!job.visible) return;
                var status = this.thResultStatus(job);
                var countInfo = this.thResultStatusInfo(status, job.failure_classification_id);
                if (_.contains(['testfailed', 'busted', 'exception'], status) ||
                    (typeSymbolCounts[job.job_type_symbol] > 1 && this.state.showDuplicateJobs)) {
                    // render the job itself, not a count
                    buttons.push(job);
                } else {
                    var lastJobSelected = {};
                    _.extend(countInfo, stateCounts[countInfo.btnClass]);
                    if (!_.isEmpty(lastJobSelected.job) && (lastJobSelected.job.id === job.id)) {
                        countInfo.selectedClasses = ['selected-count', 'btn-lg-xform'];
                    } else countInfo.selectedClasses = [];
                    if (stateCounts[countInfo.btnClass]) {
                        countInfo.count = stateCounts[countInfo.btnClass].count + 1;
                    } else {
                        countInfo.count = 1;
                    }
                    countInfo.lastJob = job;
                    stateCounts[countInfo.btnClass] = countInfo;
                }
            });
            _.forEach(stateCounts, (countInfo) => {
                if (countInfo.count === 1) {
                    buttons.push(countInfo.lastJob);
                } else {
                    counts.push(countInfo);
                }
            });
        }
        return { buttons, counts };
    }
    render() {
        var items = this.groupButtonsAndCounts();
        var buttons = items.buttons.map((job, i) => jobButtonComponentFactory({
            job,
            ref: i,
            refOrder: i,
            key: job.id,
            hasGroup: true,
            $injector: this.props.$injector
        }));
        var counts = items.counts.map((countInfo) => jobCountComponent({
            $injector: this.props.$injector,
            count: countInfo.count,
            onClick: this.toggleExpanded,
            className: `${countInfo.btnClass}-count`,
            title: `${countInfo.count} ${countInfo.countText} jobs in group`,
            key: countInfo.lastJob.id
        }));
        return React.DOM.span(
            { className: 'platform-group', },
            React.DOM.span(
                {
                    className: 'disabled job-group',
                    title: this.props.group.name,
                    'data-grkey': this.props.group.grkey,
                },
                React.DOM.button(
                    {
                        className: 'btn group-symbol',
                        'data-ignore-job-clear-on-click': '',
                        onClick: this.toggleExpanded
                    },
                    this.props.group.symbol,
                    this.tierEl
                ),
                React.DOM.span(
                    { className: 'group-content' },
                    React.DOM.span(
                        { className: 'group-job-list' },
                        buttons
                    ),
                    React.DOM.span(
                        { className: 'group-count-list' },
                        counts
                    )
                )
            )
        );
    }
}
JobGroupComponent.propTypes = {
    $injector: React.PropTypes.object.isRequired,
    group: React.PropTypes.object.isRequired,
    refOrder: React.PropTypes.number.isRequired
};
JobGroupComponent.contextTypes = {
    selectJob: React.PropTypes.func.isRequired,
    platform: React.PropTypes.object.isRequired,
    resultsetId: React.PropTypes.number.isRequired,
    selectJobFromAdjacentGroup: React.PropTypes.func.isRequired
};
var jobGroupComponentFactory = React.createFactory(JobGroupComponent);

