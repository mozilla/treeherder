import React from 'react';
import PropTypes from 'prop-types';
import { Tooltip } from 'reactstrap';
import { getLogViewerUrl } from '../helpers/url';


export default class BugLogColumn extends React.Component {
  constructor(props) {
    super(props);

    this.updateTarget = this.updateTarget.bind(this);
    this.toggle = this.toggle.bind(this);

    this.state = {
      tooltipOpen: false,
      target: null,
    };
  }

  updateTarget(target) {
    if (!this.state.target) {
      this.setState({ target });
    }
  }

  toggle() {
    this.setState({
      tooltipOpen: !this.state.tooltipOpen,
    });
  }

  render() {
    const { value, original } = this.props;
    const { tooltipOpen, target } = this.state;
    return (
      <div>
        <span ref={this.updateTarget}>
          {`${original.lines.length} unexpected-fail${original.lines.length > 1 ? 's' : ''}`}
          <br />
          <a
            className="small-text"
            href={getLogViewerUrl(value, original.tree)}
            target="_blank"
            rel="noopener noreferrer"
          >
            view details
          </a>
        </span>

        {target && original.lines.length > 0 &&
        <Tooltip
          placement="left"
          isOpen={tooltipOpen}
          target={target}
          toggle={this.toggle}
          className="tooltip"
        >
          <ul>
            {original.lines.map(line => (
              <li key={line} className="failure_li text-truncate">{line}</li>
            ))}
          </ul>
        </Tooltip>}
      </div>
    );
  }
}
BugLogColumn.propTypes = {
  value: PropTypes.number.isRequired,
  original: PropTypes.shape({}).isRequired,
};

Tooltip.propTypes = {
  isOpen: PropTypes.bool,
  toggle: PropTypes.func,
  target: PropTypes.shape({}),
  className: PropTypes.string,
  placement: PropTypes.oneOf([
    'auto',
    'auto-start',
    'auto-end',
    'top',
    'top-start',
    'top-end',
    'right',
    'right-start',
    'right-end',
    'bottom',
    'bottom-start',
    'bottom-end',
    'left',
    'left-start',
    'left-end',
  ]),
};
