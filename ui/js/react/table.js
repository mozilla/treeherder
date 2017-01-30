'use strict';
/* global JobButtonComponent, JobGroupComponent, jobButtonComponentFactory, jobGroupComponentFactory, revisionListComponent */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": ".*Component$" }] */

var jobPlatformDataComponent = (props) => {
    var titleText = `${props.platform.name} ${props.platform.option}`;
    return React.DOM.td(
        { className: 'platform', },
        React.DOM.span(
            { title: titleText, },
            titleText
        )
    );
};
jobPlatformDataComponent.propTypes = {
    platform: React.PropTypes.object.isRequired
};
class JobDataComponent extends React.PureComponent {
    constructor(props) {
        super(props);
        this.selectJobFromAdjacentGroup = this.selectJobFromAdjacentGroup.bind(this);
        this.selectFirstVisibleJob = this.selectFirstVisibleJob.bind(this);
        this.selectLastVisibleJob = this.selectLastVisibleJob.bind(this);
    }
    getChildContext() {
        return {
            selectJobFromAdjacentGroup: this.selectJobFromAdjacentGroup
        };
    }
    selectJobFromAdjacentGroup(direction, src) {
        var index = src.props.refOrder;
        if (direction === 'next') {
            var nextIndex = index + 1;
            if (nextIndex === _.size(this.refs)) {
                // This is the last group in its platform
                // Select first job in the next platform
                this.context.selectJobFromAdjacentPlatform(direction, src);
            } else if (this.refs[nextIndex] instanceof JobButtonComponent) {
                this.context.selectJob(this.refs[nextIndex].props.job);
            } else {
                // Find the next group with visible buttons and select its first button
                while (nextIndex < _.size(this.refs) && _.isEmpty(this.refs[nextIndex].refs)) {
                    nextIndex++;
                }
                if (nextIndex < _.size(this.refs)) {
                    this.refs[nextIndex].selectFirstVisibleJob();
                } else {
                    this.context.selectJobFromAdjacentPlatform(direction, src);
                }
            }
        } else if (index === 0) {
            // No more previous groups left in this platform
            // Select last job in previous platform
            this.context.selectJobFromAdjacentPlatform(direction, src);
        } else {
            var previousIndex = index - 1;
            if (this.refs[previousIndex] instanceof JobButtonComponent) {
                this.context.selectJob(this.refs[previousIndex].props.job);
            } else {
                // Search refs for a previous group with visible buttons
                // or a previous standalone job button
                var previousJobOrGroup = this.refs[previousIndex];
                while (previousJobOrGroup &&
                (_.isEmpty(previousJobOrGroup.refs)) &&
                !(previousJobOrGroup instanceof JobButtonComponent)) {
                    previousJobOrGroup = this.refs[--previousIndex];
                }
                if (previousJobOrGroup instanceof JobGroupComponent) {
                    previousJobOrGroup.selectLastVisibleJob();
                } else if (previousJobOrGroup instanceof JobButtonComponent) {
                    this.context.selectJob(previousJobOrGroup.props.job);
                } else {
                    this.context.selectJobFromAdjacentPlatform(direction, src);
                }
            }
        }
    }
    selectFirstVisibleJob() {
        var first = this.refs[Object.keys(this.refs)[0]];
        if (first instanceof JobButtonComponent) {
            this.context.selectJob(first.props.job);
        } else if (first instanceof JobGroupComponent) {
            first.selectFirstVisibleJob();
        }
    }
    selectLastVisibleJob() {
        var refKeys = Object.keys(this.refs);
        var last = this.refs[refKeys[refKeys.length - 1]];
        if (last instanceof JobButtonComponent) {
            this.context.selectJob(last.props.job);
        } else if (last instanceof JobGroupComponent) {
            last.selectLastVisibleJob();
        }
    }
    render() {
        return React.DOM.td(
            { className: 'job-row' },
            this.props.groups.map((group, i) => {
                if (group.visible) {
                    if (group.symbol !== '?') {
                        return jobGroupComponentFactory({
                            group,
                            ref: i,
                            refOrder: i,
                            key: group.mapKey,
                            $injector: this.props.$injector
                        });
                    }
                    return group.jobs.map((job) => jobButtonComponentFactory({
                        job,
                        ref: i,
                        refOrder: i,
                        key: job.id,
                        hasGroup: false,
                        $injector: this.props.$injector
                    }));
                }
            })
        );
    }
}
JobDataComponent.propTypes = {
    $injector: React.PropTypes.object.isRequired,
    groups: React.PropTypes.array.isRequired,
};
JobDataComponent.contextTypes = {
    selectJob: React.PropTypes.func.isRequired,
    selectJobFromAdjacentPlatform: React.PropTypes.func.isRequired,
};
JobDataComponent.childContextTypes = {
    selectJobFromAdjacentGroup: React.PropTypes.func.isRequired
};
var jobDataComponentFactory = React.createFactory(JobDataComponent);

