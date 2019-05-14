import React from 'react';
import PropTypes from 'prop-types';
import { Container, Button } from 'reactstrap';

import SimpleTooltip from '../../shared/SimpleTooltip';
import alertStatus from '../constants';

export default class AlertTableControls extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  // anySelectedAndTriaged = alerts =>
  // alerts
  //   .map(
  //     alert => alert.status === alertStatus.untriaged)
  //   .some(x => x);

  render() {
    const { selectedAlerts } = this.props;
    // className="card-body button-panel"
    return (
      <React.Fragment>
        {selectedAlerts.some(alert => alert.status === alertStatus.untriaged) && (
          <SimpleTooltip
            text={
              <Button color="warning" onClick={() => {}}>
                {' '}
                Reset
              </Button>
            }
            tooltipText="Reset selected alerts to untriaged"
          />
        )}
      </React.Fragment>
    );
  }
}

AlertTableControls.propTypes = {
  selectedAlerts: PropTypes.arrayOf(PropTypes.string).isRequired,
};
