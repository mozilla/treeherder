
import PropTypes from 'prop-types';
import { Container } from 'react-bootstrap';
import ReactTable from 'react-table-6';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowAltCircleUp,
  faArrowAltCircleDown,
  faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons';

import { noResultsMessage } from '../perf-helpers/constants';
import { Perfdocs, perfViews } from '../perf-helpers/perfdocs';
import SimpleTooltip from '../../shared/SimpleTooltip';

import ItemList from './ItemList';
import PlatformList from './PlatformList';
import AlertsLink from './AlertsLink';

export default function TestsTable(props) {
  const {
    results = [],
    framework,
    allFrameworks,
    projectsMap,
    platformsMap,
    defaultPageSize = 20,
  } = props;

  const showPagination = results.length > defaultPageSize;
  const headerStyle = {
    background: 'lightgray',
    fontWeight: 'bold',
    paddingTop: 10,
    paddingBottom: 10,
  };

  const columns = [
    {
      headerStyle,
      columns: [
        {
          headerStyle,
          Header: 'Suite',
          accessor: 'suite',
          Cell: ({ row }) => {
            const perfdocs = new Perfdocs(framework, row.suite);
            const hasDocumentation = perfdocs.hasDocumentation(
              perfViews.testsView,
            );
            return (
              <div>
                {hasDocumentation ? (
                  <a
                    href={perfdocs.documentationURL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {row.suite}
                  </a>
                ) : (
                  <div>{row.suite}</div>
                )}
              </div>
            );
          },
        },
        {
          headerStyle,
          Header: 'Test Name',
          accessor: 'test',
        },
        {
          headerStyle,
          Header: 'Platforms',
          accessor: 'platforms',
          Cell: (props) => {
            if (platformsMap) {
              const platforms = props.value.map((id) => platformsMap[id]);
              return <PlatformList items={platforms} />;
            }
            return null;
          },
          width: 300,
          style: { textAlign: 'center' },
          sortable: false,
        },
        {
          headerStyle,
          Header: 'Projects',
          accessor: 'repositories',
          Cell: (props) => {
            if (projectsMap) {
              const repositories = props.value.map((id) => projectsMap[id]);
              return <ItemList items={repositories} />;
            }
            return null;
          },
          width: 300,
          style: { textAlign: 'center' },
          sortable: false,
        },
      ],
      width: 400,
      style: { textAlign: 'center' },
    },
    {
      headerStyle,
      Header: 'Alerts',
      columns: [
        {
          headerStyle,
          Header: () => (
            <SimpleTooltip
              tooltipText="Improvements"
              text={
                <FontAwesomeIcon
                  icon={faArrowAltCircleUp}
                  className="text-success"
                />
              }
            />
          ),
          accessor: 'total_alerts',
          Cell: (props) => {
            const { original } = props;
            return (
              <AlertsLink
                alerts={original}
                framework={framework}
                allFrameworks={allFrameworks}
                type="improvements"
              />
            );
          },
          width: 50,
          style: { textAlign: 'center' },
          sortable: false,
        },
        {
          headerStyle,
          Header: () => (
            <SimpleTooltip
              tooltipText="Regressions"
              text={
                <FontAwesomeIcon
                  icon={faArrowAltCircleDown}
                  className="text-danger"
                />
              }
            />
          ),
          accessor: 'total_regressions',
          Cell: (props) => {
            const { original } = props;
            return (
              <AlertsLink
                alerts={original}
                framework={framework}
                allFrameworks={allFrameworks}
                type="regressions"
              />
            );
          },
          width: 50,
          style: { textAlign: 'center' },
          sortable: false,
        },
        {
          headerStyle,
          Header: () => (
            <SimpleTooltip
              tooltipText="Untriaged alerts"
              text={<FontAwesomeIcon icon={faQuestionCircle} />}
            />
          ),
          accessor: 'total_untriaged',
          Cell: (props) => {
            const { original } = props;
            return (
              <AlertsLink
                alerts={original}
                framework={framework}
                allFrameworks={allFrameworks}
                type="untriaged"
              />
            );
          },
          width: 50,
          style: { textAlign: 'center' },
          sortable: false,
        },
      ],
      width: 100,
      style: { textAlign: 'center' },
    },
  ];

  return (
    <Container fluid className="my-3 px-0 vh-100">
      <ReactTable
        data={results}
        columns={columns}
        className="-striped -highlight mb-5 h-100 tests-table"
        noDataText={noResultsMessage}
        defaultPageSize={defaultPageSize}
        showPagination={showPagination}
        showPaginationTop={showPagination}
      />
    </Container>
  );
}

TestsTable.propTypes = {
  results: PropTypes.arrayOf(PropTypes.shape({})),
  defaultPageSize: PropTypes.number,
  projectsMap: PropTypes.oneOfType([PropTypes.bool, PropTypes.shape({})])
    .isRequired,
  platformsMap: PropTypes.oneOfType([PropTypes.bool, PropTypes.shape({})])
    .isRequired,
};