class JobTableRowComponent extends React.PureComponent {
    getChildContext() {
        return { platform: this.props.platform };
    }
    render() {
        return React.DOM.tr(
            {
                id: this.props.platform.id,
                key: this.props.platform.id
            },
            jobPlatformDataComponent({
                $injector: this.props.$injector,
                platform: this.props.platform
            }),
            jobDataComponentFactory({
                groups: this.props.platform.groups,
                $injector: this.props.$injector,
                ref: 'data'
            })
        );
    }
}
JobTableRowComponent.props = {
    $injector: React.PropTypes.object.isRequired,
    platform: React.PropTypes.object.isRequired
};
JobTableRowComponent.childContextTypes = {
    platform: React.PropTypes.object
};
var jobTableRowComponentFactory = React.createFactory(JobTableRowComponent);

var spinnerComponent = () => React.DOM.span(
    { className: "fa fa-spinner fa-pulse th-spinner" },
    null
);

class JobTableComponent extends React.Component {
    constructor(props) {
        super(props);
        this.$rootScope = this.props.$injector.get('$rootScope');
        this.$location = this.props.$injector.get('$location');
        this.thEvents = this.props.$injector.get('thEvents');
        this.thJobFilters = this.props.$injector.get('thJobFilters');
        this.ThResultSetStore = this.props.$injector.get('ThResultSetStore');
        this.thAggregateIds = this.props.$injector.get('thAggregateIds');

        var thPlatformName = this.props.$injector.get('thPlatformName');

        // Check for a selected job in the result set store
        var selectedJobId = null;
        var selectedJobObj = this.ThResultSetStore.getSelectedJob(this.$rootScope.repoName);
        if (_.isEmpty(selectedJobObj.job)) {
            // Check the URL
            var jobId = this.$location.search().selectedJob;
            if (jobId) {
                selectedJobId = parseInt(jobId);
            }
        } else {
            selectedJobId = selectedJobObj.job.id;
        }
        this.state = {
            platforms: {},
            jobsLoaded: false,
            selectedJobId
        };

        this.rsMap = null;
        this.resultsetId = this.props.resultset.id;
        this.aggregateId = this.thAggregateIds.getResultsetTableId(
            this.$rootScope.repoName,
            this.resultsetId,
            this.props.resultset.revision
        );

        this.filterJobs = this.filterJobs.bind(this);
        this.selectJob = this.selectJob.bind(this);
        this.selectJobFromAdjacentPlatform = this.selectJobFromAdjacentPlatform.bind(this);

        this.$rootScope.$on(
            this.thEvents.applyNewJobs,
            (ev, appliedResultsetId) => {
                if (appliedResultsetId !== this.resultsetId) return;
                this.rsMap = this.ThResultSetStore.getResultSetsMap(this.$rootScope.repoName);
                var platforms = this.state.platforms;
                this.rsMap[this.resultsetId].rs_obj.platforms.forEach((platform) => {
                    platform.id = this.getIdForPlatform(platform);
                    platform.name = thPlatformName(platform.name);
                    platform.groups.forEach((group) => {
                        if (group.symbol !== '?') {
                            group.grkey = group.mapKey;
                        }
                    });
                    platforms[platform.id] = this.filterPlatform(platform);
                });
                this.setState({ platforms, jobsLoaded: true });
            }
        );

        this.$rootScope.$on(
            this.thEvents.globalFilterChanged, this.filterJobs
        );

        this.$rootScope.$on(
            this.thEvents.searchPage, this.filterJobs
        );

        this.$rootScope.$on(
            this.thEvents.groupStateChanged, this.filterJobs
        );

        this.$rootScope.$on(
            this.thEvents.searchPage, this.filterJobs
        );
    }
    getChildContext() {
        return {
            selectJob: this.selectJob,
            resultsetId: this.resultsetId,
            selectJobFromAdjacentPlatform: this.selectJobFromAdjacentPlatform
        };
    }
    getIdForPlatform(platform) {
        return this.thAggregateIds.getPlatformRowId(
            this.$rootScope.repoName,
            this.props.resultset.id,
            platform.name,
            platform.option
        );
    }
    getPlatformIdForJob(job) {
        return this.thAggregateIds.getPlatformRowId(
            this.$rootScope.repoName,
            this.props.resultset.id,
            job.platform,
            job.platform_option
        );
    }
    selectJob(job) {
        // Delay switching jobs right away, in case the user is switching rapidly between jobs
        if (this.jobChangedTimeout) {
            window.clearTimeout(this.jobChangedTimeout);
        }
        this.jobChangedTimeout = window.setTimeout(() => {
            this.$rootScope.$emit(
                this.thEvents.jobClick, job
            );
            this.ThResultSetStore.setSelectedJob(
                this.$rootScope.repoName, job
            );
        }, 200);
    }
    selectJobFromAdjacentPlatform(direction, src) {
        if (src.context.resultsetId !== this.props.resultset.id) return;
        var platformId = src.context.platform.id;
        var selectedPlatform = this.refs[platformId];
        if (!selectedPlatform) return;
        var index = selectedPlatform.props.refOrder;
        index = direction === 'next' ? index + 1 : index - 1;
        var targetPlatform = _.find(this.refs, (component) => component.props.refOrder === index);
        if (direction === 'next') targetPlatform.refs.data.selectFirstVisibleJob();
        else targetPlatform.refs.data.selectLastVisibleJob();
    }
    filterJobs() {
        if (_.isEmpty(this.state.platforms)) return;
        var platforms = _.cloneDeep(this.state.platforms);
        _.forEach(platforms, (platform) => {
            platforms[platform.id] = this.filterPlatform(platform);
        });
        this.setState({ platforms });
    }
    filterPlatform(platform) {
        platform.visible = false;
        platform.groups.forEach((group) => {
            group.visible = false;
            group.jobs.forEach((job) => {
                job.visible = this.thJobFilters.showJob(job);
                if (this.rsMap && job.state === 'runnable') {
                    job.visible = job.visible &&
                        this.rsMap[job.result_set_id].rs_obj.isRunnableVisible;
                }
                job.selected = job.id === this.state.selectedJobId;
                if (job.visible) {
                    platform.visible = true;
                    group.visible = true;
                }
            });
        });
        return platform;
    }
    render() {
        return this.state.jobsLoaded ? React.DOM.table(
            {
                id: this.aggregateId,
                className: 'table-hover',
            },
                React.DOM.tbody(
                    {},
                    Object.keys(this.state.platforms).map((id, i) => {
                        if (this.state.platforms[id].visible) {
                            return jobTableRowComponentFactory({
                                $injector: this.props.$injector,
                                platform: this.state.platforms[id],
                                key: id,
                                ref: id,
                                refOrder: i
                            });
                        }
                        return null;
                    })
                )
            ) : spinnerComponent();
    }
}
JobTableComponent.propTypes = {
    $injector: React.PropTypes.object,
    resultset: React.PropTypes.object.isRequired
};
JobTableComponent.childContextTypes = {
    selectJob: React.PropTypes.func,
    resultsetId: React.PropTypes.number,
    selectJobFromAdjacentPlatform: React.PropTypes.func
};

