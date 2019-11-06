import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Container, Spinner } from 'reactstrap';
import ReactTable from 'react-table';

import { noResultsMessage } from '../constants';

import BadgeList from './BadgeList';

export default class HealthTable extends React.Component {
  getAlertsLabelColor = alertsNumber => {
    let labelColor = 'success';

    if (alertsNumber > 0 && alertsNumber < 10) {
      labelColor = 'warning';
    } else if (alertsNumber >= 10) {
      labelColor = 'danger';
    }

    return labelColor;
  };

  render() {
    const { results, projectsMap, platformsMap, defaultPageSize } = this.props;

    const showPagination = results.length > defaultPageSize ? true : false;

    const columns = [
      {
        Header: 'Suite',
        accessor: 'suite',
      },
      {
        Header: 'Test Name',
        accessor: 'test',
      },
      {
        Header: 'Platforms',
        accessor: 'platforms',
        Cell: props => {
          if (platformsMap) {
            const platforms = props.value.map(id => platformsMap[id]);
            return <BadgeList items={platforms} color="info" />;
          }
          return <Spinner color="info" />;
        },
        width: 250,
        style: { textAlign: 'center' },
        sortable: false,
      },
      {
        Header: 'Repositories',
        accessor: 'repositories',
        Cell: props => {
          if (projectsMap) {
            const repositories = props.value.map(id => projectsMap[id]);
            return <BadgeList items={repositories} />;
          }
          return <Spinner color="secondary" />;
        },
        width: 250,
        style: { textAlign: 'center' },
        sortable: false,
      },
      {
        Header: 'Total Alerts',
        accessor: 'total_alerts',
        Cell: props => (
          <Badge color={this.getAlertsLabelColor(props.value)}>
            {props.value}
          </Badge>
        ),
        width: 100,
        style: { textAlign: 'center' },
      },
    ];

    return (
      <Container fluid className="my-3 px-0">
        <ReactTable
          data={results}
          columns={columns}
          className="-striped -highlight"
          noDataText={noResultsMessage}
          defaultPageSize={defaultPageSize}
          showPagination={showPagination}
        />
      </Container>
    );
  }
}

HealthTable.propTypes = {
  results: PropTypes.arrayOf(PropTypes.shape({})),
  defaultPageSize: PropTypes.number,
  projectsMap: PropTypes.oneOfType([PropTypes.bool, PropTypes.shape({})])
    .isRequired,
  platformsMap: PropTypes.oneOfType([PropTypes.bool, PropTypes.shape({})])
    .isRequired,
};

HealthTable.defaultProps = {
  results: [],
  defaultPageSize: 20,
};
