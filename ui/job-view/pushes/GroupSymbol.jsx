import React from 'react';
import PropTypes from 'prop-types';

const GroupSymbol = function GroupSymbol(props) {
  const { symbol, tier = 1, toggleExpanded } = props;

  return (
    <button type="button" className="btn group-symbol" onClick={toggleExpanded}>
      {symbol}
      {tier !== 1 && <span className="small">[tier {tier}]</span>}
    </button>
  );
};

GroupSymbol.propTypes = {
  symbol: PropTypes.string.isRequired,
  toggleExpanded: PropTypes.func.isRequired,
  tier: PropTypes.number,
};

export default GroupSymbol;
