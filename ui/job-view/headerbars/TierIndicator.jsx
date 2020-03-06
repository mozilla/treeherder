import React from 'react';
import PropTypes from 'prop-types';
import { ButtonGroup, Button } from 'reactstrap';

const TIERS = ['1', '2', '3'];

export default function TierIndicator(props) {
  const { filterModel } = props;
  const shownTiers = filterModel.urlParams.tier || [];

  return (
    <ButtonGroup>
      {TIERS.map(tier => {
        const isOnlyTier = shownTiers.length === 1 && tier === shownTiers[0];
        return (
          <Button
            onClick={() => filterModel.toggleFilter('tier', tier)}
            title={
              isOnlyTier
                ? "Can't Toggle because least one tier must be selected at all times"
                : `Toggle tier ${tier} jobs`
            }
            disabled={isOnlyTier}
            outline={!shownTiers.includes(tier)}
            key={tier}
          >
            {tier}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

TierIndicator.propTypes = {
  filterModel: PropTypes.object.isRequired,
};
