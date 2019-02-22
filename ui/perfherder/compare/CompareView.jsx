import React from 'react';
import PropTypes from 'prop-types';
import { react2angular } from 'react2angular/index.es2015';
import {
  Container,
  Col,
  UncontrolledDropdown,
  DropdownToggle,
} from 'reactstrap';

import perf from '../../js/perf';
import { createQueryParams } from '../../helpers/url';
import { getGraphsLink } from '../helpers';
import { phTimeRanges } from '../../helpers/constants';
import DropdownMenuItems from '../../shared/DropdownMenuItems';

import withValidation from './Validation';
import CompareTableView from './CompareTableView';

// TODO remove $stateParams and $state after switching to react router
export class CompareView extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      framework: this.getFrameworkData(),
    };
  }

  componentDidUpdate(prevProps) {
    const { framework } = this.props.validated;
    if (framework !== prevProps.validated.framework) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ framework });
    }
  }

  getFrameworkData = () => {
    const { framework, frameworks } = this.props.validated;

    if (framework) {
      const frameworkObject = frameworks.find(
        item => item.id === parseInt(framework, 10),
      );
      // framework is validated in the withValidation component so
      // we know this object will always exist
      return frameworkObject;
    }
    return { id: 1, name: 'talos' };
  };

  getInterval = (oldTimestamp, newTimestamp) => {
    const now = new Date().getTime() / 1000;
    let timeRange = Math.min(oldTimestamp, newTimestamp);
    timeRange = Math.round(now - timeRange);
    const newTimeRange = phTimeRanges.find(time => timeRange <= time.value);
    return newTimeRange.value;
  };

  queryParams = (repository, interval, framework) => ({
    repository,
    framework,
    interval,
    no_subtests: true,
  });

  getQueryParams = timeRange => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      newResultSet,
      originalResultSet,
    } = this.props.validated;

    const { framework } = this.state;

    let originalParams;
    let interval;

    if (originalRevision) {
      interval = this.getInterval(
        originalResultSet.push_timestamp,
        newResultSet.push_timestamp,
      );
      originalParams = this.queryParams(
        originalProject,
        interval,
        framework.id,
      );
      originalParams.revision = originalRevision;
    } else {
      interval = timeRange.value;
      const startDateMs = (newResultSet.push_timestamp - interval) * 1000;
      const endDateMs = newResultSet.push_timestamp * 1000;

      originalParams = this.queryParams(
        originalProject,
        interval,
        framework.id,
      );
      originalParams.startday = new Date(startDateMs)
        .toISOString()
        .slice(0, -5);
      originalParams.endday = new Date(endDateMs).toISOString().slice(0, -5);
    }

    const newParams = this.queryParams(newProject, interval, framework.id);
    newParams.revision = newRevision;
    return [originalParams, newParams];
  };

  createLinks = (oldResults, newResults, timeRange) => {
    const {
      originalProject,
      newProject,
      originalRevision,
      newRevision,
      newResultSet,
      originalResultSet,
    } = this.props.validated;

    const { framework } = this.state;

    const links = [];
    const hasSubtests =
      (oldResults && oldResults.has_subtests) ||
      (newResults && newResults.has_subtests);

    if (hasSubtests) {
      const params = {
        originalProject,
        newProject,
        newRevision,
        originalSignature: oldResults ? oldResults.signature_id : null,
        newSignature: newResults ? newResults.signature_id : null,
        framework: framework.id,
      };

      if (originalRevision) {
        params.originalRevision = originalRevision;
      } else {
        params.selectedTimeRange = timeRange.value;
      }
      const detailsLink = `perf.html#/comparesubtest?&${createQueryParams(
        params,
      )}`;

      links.push({
        title: 'subtests',
        href: detailsLink,
      });
    }

    const graphsParams = [...new Set([originalProject, newProject])].map(
      projectName => ({
        projectName,
        signature: !oldResults
          ? newResults.signature_hash
          : oldResults.signature_hash,
        frameworkId: framework.id,
      }),
    );

    let graphsLink;
    if (originalRevision) {
      graphsLink = getGraphsLink(graphsParams, [
        originalResultSet,
        newResultSet,
      ]);
    } else {
      graphsLink = getGraphsLink(graphsParams, [newResultSet], timeRange.value);
    }

    links.push({
      title: 'graph',
      href: graphsLink,
    });

    return links;
  };

  updateFramework = selection => {
    const { frameworks, updateParams } = this.props.validated;
    const newFramework = frameworks.find(item => item.name === selection);

    updateParams({ framework: newFramework.id });
    this.setState({ framework: newFramework });
  };

  render() {
    const { framework } = this.state;
    const { frameworks } = this.props.validated;

    const frameworkNames =
      frameworks && frameworks.length ? frameworks.map(item => item.name) : [];

    return (
      <Container fluid>
        <CompareTableView
          {...this.props}
          getQueryParams={this.getQueryParams}
          createLinks={this.createLinks}
          framework={framework}
          filterByFramework={
            <Col sm="auto" className="py-2 pl-0 pr-2">
              <UncontrolledDropdown className="mr-0 text-nowrap">
                <DropdownToggle caret>{framework.name}</DropdownToggle>
                {frameworkNames && (
                  <DropdownMenuItems
                    options={frameworkNames}
                    selectedItem={framework.name}
                    updateData={this.updateFramework}
                  />
                )}
              </UncontrolledDropdown>
            </Col>
          }
          checkForResults
        />
      </Container>
    );
  }
}

CompareView.propTypes = {
  validated: PropTypes.shape({
    originalResultSet: PropTypes.shape({}),
    newResultSet: PropTypes.shape({}),
    newRevision: PropTypes.string,
    originalProject: PropTypes.string,
    newProject: PropTypes.string,
    originalRevision: PropTypes.string,
    projects: PropTypes.arrayOf(PropTypes.shape({})),
    frameworks: PropTypes.arrayOf(PropTypes.shape({})),
    framework: PropTypes.string,
    updateParams: PropTypes.func.isRequired,
  }),
  $stateParams: PropTypes.shape({}),
  $state: PropTypes.shape({}),
};

CompareView.defaultProps = {
  validated: PropTypes.shape({}),
  $stateParams: null,
  $state: null,
};

const requiredParams = new Set([
  'originalProject',
  'newProject',
  'newRevision',
]);

const compareView = withValidation(requiredParams)(CompareView);

perf.component(
  'compareView',
  react2angular(compareView, [], ['$stateParams', '$state']),
);

export default compareView;