var jobTableComponentFactory = React.createFactory(JobTableComponent);

class ResultSetComponent extends React.Component {
    constructor(props) {
        super(props);
        var $injector = this.props.$injector;
        this.thJobFilters = $injector.get('thJobFilters');
        this.thAggregateIds = $injector.get('thAggregateIds');
        this.$rootScope = $injector.get('$rootScope');
        this.thEvents = $injector.get('thEvents');
        this.ThResultSetStore = $injector.get('ThResultSetStore');

        this.state = {
            showRevisions: this.$rootScope.showRevisions
        };

        this.aggregateId = this.thAggregateIds.getResultsetTableId(
            this.$rootScope.repoName, this.props.resultset.id, this.props.resultset.revision
        );

        this.$rootScope.$on(this.thEvents.toggleAllRevisions, (e, showRevisions) => {
            this.setState({ showRevisions });
        });
    }
    render() {
        var containerClasses = [ 'job-list' ];
        if (this.state.showRevisions) containerClasses.push('job-list-pad', 'col-xs-7');
        else containerClasses.push('job-list-nopad', 'col-xs-12');
        return React.DOM.div(
            { className: "row result-set clearfix" },
            (this.state.showRevisions ? revisionListComponent({
                resultset: this.props.resultset,
                repo: this.$rootScope.currentRepo,
                $injector: this.props.$injector
            }) : null),
            React.DOM.span(
                { className: containerClasses.join(' ') },
                jobTableComponentFactory({
                    resultset: this.props.resultset,
                    $injector: this.props.$injector
                })
            )
        );
    }
}
ResultSetComponent.propTypes = {
    $injector: React.PropTypes.object.isRequired,
    resultset: React.PropTypes.object.isRequired
};

treeherder.directive('resultSet', (reactDirective, $injector) =>
    reactDirective(ResultSetComponent, undefined, {}, { $injector }));
