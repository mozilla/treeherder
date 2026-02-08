import React from 'react';
import { Row, Col, Breadcrumb, BreadcrumbItem } from 'react-bootstrap';
import PropTypes from 'prop-types';
import ReactTable from 'react-table-6';
import Checkbox from '@mui/material/Checkbox';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Popper from '@mui/material/Popper';

import dayjs from '../helpers/dayjs';
import { bugsEndpoint, getBugUrl } from '../helpers/url';
import { setUrlParam, getUrlParam } from '../helpers/location';

import {
  calculateMetrics,
  prettyDate,
  ISODate,
  tableRowStyling,
  regexpFilter,
  tooltipCell,
  textFilter,
} from './helpers';
import withView from './View';
import Layout from './Layout';
import DateRangePicker from './DateRangePicker';

const CustomPopper = (props) => {
  return (
    <Popper
      {...props}
      style={{ width: '350px', textAlign: 'left' }}
      placement="bottom-start"
    />
  );
};

const MainView = (props) => {
  const {
    graphData = [],
    tableData = [],
    initialParamsSet,
    startday,
    endday,
    updateState,
    tree,
    location,
    updateAppState = null,
  } = props;

  const [selectedFilter, setSelectedFilter] = React.useState({
    product: [],
    component: [],
  });

  const autoCompleteFilter = ({ column, onChange }) => {
    const options = [...new Set(tableData.map((d) => d[column.id]))];
    options.sort();
    return (
      <Autocomplete
        slots={{ popper: CustomPopper }}
        size="small"
        multiple
        limitTags={0}
        id="checkboxes-tags-filter"
        options={options}
        onChange={(_event, values) => {
          setUrlParam(column.id, values);
          onChange(values);
          setSelectedFilter({ ...selectedFilter, [column.id]: values });
        }}
        disableCloseOnSelect
        defaultValue={selectedFilter[column.id]}
        fullWidth
        renderOption={(props, option, { selected }) => {
          const { key, ...optionProps } = props;
          return (
            <li key={key} {...optionProps}>
              <Checkbox style={{ marginRight: 8 }} checked={selected} />
              {option}
            </li>
          );
        }}
        renderInput={(params) => (
          <TextField
            style={{
              border: 'none',
              padding: '0',
            }}
            {...params}
          />
        )}
      />
    );
  };

  const columns = [
    {
      Header: 'Count',
      accessor: 'count',
      maxWidth: 60,
      filterable: false,
      className: 'text-right',
      headerClassName: 'text-left',
    },
    {
      Header: 'Bug',
      accessor: 'id',
      headerClassName: 'text-left',
      className: 'text-left',
      width: 90,
      Cell: (props) => (
        <div>
          <a
            className="ms-1"
            target="_blank"
            rel="noopener noreferrer"
            href={`${getBugUrl(props.original.id)}`}
            onClick={(e) => e.stopPropagation()}
            onAuxClick={(e) => {
              // Stop the propagation of middle clicks events to open the bug
              // on bugzilla rather than the bugdetails view.
              if (e.button === 1) {
                e.stopPropagation();
              }
            }}
          >
            {props.original.id}
          </a>
        </div>
      ),
      filterMethod: (filter, row) => {
        if (filter.value) {
          const bugId = row.id.toString();
          return bugId.includes(filter.value);
        }
        return true;
      },
      Filter: (props) =>
        textFilter({
          ...props,
          placeholder: 'Filter by bug ID…',
          columnId: 'id',
        }),
    },
    {
      Header: 'Product',
      accessor: 'product',
      maxWidth: 100,
      className: 'text-left',
      headerClassName: 'text-left',
      Cell: tooltipCell,
      filterMethod: regexpFilter,
      Filter: autoCompleteFilter,
    },
    {
      Header: 'Component',
      accessor: 'component',
      maxWidth: 100,
      className: 'text-left',
      headerClassName: 'text-left',
      Cell: tooltipCell,
      filterMethod: regexpFilter,
      Filter: autoCompleteFilter,
    },
    {
      Header: 'Whiteboard',
      accessor: 'whiteboard',
      width: 150,
      className: 'text-left',
      headerClassName: 'text-left',
      Cell: tooltipCell,
      filterMethod: regexpFilter,
      Filter: (props) =>
        textFilter({
          ...props,
          placeholder: 'Filter by whiteboard…',
          columnId: 'whiteboard',
        }),
    },
    {
      Header: 'Summary',
      accessor: 'summary',
      minWidth: 250,
      className: 'text-left',
      headerClassName: 'text-left',
      Cell: tooltipCell,
      filterMethod: regexpFilter,
      Filter: (props) =>
        textFilter({
          ...props,
          placeholder: 'Filter by summary…',
          columnId: 'summary',
        }),
    },
  ];

  let graphOneData = null;
  let graphTwoData = null;
  let totalFailures = 0;
  let totalRuns = 0;

  if (graphData.length) {
    ({
      graphOneData,
      graphTwoData,
      totalFailures,
      totalRuns,
    } = calculateMetrics(graphData));
  }

  const getHeaderAriaLabel = (_state, _bug, data) => {
    const ariaLabelValue =
      data.Header === 'Count'
        ? 'Filter not available for count'
        : `Type to filter ${data.Header}`;
    return {
      'aria-label': ariaLabelValue,
    };
  };

  const setInitialFiltersFromUrl = () => {
    const filters = [];
    for (const header of ['product', 'component', 'summary', 'whiteboard']) {
      const param = getUrlParam(header);
      if (param) {
        if (header === 'product') {
          filters.push({ id: header, value: param.split(',') });
          if (selectedFilter.product.length === 0) {
            setSelectedFilter({ ...selectedFilter, product: param.split(',') });
          }
        } else if (header === 'component') {
          filters.push({ id: header, value: param.split(',') });
          if (selectedFilter.component.length === 0) {
            setSelectedFilter({
              ...selectedFilter,
              component: param.split(','),
            });
          }
        } else {
          filters.push({ id: header, value: param });
        }
      }
    }
    return filters;
  };

  return (
    <Layout
      {...props}
      graphOneData={graphOneData}
      graphTwoData={graphTwoData}
      header={
        initialParamsSet && (
          <React.Fragment>
            <Row>
              <Col xs="12" className="text-left">
                <Breadcrumb listClassName="bg-white">
                  <BreadcrumbItem>
                    <a title="Treeherder home page" href="/">
                      Treeherder
                    </a>
                  </BreadcrumbItem>
                  <BreadcrumbItem
                    active
                    title="Intermittent Failures View main page"
                  >
                    Main view
                  </BreadcrumbItem>
                </Breadcrumb>
              </Col>
            </Row>
            <Row>
              <Col xs="12" className="mx-auto pt-3">
                <h1>Intermittent Test Failures</h1>
              </Col>
            </Row>
            <Row>
              <Col xs="12" className="mx-auto">
                <p className="subheader">{`${prettyDate(
                  startday,
                )} to ${prettyDate(endday)} UTC`}</p>
              </Col>
            </Row>
            <Row>
              <Col xs="12" className="mx-auto">
                <p className="text-secondary">
                  {totalFailures} bugs in {totalRuns} pushes
                </p>
              </Col>
            </Row>
          </React.Fragment>
        )
      }
      table={
        initialParamsSet && (
          <ReactTable
            data={tableData}
            showPageSizeOptions={false}
            columns={columns}
            className="-striped"
            getTableProps={() => ({ role: 'table' })}
            getTheadFilterThProps={getHeaderAriaLabel}
            getTrProps={(state, rowInfo) => {
              const baseProps = tableRowStyling(state, rowInfo);
              if (rowInfo?.original) {
                const { id, summary } = rowInfo.original;
                const pathname = '/intermittent-failures/bugdetails';
                const search = `?startday=${startday}&endday=${endday}&tree=${tree}&bug=${id}`;

                return {
                  ...baseProps,
                  style: {
                    ...baseProps.style,
                    cursor: 'pointer',
                  },
                  onClick: () => {
                    updateAppState({ graphData, tableData });
                    // Use history.push for proper React Router navigation
                    props.history.push({
                      pathname,
                      search,
                      state: {
                        startday,
                        endday,
                        tree,
                        id,
                        summary,
                        location,
                      },
                    });
                  },
                  onAuxClick: (e) => {
                    if (e.button === 1) {
                      // Middle click
                      e.preventDefault();
                      window.open(`${pathname}${search}`, '_blank');
                    }
                  },
                };
              }
              return baseProps;
            }}
            showPaginationTop
            defaultPageSize={100}
            filterable
            defaultFiltered={setInitialFiltersFromUrl()}
          />
        )
      }
      datePicker={<DateRangePicker updateState={updateState} />}
    />
  );
};

MainView.propTypes = {
  location: PropTypes.shape({}).isRequired,
  tree: PropTypes.string.isRequired,
  updateAppState: PropTypes.func,
  updateState: PropTypes.func.isRequired,
  startday: PropTypes.string.isRequired,
  endday: PropTypes.string.isRequired,
  tableData: PropTypes.arrayOf(PropTypes.shape({})),
  graphData: PropTypes.arrayOf(PropTypes.shape({})),
  initialParamsSet: PropTypes.bool.isRequired,
  user: PropTypes.shape({}),
  setUser: PropTypes.func.isRequired,
  notify: PropTypes.func.isRequired,
};

const defaultState = {
  tree: 'all',
  startday: ISODate(dayjs().utc().subtract(7, 'days')),
  endday: ISODate(dayjs().utc()),
  endpoint: bugsEndpoint,
  route: '/main',
};

export default withView(defaultState)(MainView);
