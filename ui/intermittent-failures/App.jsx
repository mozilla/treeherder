import { useState, useCallback } from 'react';
import { Routes, Route, Navigate } from 'react-router';
import { Container } from 'react-bootstrap';

import ErrorMessages from '../shared/ErrorMessages';

import MainView from './MainView';
import BugDetailsView from './BugDetailsView';

import '../css/react-table.css';
import '../css/intermittent-failures.css';
import '../css/treeherder-base.css';

const IntermittentFailuresApp = () => {
  // keep track of the mainviews graph and table data so the API won't be
  // called again when navigating back from bugdetailsview.
  const [graphData, setGraphData] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [user, setUser] = useState({});
  const [errorMessages, setErrorMessages] = useState([]);

  const updateAppState = useCallback((state) => {
    if (state.graphData !== undefined) setGraphData(state.graphData);
    if (state.tableData !== undefined) setTableData(state.tableData);
    if (state.user !== undefined) setUser(state.user);
    if (state.errorMessages !== undefined)
      setErrorMessages(state.errorMessages);
  }, []);

  const notify = useCallback((message) => {
    setErrorMessages([message]);
  }, []);

  return (
    <main>
      {errorMessages.length > 0 && (
        <Container className="pt-5 max-width-default">
          <ErrorMessages errorMessages={errorMessages} />
        </Container>
      )}
      <Routes>
        <Route
          path="main"
          element={
            <MainView
              mainGraphData={graphData}
              mainTableData={tableData}
              updateAppState={updateAppState}
              user={user}
              setUser={setUser}
              notify={notify}
            />
          }
        />
        <Route
          path="bugdetails"
          element={
            <BugDetailsView user={user} setUser={setUser} notify={notify} />
          }
        />
        <Route path="/" element={<Navigate to="main" replace />} />
      </Routes>
    </main>
  );
};

export default IntermittentFailuresApp;
