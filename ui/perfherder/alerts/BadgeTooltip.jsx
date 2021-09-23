import React from 'react';
import PropTypes from 'prop-types';
import { UncontrolledTooltip } from 'reactstrap';
import Badge from 'reactstrap/lib/Badge';

export default class BadgeTooltip extends React.Component {
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
      innerClassName,
      autohide,
    } = this.props;

    return (
      <React.Fragment>
        <span ref={this.tooltipRef} className={`${textClass} pb-1`}>
          <Badge color="light" data-testid="alert-noise-profile">
            {text}
          </Badge>
        </span>

        <UncontrolledTooltip
          placement={placement}
          target={this.tooltipRef}
          innerClassName={innerClassName}
          autohide={autohide}
        >
          {tooltipText}
        </UncontrolledTooltip>
      </React.Fragment>
    );
  }
}
BadgeTooltip.propTypes = {
  text: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.string]).isRequired,
  tooltipText: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.string])
    .isRequired,
  textClass: PropTypes.string,
  placement: PropTypes.string,
  innerClassName: PropTypes.string,
  autohide: PropTypes.bool,
};

BadgeTooltip.defaultProps = {
  textClass: '',
  placement: 'top',
  innerClassName: '',
  autohide: true,
};
