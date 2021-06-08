import React from 'react';
import PropTypes from 'prop-types';
import Badge from 'reactstrap/lib/Badge';

export default class AlertTablePlatform extends React.PureComponent {
  render() {
    const { platform } = this.props;

    return (
      <Badge color="light" data-testid="alert-platform">
        {platform}
      </Badge>
    );
  }
}

AlertTablePlatform.propTypes = {
  platform: PropTypes.string.isRequired,
};
