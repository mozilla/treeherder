import React from 'react';
import PropTypes from 'prop-types';
import { Button, Row, Col } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faBan,
  faLevelDownAlt,
  faArrowAltCircleRight,
} from '@fortawesome/free-solid-svg-icons';

import SimpleTooltip from '../../shared/SimpleTooltip';
import { alertStatusMap } from '../constants';
import { modifyAlert } from '../helpers';
import { processErrors } from '../../helpers/http';

import AlertModal from './AlertModal';

export default class AlertActionPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showDownstreamModal: false,
      showReassignedModal: false,
    };
  }

  modifySelectedAlerts = (selectedAlerts, modification) =>
    Promise.all(
      selectedAlerts.map((alert) =>
        this.props.modifyAlert(alert, modification),
      ),
    );

  updateAndFetch = async (newStatus, alertId = null) => {
    const {
      selectedAlerts,
      alertSummaries,
      alertSummary,
      fetchAlertSummaries,
      updateViewState,
    } = this.props;

    let otherAlertSummaries;

    const responses = await this.modifySelectedAlerts(selectedAlerts, {
      status: alertStatusMap[newStatus],
      related_summary_id: alertId,
    });

    const errorMessages = processErrors(responses);
    if (errorMessages.length) {
      return updateViewState({ errorMessages });
    }

    if (alertId) {
      otherAlertSummaries = alertSummaries.filter(
        (summary) => summary.id === alertId,
      );
    } else {
      otherAlertSummaries = selectedAlerts
        .map((alert) =>
          alertSummaries.find(
            (summary) => summary.id === alert.related_summary_id,
          ),
        )
        .filter((summary) => summary !== undefined);
    }

    const summariesToUpdate = [...[alertSummary], ...otherAlertSummaries];

    // when an alert status is updated via the API, the corresponding
    // alertSummary status and any related summaries are updated (in the backend)
    // so we need to fetch them in order to capture the changes in the UI
    summariesToUpdate.forEach((summary) => fetchAlertSummaries(summary.id));
    this.clearSelectedAlerts();
  };

  clearSelectedAlerts = () => {
    const { allSelected, updateState } = this.props;
    const updates = { selectedAlerts: [] };

    if (allSelected) {
      updates.allSelected = false;
    }
    updateState(updates);
  };

  updateAlerts = async (newStatus) => {
    const { selectedAlerts, fetchAlertSummaries, alertSummary } = this.props;

    await this.modifySelectedAlerts(selectedAlerts, {
      status: alertStatusMap[newStatus],
    });

    fetchAlertSummaries(alertSummary.id);
    this.clearSelectedAlerts();
  };

  hasTriagedAlerts = () =>
    this.props.selectedAlerts.some(
      (alert) => alert.status !== alertStatusMap.untriaged,
    );

  updateAndClose = async (event, alertId, newStatus, modal) => {
    event.preventDefault();
    this.updateAndFetch(newStatus, parseInt(alertId, 10));
    this.toggle(modal);
  };

  toggle = (state) => {
    this.setState((prevState) => ({
      [state]: !prevState[state],
    }));
  };

  render() {
    const { showDownstreamModal, showReassignedModal } = this.state;

    return (
      <div className="bg-lightgray">
        <AlertModal
          toggle={() => this.toggle('showDownstreamModal')}
          showModal={showDownstreamModal}
          header="Mark Alerts Downstream"
          title="Alert Number"
          updateAndClose={(event, inputValue) =>
            this.updateAndClose(
              event,
              inputValue,
              'downstream',
              'showDownstreamModal',
            )
          }
        />
        <AlertModal
          toggle={() => this.toggle('showReassignedModal')}
          showModal={showReassignedModal}
          header="Reassign Alerts"
          title="Alert Number"
          updateAndClose={(event, inputValue) =>
            this.updateAndClose(
              event,
              inputValue,
              'reassigned',
              'showReassignedModal',
            )
          }
        />

        <Row className="m-0 px-2 py-3">
          {this.hasTriagedAlerts() && (
            <Col sm="auto" className="p-2">
              <SimpleTooltip
                text={
                  <Button
                    color="warning"
                    onClick={() => this.updateAndFetch('untriaged')}
                  >
                    Reset
                  </Button>
                }
                tooltipText="Reset selected alerts to untriaged"
              />
            </Col>
          )}

          {!this.hasTriagedAlerts() && (
            <React.Fragment>
              <Col sm="auto" className="p-2">
                <SimpleTooltip
                  text={
                    <Button
                      color="secondary"
                      onClick={() => this.updateAlerts('acknowledged')}
                    >
                      <FontAwesomeIcon icon={faCheck} /> Acknowledge
                    </Button>
                  }
                  tooltipText="Acknowledge selected alerts as valid"
                />
              </Col>

              <Col sm="auto" className="p-2">
                <SimpleTooltip
                  text={
                    <Button
                      color="secondary"
                      onClick={() => this.updateAlerts('invalid')}
                    >
                      <FontAwesomeIcon icon={faBan} /> Mark invalid
                    </Button>
                  }
                  tooltipText="Mark selected alerts as invalid"
                />
              </Col>

              <Col sm="auto" className="p-2">
                <SimpleTooltip
                  text={
                    <Button
                      color="secondary"
                      onClick={() => this.toggle('showDownstreamModal')}
                    >
                      <FontAwesomeIcon icon={faLevelDownAlt} /> Mark downstream
                    </Button>
                  }
                  tooltipText="Mark selected alerts as downstream from an alert summary on another branch"
                />
              </Col>

              <Col sm="auto" className="p-2">
                <SimpleTooltip
                  text={
                    <Button
                      color="secondary"
                      onClick={() => this.toggle('showReassignedModal')}
                    >
                      <FontAwesomeIcon icon={faArrowAltCircleRight} /> Reassign
                    </Button>
                  }
                  tooltipText="Reassign selected alerts to another alert summary on the same branch"
                />
              </Col>
            </React.Fragment>
          )}
        </Row>
      </div>
    );
  }
}

AlertActionPanel.propTypes = {
  selectedAlerts: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  fetchAlertSummaries: PropTypes.func.isRequired,
  alertSummary: PropTypes.shape({}),
  updateState: PropTypes.func.isRequired,
  allSelected: PropTypes.bool.isRequired,
  alertSummaries: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  updateViewState: PropTypes.func.isRequired,
  modifyAlert: PropTypes.func,
};

AlertActionPanel.defaultProps = {
  alertSummary: null,
  modifyAlert,
};
