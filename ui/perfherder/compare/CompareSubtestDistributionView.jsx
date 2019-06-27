import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { react2angular } from 'react2angular/index.es2015';
import { Container, Row } from 'reactstrap';

import perf from '../../js/perf';
import RepositoryModel from '../../models/repository';
import PushModel from '../../models/push';
import { getData } from '../../helpers/http';
import { createApiUrl, perfSummaryEndpoint } from '../../helpers/url';

import RevisionInformation from './RevisionInformation';
import ReplicatesGraph from './ReplicatesGraph';

// TODO remove $stateParams after switching to react router
export default class CompareSubtestDistributionView extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      dataLoading: true,
      originalProject: null,
      newProject: null,
    };
  }

  async componentDidMount() {
    const { $stateParams } = this.props;
    const {
      originalProject: originalProjectName,
      originalSubtestSignature,
      originalRevision,
      newRevision,
      newProject: newProjectName,
    } = $stateParams;
    const { originalProject, newProject } = await this.fetchProjectsToCompare(
      originalProjectName,
      newProjectName,
    );

    const {
      testSuite,
      subtest,
      testName,
      platform,
    } = await this.fetchTestCharacteristics(
      originalProjectName,
      originalRevision,
      originalSubtestSignature,
    );
    this.setState({
      filters: { testSuite, subtest },
      testName,
      platform,
      originalProject,
      newProject,
    });
    const syncPromises = this.syncResultSets(
      originalProject,
      originalRevision,
      newProject,
      newRevision,
    );

    Promise.all(syncPromises).then(() => {
      const { platform, testName } = this.state;
      window.document.title = `${platform}: ${testName}`;
      this.setState({ dataLoading: false });
    });
  }

  syncProjectResultSet = async (projectName, revision, resultSetField) => {
    const { data } = await PushModel.getList({
      repo: projectName,
      commit_revision: revision,
    });
    const { results: pushPatch } = data;
    const [first] = pushPatch;

    return this.setState({
      [resultSetField]: first,
    });
  };

  syncResultSets = (
    originalProject,
    originalRevision,
    newProject,
    newRevision,
  ) => {
    const originalSyncPromise = this.syncProjectResultSet(
      originalProject.name,
      originalRevision,
      'originalResultSet',
    );
    const newSyncPromise = this.syncProjectResultSet(
      newProject.name,
      newRevision,
      'newResultSet',
    );
    return [originalSyncPromise, newSyncPromise];
  };

  fetchAllRepositories = async () => {
    const loadRepositories = RepositoryModel.getList();
    const results = await Promise.all([loadRepositories]);
    return results[0];
  };

  fetchProjectsToCompare = async (originalProjectName, newProjectName) => {
    const allRepos = await this.fetchAllRepositories();

    const originalProject = RepositoryModel.getRepo(
      originalProjectName,
      allRepos,
    );
    const newProject = RepositoryModel.getRepo(newProjectName, allRepos);
    return { originalProject, newProject };
  };

  fetchTestCharacteristics = async (
    originalProjectName,
    originalRevision,
    originalSubtestSignature,
  ) => {
    const seriesData = await getData(
      createApiUrl(perfSummaryEndpoint, {
        repository: originalProjectName,
        revision: originalRevision,
        signature: originalSubtestSignature,
      }),
    );

    const {
      suite: testSuite,
      test: subtest,
      name: testName,
      platform,
    } = seriesData.data[0];

    return { testSuite, subtest, testName, platform };
  };

  render() {
    const {
      originalProject,
      newProject,
      originalResultSet,
      newResultSet,
      dataLoading,
      platform,
      testName,
      filters,
    } = this.state;
    const { $stateParams } = this.props;
    const {
      originalRevision,
      newRevision,
      originalSubtestSignature,
      newSubtestSignature,
    } = $stateParams;

    return (
      originalRevision &&
      newRevision && (
        <Container fluid className="max-width-default justify-content-center">
          {dataLoading ? (
            <div className="loading" aria-label="loading">
              <FontAwesomeIcon
                icon={faCog}
                size="4x"
                spin
                title="loading page, please wait"
              />
            </div>
          ) : (
            <Row className="justify-content-center mt-4">
              <React.Fragment>
                <h2>
                  {platform}: {testName} replicate distribution
                </h2>
                <RevisionInformation
                  originalProject={originalProject.name}
                  originalRevision={originalRevision}
                  originalResultSet={originalResultSet}
                  newProject={newProject.name}
                  newRevision={newRevision}
                  newResultSet={newResultSet}
                />
              </React.Fragment>
              <div className="pt-5">
                <ReplicatesGraph
                  title="Base"
                  projectName={originalProject.name}
                  revision={originalRevision}
                  subtestSignature={originalSubtestSignature}
                  filters={filters}
                />
                <ReplicatesGraph
                  title="New"
                  projectName={newProject.name}
                  revision={newRevision}
                  subtestSignature={newSubtestSignature}
                  filters={filters}
                />
              </div>
            </Row>
          )}
        </Container>
      )
    );
  }
}

CompareSubtestDistributionView.propTypes = {
  $stateParams: PropTypes.shape({
    originalProject: PropTypes.string,
    newProject: PropTypes.string,
    originalRevision: PropTypes.string,
    newRevision: PropTypes.string,
    originalResultSet: PropTypes.object,
    newResultSet: PropTypes.object,
    originalSubtestSignature: PropTypes.string,
    newSubtestSignature: PropTypes.string,
  }).isRequired,
};

perf.component(
  'compareSubtestDistributionView',
  react2angular(CompareSubtestDistributionView, [], ['$stateParams']),
);
