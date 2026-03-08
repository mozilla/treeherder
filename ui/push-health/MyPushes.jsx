import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

function MyPushes({ user, notify, clearNotification }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [pushMetrics, setPushMetrics] = useState([]);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(defaultRepo);
  const [failureMessage] = useState(null);
  const [displayedUser, setDisplayedUser] = useState(() => {
    const params = parseQueryParams(location.search);
    return user.email || params.author;
  });

  const testTimerRef = useRef(null);

  // Refs for latest values in async callbacks / intervals
  const selectedRepoRef = useRef(selectedRepo);
  selectedRepoRef.current = selectedRepo;
  const displayedUserRef = useRef(displayedUser);
  displayedUserRef.current = displayedUser;
  const userRef = useRef(user);
  userRef.current = user;
  const locationRef = useRef(location);
  locationRef.current = location;

  const fetchMetrics = useCallback(
    async (showLoading = false, repoOverride) => {
      const currentRepo = repoOverride ?? selectedRepoRef.current;
      const currentUser = displayedUserRef.current;
      const currentLocation = locationRef.current;
      const params = parseQueryParams(currentLocation.search);

      setLoading(showLoading);

      if (currentUser !== params.author) {
        updateQueryParams(
          `?author=${userRef.current.email}`,
          navigate,
          currentLocation,
        );
      }

      const options = {
        author: currentUser,
        count: 5,
        with_history: true,
      };

      if (currentRepo === 'all') {
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
        setPushMetrics(data);
      } else if (failureStatus) {
        notify(
          `There was a problem retrieving push metrics: ${data}`,
          'danger',
        );
      } else {
        notify(
          `Didn't find push data for you in ${currentRepo}. Try selecting a different option.`,
        );
      }

      setLoading(false);
    },
    [navigate, clearNotification, notify],
  );

  // componentDidMount
  useEffect(() => {
    RepositoryModel.getList().then(setRepos);

    if (displayedUser) {
      fetchMetrics(true);
      testTimerRef.current = setInterval(() => fetchMetrics(), 120000);
    }

    return () => clearInterval(testTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // componentDidUpdate - detect user login
  const prevIsLoggedIn = useRef(user.isLoggedIn);
  useEffect(() => {
    if (!prevIsLoggedIn.current && user.isLoggedIn) {
      const { author } = parseQueryParams(window.location.search);
      const newDisplayedUser = author ?? user.email;

      setDisplayedUser(newDisplayedUser);
      displayedUserRef.current = newDisplayedUser;
      fetchMetrics(true);
      clearInterval(testTimerRef.current);
      testTimerRef.current = setInterval(() => fetchMetrics(), 120000);
    }
    prevIsLoggedIn.current = user.isLoggedIn;
  }, [user.isLoggedIn, user.email, fetchMetrics]);

  const formatRevisionHistory = (push) => ({
    parentSha: push.revision,
    id: push.id,
    revisions: push.revisions,
    revisionCount: push.revisions.length,
    currentPush: { author: push.author, push_timestamp: push.push_timestamp },
  });

  const handleRepoChange = (newRepo) => {
    setSelectedRepo(newRepo);
    selectedRepoRef.current = newRepo;
    setLoading(true);
    fetchMetrics(true, newRepo);
  };

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
                updateData={handleRepoChange}
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
                  history={formatRevisionHistory(push.history[0])}
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

export default MyPushes;
