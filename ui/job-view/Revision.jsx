import React from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';

import { parseAuthor } from '../helpers/revision';
import { linkifyBugs } from '../helpers/url';

export function Initials(props) {
  const str = props.author || '';
  const words = str.split(' ');
  const firstLetters = words.map(
        word => word.replace(/[^A-Z]/gi, '')[0],
    ).filter(firstLetter => typeof firstLetter !== 'undefined');
  let initials = '';

  if (firstLetters.length === 1) {
    initials = firstLetters[0];
  } else if (firstLetters.length > 1) {
    initials = firstLetters[0] + firstLetters[firstLetters.length - 1];
  }

  return (
    <span title={props.title}>
      <span className="user-push-icon">
        <i className="fa fa-user-o" aria-hidden="true" data-job-clear-on-click />
      </span>
      <div className="icon-superscript user-push-initials" data-job-clear-on-click>{initials}</div>
    </span>
  );
}

Initials.propTypes = {
  author: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
};

export class Revision extends React.PureComponent {
  constructor(props) {
    super(props);
    const { revision } = this.props;

    this.comment = revision.comments.split('\n')[0];
    this.tags = this.comment.search('Backed out') >= 0 || this.comment.search('Back out') >= 0 ?
        'backout' : '';
  }

  render() {
    const { revision, repo } = this.props;
    const { name, email } = parseAuthor(revision.author);
    const commitRevision = revision.revision;

    return (<li className="clearfix">
      <span className="revision" data-tags={this.tags}>
        <span className="revision-holder" data-job-clear-on-click>
          <a
            title={`Open revision ${commitRevision} on ${repo.url}`}
            href={repo.getRevisionHref(commitRevision)}
          >{commitRevision.substring(0, 12)}
          </a>
        </span>
        <Initials
          title={`${name}: ${email}`}
          author={name}
        />
        <span title={this.comment}>
          <span className="revision-comment">
            <em data-job-clear-on-click><ReactMarkdown source={linkifyBugs(this.comment)} /></em>
          </span>
        </span>
      </span>
    </li>);
  }
}

Revision.propTypes = {
  revision: PropTypes.object.isRequired,
  repo: PropTypes.object.isRequired,
};

