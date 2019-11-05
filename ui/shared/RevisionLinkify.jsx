import React from 'react';
import PropTypes from 'prop-types';
import ReactLinkify, { linkify } from 'react-linkify';

const revRe = /([a-f\d]{12,40})/;

const getRevisionsAsLinkProtocol = function getRevisionsAsLinkProtocol(text) {
  const revMatches = text.match(revRe);
  const revProtocol = 'rev:$1';

  return revMatches ? text.replace(revRe, revProtocol) : text;
};

export default class RevisionLinkify extends React.Component {
  constructor(props) {
    super(props);

    linkify.add('rev:', {
      validate: (text, pos, self) => {
        const revision = text.slice(pos).split(' ')[0];

        self.re.rev = revRe;
        if (self.re.rev.test(revision)) {
          return revision.match(self.re.rev)[0].length;
        }
        return 0;
      },
      normalize: match => {
        const rev = match.text.replace('rev:', '');

        match.url = `${props.repo.url}/rev/${rev}`;
        match.text = rev;
      },
    });
  }

  render() {
    return (
      <ReactLinkify
        properties={{ target: '_blank', rel: 'noopener noreferrer' }}
      >
        {getRevisionsAsLinkProtocol(this.props.children)}
      </ReactLinkify>
    );
  }
}

RevisionLinkify.propTypes = {
  children: PropTypes.string.isRequired,
  repo: PropTypes.object.isRequired,
};
