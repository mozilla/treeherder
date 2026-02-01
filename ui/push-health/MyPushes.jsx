import React from 'react';
import {
  Container,
  Row,
  Col,
  DropdownButton,
  Navbar,
  Nav,
} from 'react-bootstrap';

import faviconBroken from '../img/push-health-broken.png';
import faviconOk from '../img/push-health-ok.png';
import { getData } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import {
  createQueryParams,
  parseQueryParams,
  pushEndpoint,
  updateQueryParams,
} from '../helpers/url';
import RepositoryModel from '../models/repository';
import StatusProgress from '../shared/StatusProgress';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorMessages from '../shared/ErrorMessages';
import DropdownMenuItems from '../shared/DropdownMenuItems';
import StatusButton from '../shared/StatusButton';

import { myPushesDefaultMessage } from './helpers';
import CommitHistory from './CommitHistory';

const defaultRepo = 'try';

class MyPushes extends React.Component {
  constructor(props) {
    super(props);

    this.params = parseQueryParams(this.props.location.search);
    this.state = {
      pushMetrics: [],
      repos: [],
      loading: false,
      selectedRepo: defaultRepo,
      displayedUser: this.props.user.email || this.params.author,
    };
  }

  async componentDidMount() {
    const { displayedUser } = this.state;

    this.fetchRepos();

    if (displayedUser) {
      this.fetchMetrics(true);
      // Update the tests every two minutes.
      this.testTimerId = setInterval(() => this.fetchMetrics(), 120000);
    }
  }

  componentDidUpdate(prevProps) {
    const { user } = this.props;
    if (!prevProps.user.isLoggedIn && user.isLoggedIn) {
      const { author } = parseQueryParams(window.location.search);
      const displayedUser = author ?? user.email;

      this.setState({ displayedUser }, () => this.fetchMetrics(true));
      // Update the tests every two minutes.
      this.testTimerId = setInterval(() => this.fetchMetrics(), 120000);
    }
  }

  componentWillUnmount() {
    clearInterval(this.testTimerId);
  }

  formatRevisionHistory = (push) => ({
    parentSha: push.revision,
    id: push.id,
    revisions: push.revisions,
    revisionCount: push.revisions.length,
    currentPush: { author: push.author, push_timestamp: push.push_timestamp },
  });

  async fetchMetrics(loading = false) {
    const { selectedRepo, displayedUser } = this.state;
    const { user, notify, clearNotification, location, navigate } = this.props;
    const params = parseQueryParams(location.search);

    this.setState({ loading });

    if (displayedUser !== params.author) {
      updateQueryParams(`?author=${user.email}`, navigate, location);
    }

    const options = {
      author: displayedUser,
      count: 5,
      with_history: true,
    };
    const stateChanges = { loading: false };

    if (selectedRepo === 'all') {
      options.all_repos = true;
    }

    const { data, failureStatus } = await getData(
      getProjectUrl(
        `${pushEndpoint}health_summary/${createQueryParams(options)}`,
        defaultRepo,
      ),
    );

    // in case this request fails during polling
    clearNotification();

    if (!failureStatus && data.length) {
      stateChanges.pushMetrics = data;
    } else if (failureStatus) {
      notify(`There was a problem retrieving push metrics: ${data}`, 'danger');
    } else {
      notify(
        `Didn't find push data for you in ${selectedRepo}. Try selecting a different option.`,
      );
    }

    this.setState(stateChanges);
  }

  async fetchRepos() {
    const repos = await RepositoryModel.getList();
    this.setState({ repos });
  }

  render() {
    const {
      repos,
      pushMetrics,
      loading,
      failureMessage,
      selectedRepo,
      displayedUser,
    } = this.state;

    const totalNeedInvestigation = pushMetrics.length
      ? pushMetrics
          .map((push) => push.status.testfailed)
          .reduce((total, count) => total + count)
      : 0;

    return (
      <React.Fragment>
        <Navbar variant="light" expand="sm" className="w-100">
          <Nav className="mb-2 pt-2 ps-3 justify-content-between w-100">
            <span />
            <span className="me-3 d-flex">
              <DropdownButton
                variant="secondary"
                title={`${selectedRepo} pushes`}
                size="sm"
              >
                <DropdownMenuItems
                  updateData={(selectedRepo) =>
                    this.setState({ selectedRepo, loading: true }, () =>
                      this.fetchMetrics(true),
                    )
                  }
                  selectedItem={selectedRepo}
                  options={['try', 'all']}
                />
              </DropdownButton>
            </span>
          </Nav>
        </Navbar>
        <link
          rel="shortcut icon"
          href={totalNeedInvestigation > 0 ? faviconBroken : faviconOk}
        />
        <title>{`[${totalNeedInvestigation} failures] Push Health`}</title>
        <Container className="mt-2 mb-5 max-width-default">
          {!displayedUser && (
            <p className="pt-5 text-center font-weight-500 font-size-20">
              {myPushesDefaultMessage}
            </p>
          )}

          {failureMessage && <ErrorMessages failureMessage={failureMessage} />}
          {loading && <LoadingSpinner />}
          {repos.length > 0 &&
            pushMetrics.length > 0 &&
            pushMetrics.map((push) => (
              <Row
                className="mt-5 flex-nowrap justify-content-center"
                key={push.revision}
              >
                <Col md="2" className="ms-2">
                  <StatusProgress counts={push.status} />
                </Col>
                <Col md="5" className="mt-4">
                  <CommitHistory
                    history={this.formatRevisionHistory(push.history[0])}
                    revision={push.revision}
                    currentRepo={repos.find(
                      (repo) => repo.name === push.repository,
                    )}
                    showParent={false}
                  />
                </Col>
                <Col md="1" className="align-self-center mx-5 px-0 pb-4">
                  {push.metrics.linting.result !== 'none' && (
                    <StatusButton
                      title="Linting"
                      status={push.metrics.linting.result}
                      failureCount={push.lintFailureCount}
                      inProgressCount={push.lintingInProgressCount}
                      repo={push.repository}
                      revision={push.revision}
                    />
                  )}
                </Col>
                <Col md="1" className="align-self-center me-5 px-0 pb-4">
                  {push.metrics.builds.result !== 'none' && (
                    <StatusButton
                      title="Builds"
                      status={push.metrics.builds.result}
                      failureCount={push.buildFailureCount}
                      inProgressCount={push.buildInProgressCount}
                      repo={push.repository}
                      revision={push.revision}
                    />
                  )}
                </Col>
                <Col md="1" className="align-self-center px-0 pb-4">
                  {push.metrics.tests.result !== 'none' && (
                    <StatusButton
                      title="Tests"
                      status={push.metrics.tests.result}
                      failureCount={push.testFailureCount}
                      inProgressCount={push.testInProgressCount}
                      repo={push.repository}
                      revision={push.revision}
                    />
                  )}
                </Col>
              </Row>
            ))}
        </Container>
      </React.Fragment>
    );
  }
}

export default MyPushes;
