import React from 'react';
import PropTypes from 'prop-types';
import { ButtonGroup, Button } from 'react-bootstrap';

const TIERS = ['1', '2', '3'];

export default function TierIndicator(props) {
  const { filterModel } = props;
  const shownTiers = filterModel.urlParams.tier || [];

  return (
    <ButtonGroup>
      {TIERS.map((tier) => {
        const isOnlyTier = shownTiers.length === 1 && tier === shownTiers[0];
        return (
          <Button
            onClick={() => filterModel.toggleFilter('tier', tier)}
            title={
              isOnlyTier
                ? "Can't Toggle because least one tier must be selected at all times"
                : `Toggle tier ${tier} jobs`
            }
            variant="link"
            disabled={isOnlyTier}
            key={tier}
            style={{
              backgroundColor: shownTiers.includes(tier)
                ? '#6c757d'
                : 'transparent',
              color: shownTiers.includes(tier) ? 'white' : '#6c757d',
              border: 'none',
              padding: '0.25rem 0.75rem',
              textDecoration: 'none',
              minWidth: '2rem',
            }}
          >
            {tier}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}

TierIndicator.propTypes = {
  filterModel: PropTypes.shape({}).isRequired,
};
