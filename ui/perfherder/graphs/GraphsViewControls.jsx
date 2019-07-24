import React from 'react';
import PropTypes from 'prop-types';
import {
  Button,
  Container,
  Col,
  Row,
  UncontrolledDropdown,
  DropdownToggle,
  Input,
} from 'reactstrap';

import { phTimeRanges } from '../../helpers/constants';
import DropdownMenuItems from '../../shared/DropdownMenuItems';

import TestDataModal from './TestDataModal';

export default class GraphsViewControls extends React.Component {
  changeHighlightedRevision = (index, newValue) => {
    const { highlightedRevisions, updateStateParams } = this.props;

    const newRevisions = [...highlightedRevisions];
    newRevisions.splice(index, 1, newValue);

    updateStateParams({ highlightedRevisions: newRevisions });
  };

  render() {
    const {
      timeRange,
      graphs,
      updateStateParams,
      highlightAlerts,
      highlightedRevisions,
      updateTimeRange,
      hasNoData,
      projects,
      frameworks,
      toggle,
      showModal,
    } = this.props;

    return (
      <Container fluid className="justify-content-start">
        {projects.length > 0 && frameworks.length > 0 && (
          <TestDataModal
            showModal={showModal}
            toggle={toggle}
            {...this.props}
          />
        )}
        <Row className="pb-3">
          <Col sm="auto" className="pl-0 py-2 pr-2" key={timeRange}>
            <UncontrolledDropdown
              className="mr-0 text-nowrap"
              title="Time range"
              aria-label="Time range"
            >
              <DropdownToggle caret>{timeRange.text}</DropdownToggle>
              <DropdownMenuItems
                options={phTimeRanges.map(item => item.text)}
                selectedItem={timeRange.text}
                updateData={value =>
                  updateTimeRange(
                    phTimeRanges.find(item => item.text === value),
                  )
                }
              />
            </UncontrolledDropdown>
          </Col>
          <Col sm="auto" className="p-2">
            <Button color="info" onClick={toggle}>
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
            {graphs}
            <Row className="justify-content-start">
              {highlightedRevisions.length > 0 &&
                highlightedRevisions.map((revision, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <Col sm="2" className="pl-0 pr-3" key={index}>
                    <Input
                      type="text"
                      name={`revision ${revision}`}
                      placeholder="revision to highlight"
                      value={revision}
                      onChange={event =>
                        this.changeHighlightedRevision(
                          index,
                          event.target.value,
                        )
                      }
                    />
                  </Col>
                ))}
              <Col sm="auto" className="pl-0">
                <Button
                  color="info"
                  outline
                  onClick={() =>
                    updateStateParams({ highlightAlerts: !highlightAlerts })
                  }
                  active={highlightAlerts}
                >
                  Highlight alerts
                </Button>
              </Col>
            </Row>
          </React.Fragment>
        )}
      </Container>
    );
  }
}

GraphsViewControls.propTypes = {
  updateStateParams: PropTypes.func.isRequired,
  graphs: PropTypes.oneOfType([PropTypes.shape({}), PropTypes.bool]).isRequired,
  timeRange: PropTypes.shape({}).isRequired,
  highlightAlerts: PropTypes.bool.isRequired,
  highlightedRevisions: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]).isRequired,
  updateTimeRange: PropTypes.func.isRequired,
  hasNoData: PropTypes.bool.isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})),
  getTestData: PropTypes.func.isRequired,
  options: PropTypes.shape({
    option: PropTypes.string,
    relatedSeries: PropTypes.shape({}),
  }),
  testData: PropTypes.arrayOf(PropTypes.shape({})),
  frameworks: PropTypes.arrayOf(PropTypes.shape({})),
  showModal: PropTypes.bool,
  toggle: PropTypes.func.isRequired,
};

GraphsViewControls.defaultProps = {
  frameworks: [],
  projects: [],
  options: undefined,
  testData: [],
  showModal: false,
};
