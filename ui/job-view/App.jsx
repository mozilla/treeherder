import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Modal } from 'react-bootstrap';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { useSelector, useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';

import { thFavicons, thDefaultRepo, thEvents } from '../helpers/constants';
import ShortcutTable from '../shared/ShortcutTable';
import { matchesDefaults, hasUrlFilterChanges } from '../helpers/filter';
import { getAllUrlParams } from '../helpers/location';
import { MAX_TRANSIENT_AGE } from '../helpers/notifications';
import {
  deployedRevisionUrl,
  parseQueryParams,
  createQueryParams,
  getApiUrl,
  getLandoJobsUrl,
} from '../helpers/url';
import ClassificationTypeModel from '../models/classificationType';
import FilterModel from '../models/filter';
import RepositoryModel from '../models/repository';
import { getData } from '../helpers/http';
import { endpoints } from '../perfherder/perf-helpers/constants';

import Notifications from './Notifications';
import PrimaryNavBar from './headerbars/PrimaryNavBar';
import ActiveFilters from './headerbars/ActiveFilters';
import UpdateAvailable from './headerbars/UpdateAvailable';
import DetailsPanel from './details/DetailsPanel';
import PushList from './pushes/PushList';
import KeyboardShortcuts from './KeyboardShortcuts';
import { clearExpiredNotifications } from './redux/stores/notifications';
import { fetchPushes } from './redux/stores/pushes';

import '../css/treeherder.css';
import '../css/treeherder-navbar-panels.css';
import '../css/treeherder-notifications.css';
import '../css/treeherder-details-panel.css';
import '../css/failure-summary.css';
import '../css/treeherder-job-buttons.css';
import '../css/treeherder-pushes.css';
import '../css/treeherder-pinboard.css';
import '../css/treeherder-bugfiler.css';
import '../css/treeherder-fuzzyfinder.css';
import '../css/treeherder-loading-overlay.css';

const DEFAULT_DETAILS_PCT = 40;
const REVISION_POLL_INTERVAL = 1000 * 60 * 5;
const REVISION_POLL_DELAYED_INTERVAL = 1000 * 60 * 60;
const LANDO_POLL_INTERVAL = 1000 * 60;
const HIDDEN_URL_PARAMS = [
  'repo',
  'classifiedState',
  'resultStatus',
  'selectedTaskRun',
  'searchStr',
  'collapsedPushes',
];

const getWindowHeight = () => {
  const windowHeight = window.innerHeight;
  const navBar = document.getElementById('th-global-navbar');
  const navBarHeight = navBar ? navBar.clientHeight : 0;

  return windowHeight - navBarHeight;
};

const getSplitterDimensions = (hasSelectedJob) => {
  const defaultPushListPct = hasSelectedJob ? 100 - DEFAULT_DETAILS_PCT : 100;
  const defaultDetailsHeight =
    defaultPushListPct < 100
      ? (DEFAULT_DETAILS_PCT / 100) * getWindowHeight()
      : 0;

  return {
    defaultPushListPct,
    defaultDetailsHeight,
  };
};

const getOrSetRepo = (navigate) => {
  const params = getAllUrlParams();
  let repo = params.get('repo');

  if (!repo) {
    repo = thDefaultRepo;
    params.set('repo', repo);
    navigate({
      search: createQueryParams(params),
    });
  }

  return repo;
};

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const panelGroupRef = useRef();

  // Redux state
  const jobMap = useSelector((state) => state.pushes.jobMap);

  // Get initial URL params
  const urlParams = getAllUrlParams();
  const initialHasSelectedJob =
    urlParams.has('selectedJob') || urlParams.has('selectedTaskRun');

  // Local state
  const [repoName, setRepoName] = useState(() => getOrSetRepo(navigate));
  const [revision, setRevision] = useState(urlParams.get('revision'));
  const [landoCommitID] = useState(urlParams.get('landoCommitID'));
  const [landoStatus, setLandoStatus] = useState('unknown');
  const [user, setUser] = useState({ isLoggedIn: false, isStaff: false });
  const [filterModel, setFilterModel] = useState(
    () => new FilterModel(navigate, location),
  );
  const [isFieldFilterVisible, setIsFieldFilterVisible] = useState(false);
  const [serverChangedDelayed, setServerChangedDelayed] = useState(false);
  const [serverChanged, setServerChanged] = useState(false);
  const [serverChangedTimestamp, setServerChangedTimestamp] = useState(null);
  const [serverRev, setServerRev] = useState(null);
  const [repos, setRepos] = useState([]);
  const [currentRepo, setCurrentRepo] = useState(null);
  const [classificationTypes, setClassificationTypes] = useState([]);
  const [classificationMap, setClassificationMap] = useState({});
  const [hasSelectedJob, setHasSelectedJob] = useState(initialHasSelectedJob);
  const [groupCountsExpanded, setGroupCountsExpanded] = useState(
    urlParams.get('group_state') === 'expanded',
  );
  const [duplicateJobsVisible, setDuplicateJobsVisible] = useState(
    urlParams.get('duplicate_jobs') === 'visible',
  );
  const [showShortCuts, setShowShortCuts] = useState(false);
  const [pushHealthVisibility, setPushHealthVisibility] = useState('try');
  const [frameworks, setFrameworks] = useState(null);
  const [latestSplitPct, setLatestSplitPct] = useState(undefined);

  // Refs for intervals
  const updateIntervalRef = useRef(null);
  const landoIntervalRef = useRef(null);
  const notificationIntervalRef = useRef(null);
  const prevLocationSearch = useRef(location.search);

  // Calculate splitter dimensions
  const { defaultPushListPct, defaultDetailsHeight } = useMemo(
    () => getSplitterDimensions(hasSelectedJob),
    [hasSelectedJob],
  );

  const fetchDeployedRevision = useCallback(() => {
    return fetch(deployedRevisionUrl).then((resp) => resp.text());
  }, []);

  const setLandoRevision = useCallback(async () => {
    const params = getAllUrlParams();
    const landoCommitIDParam = params.get('landoCommitID');

    const { data } = await getData(getLandoJobsUrl(landoCommitIDParam));
    const revisionData = data.commit_id;

    if (revisionData) {
      setRevision(revisionData);

      params.set('revision', revisionData);
      params.delete('landoCommitID');

      navigate({
        search: createQueryParams(params),
      });
    } else {
      const status = data.status ? data.status : 'unknown';
      setLandoStatus(status.toLowerCase());
    }

    return revisionData;
  }, [navigate]);

  const handleFiltersUpdated = useCallback(() => {
    setFilterModel(new FilterModel(navigate, window.location));
  }, [navigate]);

  const handleStorageEvent = useCallback((e) => {
    if (e.key === 'user') {
      setUser(JSON.parse(e.newValue) || { isLoggedIn: false, isStaff: false });
    }
  }, []);

  const getAllShownJobs = useCallback(
    (pushId) => {
      const jobList = Object.values(jobMap);

      return pushId
        ? jobList.filter((job) => job.push_id === pushId && job.visible)
        : jobList.filter((job) => job.visible);
    },
    [jobMap],
  );

  const toggleFieldFilterVisible = useCallback(() => {
    setIsFieldFilterVisible((prev) => !prev);
  }, []);

  const updateDimensions = useCallback(() => {
    // Force re-render to recalculate dimensions
  }, []);

  const handleUrlChanges = useCallback(() => {
    const {
      selectedJob,
      selectedTaskRun,
      group_state: groupState,
      duplicate_jobs: duplicateJobs,
      repo: newRepo,
    } = parseQueryParams(location.search);

    const newCurrentRepo = repos.find((repo) => repo.name === newRepo);
    const newHasSelectedJob = !!(selectedJob || selectedTaskRun);
    const newGroupCountsExpanded = groupState === 'expanded';
    const newDuplicateJobsVisible = duplicateJobs === 'visible';

    setHasSelectedJob(newHasSelectedJob);
    setGroupCountsExpanded(newGroupCountsExpanded);
    setDuplicateJobsVisible(newDuplicateJobsVisible);
    if (newCurrentRepo) {
      setCurrentRepo(newCurrentRepo);
      setRepoName(newCurrentRepo.name);
    }

    // Only create a new FilterModel instance if filter parameters actually changed
    if (hasUrlFilterChanges(filterModel.location.search, location.search)) {
      setFilterModel(new FilterModel(navigate, location));
    } else {
      // Update existing FilterModel's location
      filterModel.location = location;
    }
  }, [repos, location.search, filterModel, navigate]);

  const showOnScreenShortcuts = useCallback(
    (show) => {
      const newValue = typeof show === 'boolean' ? show : !showShortCuts;
      setShowShortCuts(newValue);
    },
    [showShortCuts],
  );

  const updateButtonClick = useCallback(() => {
    window.location.reload(true);
  }, []);

  const handleSplitChange = useCallback((sizes) => {
    setLatestSplitPct(sizes[0]);
  }, []);

  const setCurrentRepoTreeStatus = useCallback((status) => {
    const link = document.head.querySelector('link[rel="icon"]');

    if (link) {
      link.href = thFavicons[status] || thFavicons.open;
    }
  }, []);

  const updatePanelLayout = useCallback(() => {
    if (panelGroupRef.current) {
      const pushListPct = hasSelectedJob ? 100 - DEFAULT_DETAILS_PCT : 100;
      panelGroupRef.current.setLayout([pushListPct, 100 - pushListPct]);
    }
  }, [hasSelectedJob]);

  // Effect for component mount
  useEffect(() => {
    // Start all API requests in parallel - including pushes.
    getData(getApiUrl(endpoints.frameworks)).then((response) =>
      setFrameworks(response.data),
    );

    RepositoryModel.getList().then((repoList) => {
      const newRepo = repoList.find((repo) => repo.name === repoName);
      setCurrentRepo(newRepo);
      setRepos(repoList);
    });

    ClassificationTypeModel.getList().then((types) => {
      setClassificationTypes(types);
      setClassificationMap(ClassificationTypeModel.getMap(types));
    });

    // Start (pre)fetching pushes immediately
    dispatch(fetchPushes());

    window.addEventListener('resize', updateDimensions, false);
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener(thEvents.filtersUpdated, handleFiltersUpdated);

    // Handle lando commit ID
    if (landoCommitID) {
      (async () => {
        let revisionResult = await setLandoRevision();
        if (!revisionResult) {
          landoIntervalRef.current = setInterval(async () => {
            revisionResult = await setLandoRevision();
            if (revisionResult) {
              clearInterval(landoIntervalRef.current);
            }
          }, LANDO_POLL_INTERVAL);
        }
      })();
    }

    // Get the current Treeherder revision and poll to notify on updates.
    fetchDeployedRevision().then((rev) => {
      setServerRev(rev);
      updateIntervalRef.current = setInterval(() => {
        fetchDeployedRevision().then((newRev) => {
          setServerRev((currentServerRev) => {
            if (currentServerRev && currentServerRev !== newRev) {
              setServerChanged(true);
              setServerChangedTimestamp(
                (prevTimestamp) => prevTimestamp || Date.now(),
              );
            }
            return newRev;
          });
        });
      }, REVISION_POLL_INTERVAL);
    });

    // clear expired notifications
    notificationIntervalRef.current = setInterval(() => {
      dispatch(clearExpiredNotifications());
    }, MAX_TRANSIENT_AGE);

    return () => {
      window.removeEventListener('resize', updateDimensions, false);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener(thEvents.filtersUpdated, handleFiltersUpdated);

      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      if (landoIntervalRef.current) {
        clearInterval(landoIntervalRef.current);
      }
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
      }
    };
  }, []);

  // Effect to handle serverChanged delayed state
  useEffect(() => {
    if (serverChanged && serverChangedTimestamp) {
      if (
        Date.now() - serverChangedTimestamp >
        REVISION_POLL_DELAYED_INTERVAL
      ) {
        setServerChangedDelayed(true);
        if (updateIntervalRef.current) {
          clearInterval(updateIntervalRef.current);
        }
      }
    }
  }, [serverChanged, serverChangedTimestamp, serverRev]);

  // Effect for URL changes
  useEffect(() => {
    if (prevLocationSearch.current !== location.search) {
      handleUrlChanges();
      prevLocationSearch.current = location.search;
    }
  }, [location.search, handleUrlChanges]);

  // Effect for panel layout updates when hasSelectedJob changes
  useEffect(() => {
    updatePanelLayout();
  }, [hasSelectedJob, updatePanelLayout]);

  // Calculate panel sizes
  const pushListPct =
    latestSplitPct === undefined || !hasSelectedJob
      ? defaultPushListPct
      : latestSplitPct;
  const detailsHeight =
    latestSplitPct === undefined || !hasSelectedJob
      ? defaultDetailsHeight
      : getWindowHeight() * (1 - pushListPct / 100);
  const filterBarFilters = Object.entries(filterModel.urlParams).reduce(
    (acc, [field, value]) =>
      HIDDEN_URL_PARAMS.includes(field) || matchesDefaults(field, value)
        ? acc
        : [...acc, { field, value }],
    [],
  );

  return (
    <div id="global-container" className="height-minus-navbars">
      <KeyboardShortcuts
        filterModel={filterModel}
        showOnScreenShortcuts={showOnScreenShortcuts}
      >
        <PrimaryNavBar
          repos={repos}
          updateButtonClick={updateButtonClick}
          serverChanged={serverChanged}
          filterModel={filterModel}
          setUser={setUser}
          user={user}
          setCurrentRepoTreeStatus={setCurrentRepoTreeStatus}
          getAllShownJobs={getAllShownJobs}
          duplicateJobsVisible={duplicateJobsVisible}
          groupCountsExpanded={groupCountsExpanded}
          toggleFieldFilterVisible={toggleFieldFilterVisible}
          pushHealthVisibility={pushHealthVisibility}
          setPushHealthVisibility={setPushHealthVisibility}
        />
        <PanelGroup
          ref={panelGroupRef}
          direction="vertical"
          onLayout={handleSplitChange}
        >
          <Panel defaultSize={pushListPct} minSize={20}>
            <div className="d-flex flex-column w-100 h-100">
              {(isFieldFilterVisible || !!filterBarFilters.length) && (
                <ActiveFilters
                  classificationTypes={classificationTypes}
                  filterModel={filterModel}
                  filterBarFilters={filterBarFilters}
                  isFieldFilterVisible={isFieldFilterVisible}
                  toggleFieldFilterVisible={toggleFieldFilterVisible}
                />
              )}
              {serverChangedDelayed && (
                <UpdateAvailable updateButtonClick={updateButtonClick} />
              )}
              {currentRepo && (
                <div id="th-global-content" className="th-global-content">
                  <span className="th-view-content" tabIndex={-1}>
                    <PushList
                      user={user}
                      repoName={repoName}
                      revision={revision}
                      landoCommitID={landoCommitID}
                      landoStatus={landoStatus}
                      currentRepo={currentRepo}
                      filterModel={filterModel}
                      duplicateJobsVisible={duplicateJobsVisible}
                      groupCountsExpanded={groupCountsExpanded}
                      pushHealthVisibility={pushHealthVisibility}
                      getAllShownJobs={getAllShownJobs}
                    />
                  </span>
                </div>
              )}
            </div>
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel defaultSize={100 - pushListPct} minSize={0}>
            {currentRepo && (
              <DetailsPanel
                resizedHeight={detailsHeight}
                currentRepo={currentRepo}
                user={user}
                classificationTypes={classificationTypes}
                classificationMap={classificationMap}
                frameworks={frameworks}
              />
            )}
          </Panel>
        </PanelGroup>
        <Notifications />
        <Modal
          show={showShortCuts}
          onHide={() => showOnScreenShortcuts(false)}
          id="onscreen-shortcuts"
        >
          <ShortcutTable />
        </Modal>
      </KeyboardShortcuts>
    </div>
  );
};

export default App;
