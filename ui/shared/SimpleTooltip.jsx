import React from 'react';
import PropTypes from 'prop-types';
import { OverlayTrigger, Tooltip } from 'react-bootstrap';

const SimpleTooltip = ({
  text,
  tooltipText,
  placement = 'top',
  textClass = '',
  innerClassName = '',
  autohide = true,
}) => {
  const tooltip = <Tooltip className={innerClassName}>{tooltipText}</Tooltip>;

  return (
    <OverlayTrigger
      placement={placement}
      overlay={tooltip}
      delay={{ show: autohide ? 250 : 0, hide: autohide ? 250 : 0 }}
    >
      <span className={textClass}>{text}</span>
    </OverlayTrigger>
  );
};

export default SimpleTooltip;
SimpleTooltip.propTypes = {
  text: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.string]).isRequired,
  tooltipText: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.string]),
  textClass: PropTypes.string,
  placement: PropTypes.string,
  innerClassName: PropTypes.string,
  autohide: PropTypes.bool,
};
