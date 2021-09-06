import React from 'react';
import PropTypes from 'prop-types';
import Badge from 'reactstrap/lib/Badge';

import {
  backfillRetriggeredTitle,
  noiseProfiles,
} from '../perf-helpers/constants';
import SimpleTooltip from '../../shared/SimpleTooltip';

export default class NoiseProfile extends React.PureComponent {
  render() {
    const { noiseProfile } = this.props;

    return (
      <div title={noiseProfiles[noiseProfile]}>
        <Badge color="light" data-testid="alert-noise-profile">
          {noiseProfile}
        </Badge>
      </div>
    );
  }
}

NoiseProfile.propTypes = {
  noiseProfile: PropTypes.string.isRequired,
};
