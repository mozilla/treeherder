import React from 'react';
import PropTypes from 'prop-types';
import { Button, Col, Container, Input, Row } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChartArea, faTable } from '@fortawesome/free-solid-svg-icons';
import moment from 'moment';

import { endpoints } from '../constants';
import { ISODate } from '../../intermittent-failures/helpers';
import { getData } from '../../helpers/http';
import { createApiUrl } from '../../helpers/url';

import TestDataModal from './TestDataModal';
import GraphsContainer from './GraphsContainer';
import TimeRangeDropdown from './TimeRangeDropdown';

export default class GraphsViewControls extends React.Component {
  constructor() {
    super();
    this.state = {
      changelogData: [],
    };
  }

  componentDidMount = () => {
    this.getChangelogData();
  };

  componentDidUpdate = (prevProps) => {
    const { timeRange } = this.props;

    if (timeRange !== prevProps.timeRange) {
      this.getChangelogData();
    }
  };

  getChangelogData = async () => {
    const { timeRange } = this.props;
    const startDate = ISODate(
      moment().utc().subtract(timeRange.value, 'seconds'),
    );

    const rawData = await getData(
      createApiUrl(endpoints.changelog, { startdate: startDate }),
    );
    const changelogData = rawData.data.map(({ date, ...extra }) => ({
      date: new Date(date),
      ...extra,
    }));
    this.setState({ changelogData });
  };

  changeHighlightedRevision = (index, newValue) => {
    const { highlightedRevisions, updateStateParams } = this.props;

    const newRevisions = [...highlightedRevisions];
    newRevisions.splice(index, 1, newValue);

    updateStateParams({ highlightedRevisions: newRevisions });
  };

  extractMeasurementUnitsSet = (testData) => {
    const measurementUnits = testData.map(
      (testDetails) => testDetails.measurementUnit,
    );
    return new Set(measurementUnits);
  };

  render() {
    const {
      timeRange,
      updateStateParams,
      highlightAlerts,
      highlightChangelogData,
      highlightedRevisions,
      updateTimeRange,
      hasNoData,
      toggle,
      toggleTableView,
      showModal,
      showTable,
      testData,
    } = this.props;

    const { changelogData } = this.state;

    const measurementUnits = this.extractMeasurementUnitsSet(testData);

    return (
      <Container fluid className="justify-content-start">
        <TestDataModal
          showModal={showModal}
          toggle={toggle}
          plottedUnits={measurementUnits}
          {...this.props}
        />
        <Row className="pb-3 max-width-default mx-auto">
          {!hasNoData && (
            <Col sm="auto" className="pl-0 py-2 pr-3">
              <Button color="darker-info" onClick={toggleTableView}>
                {showTable ? (
                  <FontAwesomeIcon className="mr-2" icon={faChartArea} />
                ) : (
                  <FontAwesomeIcon className="mr-2" icon={faTable} />
                )}
                {showTable ? 'Graphs View' : 'Table View'}
              </Button>
            </Col>
          )}
          <Col sm="auto" className="pl-0 py-2 pr-2" key={timeRange}>
            <TimeRangeDropdown
              timeRangeText={timeRange.text}
              updateTimeRange={updateTimeRange}
            />
          </Col>
          <Col sm="auto" className="p-2">
            <Button color="darker-info" onClick={toggle}>
              Add test data
            </Button>
          </Col>
        </Row>

        {hasNoData ? (
          <Row>
            <p className="lead text-left">
              Nothing here yet. Add test data to plot graphs.
            </p>
          </Row>
        ) : (
          <React.Fragment>
            {testData.length > 0 && (
              <GraphsContainer
                measurementUnits={measurementUnits}
                changelogData={changelogData}
                {...this.props}
              />
            )}

            <Row className="justify-content-start pt-2 pb-5 max-width-default mx-auto">
              {highlightedRevisions.length > 0 &&
                highlightedRevisions.map((revision, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Col sm="2" className="pl-0 pr-3" key={index}>
                    <Input
                      type="text"
                      name={`revision ${revision}`}
                      placeholder="revision to highlight"
                      value={revision}
                      onChange={(event) =>
                        this.changeHighlightedRevision(
                          index,
                          event.target.value,
                        )
                      }
                    />
                  </Col>
                ))}
              {!showTable && (
                <Col sm="auto" className="pl-0">
                  <Button
                    color="darker-info"
                    outline
                    onClick={() =>
                      updateStateParams({
                        highlightAlerts: !highlightAlerts,
                      })
                    }
                    active={highlightAlerts}
                  >
                    Highlight alerts
                  </Button>
                  <Button
                    className="ml-3"
                    color="darker-info"
                    outline
                    onClick={() =>
                      updateStateParams({
                        highlightChangelogData: !highlightChangelogData,
                      })
                    }
                    active={highlightChangelogData}
                  >
                    Highlight infra changes
                  </Button>
                </Col>
              )}
            </Row>
          </React.Fragment>
        )}
      </Container>
    );
  }
}

GraphsViewControls.propTypes = {
  updateStateParams: PropTypes.func.isRequired,
  timeRange: PropTypes.shape({}).isRequired,
  highlightAlerts: PropTypes.bool.isRequired,
  highlightChangelogData: PropTypes.bool.isRequired,
  highlightedRevisions: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]).isRequired,
  updateTimeRange: PropTypes.func.isRequired,
  hasNoData: PropTypes.bool.isRequired,
  getTestData: PropTypes.func.isRequired,
  options: PropTypes.shape({
    option: PropTypes.string,
    relatedSeries: PropTypes.shape({}),
  }),
  testData: PropTypes.arrayOf(PropTypes.shape({})),
  showModal: PropTypes.bool,
  toggle: PropTypes.func.isRequired,
};

GraphsViewControls.defaultProps = {
  options: undefined,
  testData: [],
  showModal: false,
};
