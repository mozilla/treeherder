import React from 'react';
import {
  Container,
  Row,
  Col,
  UncontrolledButtonDropdown,
  DropdownToggle,
  Navbar,
  Nav,
} from 'reactstrap';
import { Helmet } from 'react-helmet';

import faviconBroken from '../img/push-health-broken.png';
import faviconOk from '../img/push-health-ok.png';
import { getData } from '../helpers/http';
import { getProjectUrl } from '../helpers/location';
import { createQueryParams, pushEndpoint } from '../helpers/url';
import RepositoryModel from '../models/repository';
import StatusProgress from '../shared/StatusProgress';
import LoadingSpinner from '../shared/LoadingSpinner';
import ErrorMessages from '../shared/ErrorMessages';
import DropdownMenuItems from '../shared/DropdownMenuItems';

import StatusButton from './StatusButton';
import CommitHistory from './CommitHistory';

const defaultRepo = 'try';

class MyPushes extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      pushMetrics: [],
      repos: [],
      loading: false,
      selectedRepo: defaultRepo,
    };
  }

  async componentDidMount() {
    this.fetchRepos();
    // if (this.props.user.isLoggedIn) {
    this.fetchMetrics(true);
    // Update the tests every two minutes.
    this.testTimerId = setInterval(() => this.fetchMetrics(), 120000);
    // }
  }

  componentDidUpdate(prevProps) {
    if (!prevProps.user.isLoggedIn && this.props.user.isLoggedIn) {
      this.fetchMetrics(true);
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
    const { selectedRepo } = this.state;
    const { user, notify, clearNotification } = this.props;

    this.setState({ loading });

    const options = {
      author: 'ccoroiu@mozilla.com',
      count: 3,
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
    } else {
      notify(`There was a problem retrieving push metrics: ${data}`, 'danger');
    }

    this.setState(stateChanges);
  }

  async fetchRepos() {
    const repos = await RepositoryModel.getList();
    this.setState({ repos });
  }

  render() {
    const { user } = this.props;
    const {
      repos,
      pushMetrics,
      loading,
      failureMessage,
      selectedRepo,
    } = this.state;

    const totalNeedInvestigation = pushMetrics.length
      ? pushMetrics
          .map((push) => push.needInvestigation)
          .reduce((total, count) => total + count)
      : 0;

    return (
      <React.Fragment>
        <Navbar color="light" light expand="sm" className="w-100">
          <Nav className="mb-2 pt-2 pl-3 justify-content-between w-100">
            <span />
            <span className="mr-3 d-flex">
              <UncontrolledButtonDropdown>
                <DropdownToggle
                  caret
                  size="sm"
                >{`${selectedRepo} pushes`}</DropdownToggle>
                <DropdownMenuItems
                  updateData={(selectedRepo) =>
                    this.setState({ selectedRepo, loading: true }, () =>
                      this.fetchMetrics(true),
                    )
                  }
                  selectedItem={selectedRepo}
                  options={['try', 'all']}
                />
              </UncontrolledButtonDropdown>
            </span>
          </Nav>
        </Navbar>
        <Helmet>
          <link
            rel="shortcut icon"
            href={totalNeedInvestigation > 0 ? faviconBroken : faviconOk}
          />
          <title>{`[${totalNeedInvestigation} failures] Push Health`}</title>
        </Helmet>
        <Container className="mt-2 mb-5 max-width-default">
          {/* {!user.isLoggedIn && (
          <h2 className="pt-5 text-center">
            Please log in to see your pushes
          </h2>
        )} */}

          {failureMessage && <ErrorMessages failureMessage={failureMessage} />}
          {loading && <LoadingSpinner />}
          {repos.length > 0 &&
            pushMetrics.length > 0 &&
            pushMetrics.map((push) => (
              <Row
                className="mt-5 flex-nowrap justify-content-center"
                key={push.revision}
              >
                <Col sm="2" className="ml-5">
                  <StatusProgress counts={push.status} />
                </Col>
                <Col sm="6" className="mt-4 ml-2">
                  <CommitHistory
                    history={this.formatRevisionHistory(push.history[0])}
                    revision={push.revision}
                    currentRepo={repos.find(
                      (repo) => repo.name === push.repository,
                    )}
                    showParent={false}
                  />
                </Col>
                <Col lg="1" xl="2" className="align-self-center ml-5 px-0 pb-4">
                  <StatusButton
                    title="Linting"
                    result={push.metrics.linting.result}
                    count={push.lintFailureCount}
                    repo={push.repository}
                    revision={push.revision}
                  />
                </Col>
                <Col lg="1" xl="2" className="align-self-center mr-2 px-0 pb-4">
                  <StatusButton
                    title="Builds"
                    result={push.metrics.builds.result}
                    count={push.buildFailureCount}
                    repo={push.repository}
                    revision={push.revision}
                  />
                </Col>
                <Col lg="1" xl="2" className="align-self-center px-0 pb-4">
                  <StatusButton
                    title="Tests"
                    result={push.metrics.tests.result}
                    count={push.testFailureCount}
                    repo={push.repository}
                    revision={push.revision}
                  />
                </Col>
              </Row>
            ))}
        </Container>
      </React.Fragment>
    );
  }
}

export default MyPushes;
