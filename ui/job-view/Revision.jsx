import PropTypes from 'prop-types';

export const Initials = (props) => {
    const str = props.author || '';
    const words = str.split(' ');
    const firstLetters = words.map(
        word => word.replace(/[^A-Z]/gi, '')[0]
    ).filter(firstLetter => typeof firstLetter !== 'undefined');
    let initials = '';

    if (firstLetters.length === 1) {
        initials = firstLetters[0];
    } else if (firstLetters.length > 1) {
        initials = firstLetters[0] + firstLetters[firstLetters.length - 1];
    }

    return (
      <span>
        <span className="user-push-icon" title={props.title}>
          <i className="fa fa-user-o" aria-hidden="true" />
        </span>
        <div className="icon-superscript user-push-initials">{initials}</div>
      </span>
    );
};

export class Revision extends React.PureComponent {
  constructor(props) {
    super(props);
    const { revision, linkifyBugsFilter } = this.props;

    const escapedComment = _.escape(revision.comments.split('\n')[0]);
    this.userTokens = revision.author.split(/[<>]+/);
    this.name = this.userTokens[0].trim().replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1));
    this.escapedCommentHTML = { __html: linkifyBugsFilter(escapedComment) };
    this.tags = escapedComment.search('Backed out') >= 0 || escapedComment.search('Back out') >= 0 ?
        'backout' : '';
    this.email = this.userTokens.length > 1 ? this.userTokens[1] : '';
  }

  render() {
    const { revision, repo } = this.props;
    const commitRevision = revision.revision;

    return (<li className="clearfix">
      <span className="revision" data-tags={this.tags}>
        <span className="revision-holder">
          <a
            title={`Open revision ${commitRevision} on ${repo.url}`}
            href={repo.getRevisionHref(commitRevision)}
            data-ignore-job-clear-on-click
          >{commitRevision.substring(0, 12)}
          </a>
        </span>
        <Initials title={`${this.name}: ${this.email}`}
                  author={this.name}
        />
        <span title={this.comment}>
          <span className="revision-comment">
            <em dangerouslySetInnerHTML={this.escapedCommentHTML} />
          </span>
        </span>
      </span>
    </li>);
  }
}

Revision.propTypes = {
  linkifyBugsFilter: PropTypes.func.isRequired,
  revision: PropTypes.object.isRequired,
  repo: PropTypes.object.isRequired,
};

