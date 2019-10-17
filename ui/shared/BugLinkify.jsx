import React from 'react';
import PropTypes from 'prop-types';
import ReactLinkify, { linkify } from 'react-linkify';

export default class BugLinkify extends React.Component {
  constructor(props) {
    super(props);

    linkify.add('bug:', {
      validate: (text, pos, self) => {
        const bugNumber = text.slice(pos).split(' ')[0];

        self.re.bug = /^([0-9]+)/gi;
        if (self.re.bug.test(bugNumber)) {
          return bugNumber.match(self.re.bug)[0].length;
        }
        return 0;
      },
      normalize: match => {
        const bugNumber = match.text.replace('bug:', '');

        match.url = `https://bugzilla.mozilla.org/show_bug.cgi?id=${bugNumber}`;
        match.text = `Bug ${bugNumber}`;
      },
    });
  }

  getBugsAsLinkProtocol(text) {
    this.bugText = text;
    this.bugMatches = text.match(/-- ([0-9]+)|bug.([0-9]+)/gi);
    this.bugProtocol = 'bug:$1';

    if (this.bugMatches) {
      // Need a pass for each matching style for if there are multiple styles
      // in the string.
      this.bugText = this.bugText.replace(/Bug ([0-9]+)/g, this.bugProtocol);
      this.bugText = this.bugText.replace(/bug ([0-9]+)/g, this.bugProtocol);
      this.bugText = this.bugText.replace(/-- ([0-9]+)/g, this.bugProtocol);
    }
    return this.bugText;
  }

  render() {
    return (
      <ReactLinkify
        properties={{ target: '_blank', rel: 'noopener noreferrer' }}
      >
        {this.getBugsAsLinkProtocol(this.props.children)}
      </ReactLinkify>
    );
  }
}

BugLinkify.propTypes = {
  children: PropTypes.string.isRequired,
};
