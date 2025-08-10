import React from 'react';
import PropTypes from 'prop-types';
import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';

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
    } = this.props;

    return (
      <OverlayTrigger
        placement={placement}
        overlay={<Tooltip className={innerClassName}>{tooltipText}</Tooltip>}
      >
        <span className={`${textClass} pb-1`}>
          <Badge bg="light" data-testid="alert-noise-profile">
            {text}
          </Badge>
        </span>
      </OverlayTrigger>
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
};

BadgeTooltip.defaultProps = {
  textClass: '',
  placement: 'top',
  innerClassName: '',
};
