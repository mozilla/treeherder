import React from 'react';
import { Container, Row } from 'reactstrap';

import RepositoryModel from '../../models/repository';
import PushModel from '../../models/push';
import { getData } from '../../helpers/http';
import { createApiUrl, parseQueryParams } from '../../helpers/url';
import { endpoints } from '../constants';
import LoadingSpinner from '../../shared/LoadingSpinner';

import RevisionInformation from './RevisionInformation';
import ReplicatesGraph from './ReplicatesGraph';

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
    const {
      originalProject: originalProjectName,
      originalSubtestSignature,
      originalRevision,
      newRevision,
      newProject: newProjectName,
    } = parseQueryParams(this.props.location.search);

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
      window.document.title = `${this.state.platform}: ${this.state.testName}`;
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

  fetchProjectsToCompare = async (originalProjectName, newProjectName) => {
    const { projects } = this.props;

    const originalProject = RepositoryModel.getRepo(
      originalProjectName,
      projects,
    );
    const newProject = RepositoryModel.getRepo(newProjectName, projects);
    return { originalProject, newProject };
  };

  fetchTestCharacteristics = async (
    originalProjectName,
    originalRevision,
    originalSubtestSignature,
  ) => {
    const seriesData = await getData(
      createApiUrl(endpoints.summary, {
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
    } = this.state;
    const {
      originalRevision,
      newRevision,
      originalSubtestSignature,
      newSubtestSignature,
    } = parseQueryParams(this.props.location.search);

    return (
      originalRevision &&
      newRevision && (
        <Container fluid className="max-width-default justify-content-center">
          {dataLoading ? (
            <LoadingSpinner />
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
                  project={originalProject}
                  revision={originalRevision}
                  subtestSignature={originalSubtestSignature}
                  filters={this.state.filters}
                />
                <ReplicatesGraph
                  title="New"
                  project={newProject}
                  revision={newRevision}
                  subtestSignature={newSubtestSignature}
                  filters={this.state.filters}
                />
              </div>
            </Row>
          )}
        </Container>
      )
    );
  }
}
