import { connect } from "react-redux";

export const JobCountComponent = (props) => {
  const classes = [props.className, 'btn group-btn btn-xs job-group-count filter-shown'];
  return (
    <button className={classes.join(' ')}
            title={props.title}
            onClick={props.onClick}
            key={props.countKey}
    >{props.count}</button>
  );
};

const mapStateToProps = ({ pushes }) => pushes;

class JobButtonComponent extends React.Component {
  constructor(props) {
    super(props);
    this.$rootScope = this.props.$injector.get('$rootScope');
    this.thEvents = this.props.$injector.get('thEvents');
    this.thResultStatus = this.props.$injector.get('thResultStatus');
    this.thResultStatusInfo = this.props.$injector.get('thResultStatusInfo');
    this.ThJobModel = this.props.$injector.get('ThJobModel');
    this.ThResultSetStore = this.props.$injector.get('ThResultSetStore');

    this.state = {
      failureClassificationId: null
    };
  }

  componentWillMount() {
    this.$rootScope.$on(this.thEvents.jobsClassified, (ev, { jobs }) => {
      const ids = Object.keys(jobs).map(job => parseInt(job));
      if (ids.includes(this.props.job.id)) {
        const job = jobs[this.props.job.id];
        this.setState({ failureClassificaitonId: job.failure_classification_id });
      }
    });
  }

  /**
   * Rather than making this a PureComponent, which does shallow compares of
   * props and state, we are using shoudlComponentUpdate, because the
   * ``selectedJobId`` will change for all components, but only the previous
   * selection and the next selection care and need to re-render.  So our
   * logic on shouldComponentUpdate is a little more complex than a simple
   * shallow compare would allow.
   */
  shouldComponentUpdate(nextProps) {
    return (this.props.job.id === nextProps.selectedJobId ||
            this.props.job.id === this.props.selectedJobId ||
            this.props.visible !== nextProps.visible ||
            this.props.job.selected !== nextProps.selected);
  }

  render() {
    if (!this.props.job.visible) return null;
    const status = this.thResultStatus(this.props.job);
    const runnable = this.props.job.state === 'runnable';
    const statusInfo = this.thResultStatusInfo(status, this.props.job.failure_classification_id);
    let title = `${this.props.job.job_type_name} - ${status}`;

    if (this.props.job.state === 'completed') {
      const duration = Math.round((this.props.job.end_timestamp - this.props.job.start_timestamp) / 60);
      title += ` (${duration} mins)`;
    }

    const classes = ['btn', statusInfo.btnClass];

    if (runnable) {
      classes.push('runnable-job-btn', 'runnable');
    } else {
      classes.push('job-btn');
    }
    if (runnable) {
      if (runnable && this.ThResultSetStore.isRunnableJobSelected(this.$rootScope.repoName,
                                                                  this.props.job.push_id,
                                                                  this.props.job.ref_data_name)) {
        classes.push('runnable-job-btn-selected');
      }
    }

    if (this.props.job.id === this.props.selectedJobId) {
      classes.push('selected-job btn-lg-xform');
    } else {
      classes.push('btn-xs');
    }

    if (this.props.job.visible) classes.push('filter-shown');

    const attributes = {
      className: classes.join(' '),
      'data-job-id': this.props.job.id,
      'data-ignore-job-clear-on-click': true,
      title
    };
    if (runnable) {
      attributes['data-buildername'] = this.props.job.ref_data_name;
    }
    return <button {...attributes}>{this.props.job.job_type_symbol}</button>;
  }
}

export const JobButton = connect(mapStateToProps)(JobButtonComponent);
