import React from 'react';
import PropTypes from 'prop-types';

const GraphIcon = ({ iconType, fill, stroke }) => {
  let iconPath;

  switch (iconType) {
    case 'circle':
      iconPath = <circle cx="9" cy="9" r="7" />;
      break;
    case 'square':
      iconPath = <rect x="1" y="1" width="15" height="15" />;
      break;
    case 'diamond':
      iconPath = (
        <rect x="-7" y="9" width="10" height="10" transform="rotate(-45)" />
      );
      break;
    default:
      iconPath = <circle cx="10" cy="10" r="5" />;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20px"
      height="20px"
      fill={fill || '#6c757d'}
      stroke={stroke || '#6c757d'}
      strokeWidth="2"
    >
      {iconPath}
    </svg>
  );
};

GraphIcon.propTypes = {
  iconType: PropTypes.string,
  fill: PropTypes.string,
  stroke: PropTypes.string,
};

GraphIcon.defaultProps = {
  iconType: 'circle',
  fill: '#ffffff',
  stroke: '#ccc',
};

export default GraphIcon;
