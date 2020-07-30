import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Spinner from 'reactstrap/es/Spinner';
import { FixedSizeList as List } from 'react-window';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import trimStart from 'lodash/trimStart';

import { fetchGeckoDecisionArtifact } from '../helpers/taskcluster';

import { filterPaths } from './helpers';

class PassingPaths extends Component {
  constructor(props) {
    super(props);

    this.state = {
      paths: null,
      filteredPaths: [],
    };
  }

  async componentDidMount() {
    const { revision, currentRepo, searchStr } = this.props;
    const manifestByTask = await fetchGeckoDecisionArtifact(
      currentRepo.name,
      revision,
      'manifests-by-task.json.gz',
    );
    const uniquePaths = [
      ...new Set(
        Object.values(manifestByTask).reduce(
          (manArr, acc) => [...acc, ...manArr],
          [],
        ),
      ),
    ];
    const paths = uniquePaths.map((path) => trimStart(path, '/'));
    const filteredPaths = searchStr ? filterPaths(paths, searchStr) : paths;

    filteredPaths.sort();
    this.setState({ paths, filteredPaths });
  }

  shouldComponentUpdate(nextProps, nextState) {
    const { searchStr } = this.props;
    const { paths } = this.state;

    return nextProps.searchStr !== searchStr || nextState.paths !== paths;
  }

  static getDerivedStateFromProps(props, state) {
    const { paths } = state;
    const pathsToFilter = paths || [];
    const { searchStr } = props;
    const filteredPaths = searchStr
      ? filterPaths(pathsToFilter, searchStr)
      : pathsToFilter;

    filteredPaths.sort();
    return { filteredPaths };
  }

  passingPath = ({ index, style }) => {
    const { filteredPaths } = this.state;

    return <div style={style}>{filteredPaths[index]}</div>;
  };

  render() {
    const { paths, filteredPaths } = this.state;

    return paths ? (
      <List
        height={500}
        width="100%"
        itemData={filteredPaths}
        itemSize={25}
        itemCount={filteredPaths.length}
        name="Passing Paths"
        icon={faCheck}
        iconColor="success"
        expanded={false}
        className="ml-4 border-secondary border-bottom border-top"
      >
        {this.passingPath}
      </List>
    ) : (
      <Spinner />
    );
  }
}

PassingPaths.propTypes = {
  revision: PropTypes.string.isRequired,
  currentRepo: PropTypes.shape({}).isRequired,
  searchStr: PropTypes.string,
};

PassingPaths.defaultProps = {
  searchStr: '',
};

export default PassingPaths;
