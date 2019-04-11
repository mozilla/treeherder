import React from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip } from 'reactstrap';

export default class SimpleTooltip extends React.Component {
  constructor(props) {
    super(props);
    this.tooltipRef = React.createRef();
  }

  render() {
    const {
      text,
      tooltipText,
      placement,
      textClass,
      tooltipClass,
    } = this.props;

    return (
      <React.Fragment>
        <span ref={this.tooltipRef} className={textClass}>
          {text}
        </span>
        <UncontrolledTooltip
          placement={placement}
          target={this.tooltipRef}
          className="tooltip"
          innerClassName={tooltipClass}
        >
          {tooltipText}
        </UncontrolledTooltip>
      </React.Fragment>
    );
  }
}
SimpleTooltip.propTypes = {
  text: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.string]).isRequired,
  tooltipText: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.string])
    .isRequired,
  textClass: PropTypes.string,
  placement: PropTypes.string,
  tooltipClass: PropTypes.string,
};

SimpleTooltip.defaultProps = {
  textClass: '',
  placement: 'top',
  tooltipClass: '',
};
