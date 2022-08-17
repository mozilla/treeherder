import moment from 'moment';
import React from 'react';
import PropTypes from 'prop-types';

import {
  graphsEndpoint,
  parseQueryParams,
  createQueryParams,
  createApiUrl,
  bugzillaBugsApi,
  updateQueryParams,
} from '../helpers/url';
import { getData } from '../helpers/http';

import { validateQueryParams, mergeData, formatBugs, ISODate } from './helpers';

const withView = (defaultState) => (WrappedComponent) => {
  class View extends React.Component {
    constructor(props) {
      super(props);

      this.default = this.props.location.state || defaultState;
      this.state = {
        errorMessages: [],
        initialParamsSet: false,
        tree: this.default.tree || null,
        startday: this.default.startday || null,
        endday: this.default.endday || null,
        failurehash: this.default.failurehash || 'all',
        bug: this.default.id || null,
        summary: this.default.summary || null,
        tableData: [],
        tableFailureStatus: null,
        isFetchingTable: false,
        graphData: [],
        graphFailureStatus: null,
        isFetchingGraphs: false,
        lastLocation: this.default.location || null,
      };
    }

    componentDidMount() {
      this.setQueryParams();
    }

    setQueryParams = () => {
      const { location, history } = this.props;
      const { startday, endday, tree, failurehash, bug } = this.state;
      const params = { startday, endday, tree, failurehash };

      if (bug) {
        params.bug = bug;
      }

      if (location.search !== '' && !location.state) {
        // update data based on the params or show error if params are missing
        this.checkQueryValidation(parseQueryParams(location.search));
      } else {
        // if the query params are not specified for mainview, set params based on default state
        if (location.search === '') {
          const queryString = createQueryParams(params);
          updateQueryParams(queryString, history, location);
        }

        this.setState({ initialParamsSet: true });
        this.getGraphData(createApiUrl(graphsEndpoint, params));
        this.getTableData(createApiUrl(defaultState.endpoint, params));
      }
    };

    getBugDetails = async (url) => {
      const { data, failureStatus } = await getData(url);
      if (!failureStatus && data.bugs.length === 1) {
        this.setState({ summary: data.bugs[0].summary });
      }
    };

    hashMessage = async (message) => {
      const encodedBytes = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', encodedBytes);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((bytes) => bytes.toString(16).padStart(2, '0'))
        .join('');
      return hashHex;
    };

    // trim off the timestamp and "TEST-UNEXPECTED-XXX | "
    lineTrimmer = async (failureLines, pushTime) => {
      if (failureLines === undefined) {
        return ['', '', pushTime];
      }
      if (typeof failureLines === 'string') {
        failureLines = failureLines.split('\n');
      }
      const lines = failureLines.map((i) => i.split('\n'));

      const trimmedLines = lines.map((line) => {
        const parts = line.toString().split(' | ');
        if (parts.length > 2) {
          parts.shift();
        }
        return parts.join(' | ');
      });
      const rv = trimmedLines.join('\n');
      return this.hashMessage(rv).then((hash) => {
        return [rv, hash, pushTime];
      });
    };

    getUniqueLines = async (tableData) => {
      const { startday, endday } = this.state;

      const uniqueLogKeys = [];
      const uniqueLogHashes = [];
      const uniqueFrequency = {};

      const results = tableData.map((td) =>
        this.lineTrimmer(td.lines, td.push_time),
      );
      for (const result of await Promise.all(results)) {
        const hash = result[1];
        if (hash === "") {
          continue;
        }
        if (uniqueLogKeys.indexOf(hash) === -1) {
          uniqueLogKeys.push(hash);
          uniqueLogHashes.push([result[0], hash]);

          uniqueFrequency[hash] = [
            { data: [], color: 'red', dates: {}, datemap: {}, count: 0 },
          ];
          let start = ISODate(moment(startday).utc());
          const end = ISODate(moment(endday).utc());
          // create entry for each date in range so graph looks nice.
          while (start <= end) {
            const sdate = moment(start).format('MMM DD');
            uniqueFrequency[hash][0].dates[sdate] = 0;
            uniqueFrequency[hash][0].datemap[sdate] = start;
            start = ISODate(moment(start).utc().add(1, 'days'));
          }
        }

        // store frequency data by date to use in graphs, etc.
        const date = result[2].split(' ')[0];
        const sdate = moment(date).format('MMM DD');
        if (!(date in uniqueFrequency[hash][0].dates)) {
          uniqueFrequency[hash][0].dates[sdate] = 0;
        }
        uniqueFrequency[hash][0].dates[sdate] += 1;
        uniqueFrequency[hash][0].count += 1;
      }

      // convert data to a graph friendly format
      uniqueLogKeys.forEach((hval) => {
        const dates = Object.keys(uniqueFrequency[hval][0].dates);
        dates.sort();
        dates.forEach((date) => {
          const counter = uniqueFrequency[hval][0].dates[date];
          uniqueFrequency[hval][0].data.push({
            date,
            failurePerPush: counter,
            x: uniqueFrequency[hval][0].datemap[date],
            y: counter,
          });
        });
      });
      return [uniqueLogHashes, uniqueFrequency];
    };

    getTableData = async (url) => {
      this.setState({ tableFailureStatus: null, isFetchingTable: true });
      const { data, failureStatus } = await getData(url);
      let mergedData = null;

      if (defaultState.route === '/main' && !failureStatus && data.length) {
        const bugIds = formatBugs(data);
        const bugzillaData = await this.batchBugRequests(bugIds);
        mergedData = mergeData(data, bugzillaData);
      }

      const uniqueLines = await this.getUniqueLines(mergedData || data);

      this.setState({
        tableData: mergedData || data,
        tableFailureStatus: failureStatus,
        isFetchingTable: false,
        uniqueLines: uniqueLines[0],
        uniqueFrequency: uniqueLines[1],
      });
    };

    getGraphData = async (url) => {
      this.setState({ graphFailureStatus: null, isFetchingGraphs: true });
      const { data, failureStatus } = await getData(url);
      this.setState({
        graphData: data,
        graphFailureStatus: failureStatus,
        isFetchingGraphs: false,
      });
    };

    batchBugRequests = async (bugIds) => {
      const urlParams = {
        include_fields: 'id,product,component,status,summary,whiteboard',
      };
      // TODO: bump up the max to ~1200 when this bug is fixed:
      // https://bugzilla.mozilla.org/show_bug.cgi?id=1497721
      let min = 0;
      let max = 800;
      let bugsList = [];
      const results = [];

      while (bugIds.length >= min) {
        const batch = bugIds.slice(min, max + 1);
        urlParams.id = batch.join();
        results.push(getData(bugzillaBugsApi('bug', urlParams)));

        min = max;
        max += 800;
      }

      for (const result of await Promise.all(results)) {
        bugsList = [...bugsList, ...result.data.bugs];
      }
      return bugsList;
    };

    updateState = (updatedObj) => {
      this.setState(updatedObj, () => {
        const { startday, endday, tree, failurehash, bug } = this.state;
        const params = { startday, endday, tree, failurehash };

        if (bug) {
          params.bug = bug;
        }

        this.getGraphData(createApiUrl(graphsEndpoint, params));
        this.getTableData(createApiUrl(defaultState.endpoint, params));

        // update query params if dates or tree are updated
        const queryString = createQueryParams(params);
        updateQueryParams(queryString, this.props.history, this.props.location);
      });
    };

    updateHash = (hashVal) => {
      this.setState({ failurehash: hashVal }, () => {
        const { startday, endday, tree, failurehash, bug } = this.state;
        const params = { startday, endday, tree, failurehash };

        if (bug) {
          params.bug = bug;
        }

        // update query params if dates or tree are updated
        const queryString = createQueryParams(params);
        updateQueryParams(queryString, this.props.history, this.props.location);
      });
    };

    updateData = (params, urlChanged = false) => {
      const { mainGraphData, mainTableData } = this.props;

      if (mainGraphData && mainTableData && !urlChanged) {
        this.setState({ graphData: mainGraphData, tableData: mainTableData });
      } else {
        this.getGraphData(createApiUrl(graphsEndpoint, params));
        this.getTableData(createApiUrl(defaultState.endpoint, params));
      }

      if (params.bug) {
        this.getBugDetails(
          bugzillaBugsApi('bug', { include_fields: 'summary', id: params.bug }),
        );
      }
    };

    checkQueryValidation = (params, urlChanged = false) => {
      const { errorMessages, initialParamsSet, summary } = this.state;
      const messages = validateQueryParams(
        params,
        defaultState.route === '/bugdetails',
      );
      const updates = {};

      if (messages.length > 0) {
        this.setState({ errorMessages: messages });
      } else {
        if (errorMessages.length) {
          updates.errorMessages = [];
        }
        if (!initialParamsSet) {
          updates.initialParamsSet = true;
        }
        if (summary) {
          // reset summary
          updates.summary = null;
        }

        this.setState({ ...updates, ...params });
        this.updateData(params, urlChanged);
      }
    };

    render() {
      const updateState = { updateState: this.updateState };
      const updateHash = { updateHash: this.updateHash };
      const newProps = {
        ...this.props,
        ...this.state,
        ...updateState,
        ...updateHash,
      };
      return <WrappedComponent {...newProps} />;
    }
  }

  View.propTypes = {
    history: PropTypes.shape({}).isRequired,
    location: PropTypes.shape({
      search: PropTypes.string,
      state: PropTypes.shape({}),
    }).isRequired,
    mainGraphData: PropTypes.arrayOf(PropTypes.shape({})),
    mainTableData: PropTypes.arrayOf(PropTypes.shape({})),
  };

  View.defaultProps = {
    mainGraphData: null,
    mainTableData: null,
  };

  return View;
};

export default withView;
