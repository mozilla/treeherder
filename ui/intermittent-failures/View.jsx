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

import { validateQueryParams, mergeData, formatBugs } from './helpers';

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
      const { startday, endday, tree, bug } = this.state;
      const params = { startday, endday, tree };

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
    lineTrimmer = async (failureLines) => {
      if (failureLines === undefined) {
        return ['', ''];
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
        return [rv, hash];
      });
    };

    getUniqueLines = async (tableData) => {
      const uniqueLogKeys = [];
      const uniqueLogHashes = [];

      const results = tableData.map((td) => this.lineTrimmer(td.lines));
      for (const result of await Promise.all(results)) {
        if (uniqueLogKeys.indexOf(result[1]) === -1) {
          uniqueLogKeys.push(result[1]);
          uniqueLogHashes.push(result);
        }
      }
      return uniqueLogHashes;
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
        uniqueLines,
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
        const { startday, endday, tree, bug } = this.state;
        const params = { startday, endday, tree };

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
      const newProps = { ...this.props, ...this.state, ...updateState };
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
