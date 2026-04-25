import { useState, useEffect, useCallback } from 'react';

import formatLogLineWithLinks, {
  getLogLineColor,
} from '../helpers/logFormatting';
import { getAllUrlParams } from '../helpers/location';
import JobArtifacts from '../shared/JobArtifacts';
import JobInfo from '../shared/JobInfo';

import Navigation from './Navigation';
import ErrorLines from './ErrorLines';
import ClassicLogViewer from './ClassicLogViewer';
import { useErrorLines } from './useErrorLines';
import { useJobData } from './useJobData';
import { useLogviewerKeyboardShortcuts } from './useLogviewerKeyboardShortcuts';
import {
  copySelectedLogToBugFiler,
  findNextErrorLine,
  findPrevErrorLine,
  getUrlLineNumber,
  writeLineNumberParam,
} from './logviewerHelpers';

import './logviewer.css';

const JOB_DETAILS_COLLAPSED = 'jobDetailsCollapsed';

const App = () => {
  const queryString = getAllUrlParams();
  const repoName = queryString.get('repo');
  const jobId = queryString.get('job_id');

  const {
    job,
    currentRepo,
    jobDetails,
    revision,
    jobUrl,
    rawLogUrl,
    reftestUrl,
    jobExists,
    jobError,
  } = useJobData(repoName, jobId);

  const { errors, firstErrorLine } = useErrorLines(jobId);
  const errorLineNumbers = errors.map((e) => e.lineNumber);

  const [collapseDetails, setCollapseDetails] = useState(() => {
    const stored = localStorage.getItem(JOB_DETAILS_COLLAPSED);
    return stored !== null ? JSON.parse(stored) : true;
  });
  const [initialLine, setInitialLine] = useState(() => {
    const urlLN = getUrlLineNumber();
    return urlLN ? urlLN[0] : null;
  });
  const [highlight, setHighlightState] = useState(null);

  // When errors arrive, default to scrolling to the first one (unless URL pinned a line)
  useEffect(() => {
    if (firstErrorLine == null) return;
    const urlLN = getUrlLineNumber();
    const lineToScrollTo = urlLN ? urlLN[0] : firstErrorLine;
    setInitialLine(lineToScrollTo);
    writeLineNumberParam(urlLN || [firstErrorLine]);
  }, [firstErrorLine]);

  const onHighlightChange = useCallback((newHighlight) => {
    setHighlightState(newHighlight);
    writeLineNumberParam(newHighlight);
  }, []);

  const onErrorLineClick = useCallback((lineNumbers) => {
    if (lineNumbers && lineNumbers[0] > 0) {
      setInitialLine(lineNumbers[0]);
    }
    writeLineNumberParam(lineNumbers);
  }, []);

  const collapseJobDetails = useCallback(() => {
    setCollapseDetails((prev) => {
      const next = !prev;
      localStorage.setItem(JOB_DETAILS_COLLAPSED, next);
      return next;
    });
  }, []);

  const logFormatter = useCallback(
    (line) => (
      <span style={{ color: getLogLineColor(line) }}>
        {formatLogLineWithLinks(line, jobDetails, job)}
      </span>
    ),
    [jobDetails, job],
  );

  const goToNextError = useCallback(() => {
    const target = findNextErrorLine(errorLineNumbers, initialLine || 0);
    if (target != null) onErrorLineClick([target]);
  }, [errorLineNumbers, initialLine, onErrorLineClick]);

  const goToPrevError = useCallback(() => {
    const target = findPrevErrorLine(errorLineNumbers, initialLine || 0);
    if (target != null) onErrorLineClick([target]);
  }, [errorLineNumbers, initialLine, onErrorLineClick]);

  useLogviewerKeyboardShortcuts({
    rawLogUrl,
    jobDetails,
    job,
    onNextError: goToNextError,
    onPrevError: goToPrevError,
  });

  const extraFields = [
    {
      title: 'Revision',
      url: jobUrl,
      value: revision,
      clipboard: {
        description: 'full hash',
        text: revision,
      },
    },
  ];

  return (
    <div className="d-flex flex-column body-logviewer h-100">
      <Navigation
        jobExists={jobExists}
        result={job ? job.result : ''}
        jobError={jobError}
        rawLogUrl={rawLogUrl}
        reftestUrl={reftestUrl}
        jobUrl={jobUrl}
        collapseDetails={collapseDetails}
        collapseJobDetails={collapseJobDetails}
        copySelectedLogToBugFiler={copySelectedLogToBugFiler}
        job={job}
        jobDetails={jobDetails}
      />
      <div className="d-flex flex-column flex-fill">
        {!collapseDetails && (
          <div className="run-data d-flex flex-row mx-1 mb-2">
            <div className="d-flex flex-column job-data-panel">
              {job && (
                <JobInfo
                  job={job}
                  extraFields={extraFields}
                  revision={revision}
                  className="list-unstyled"
                  showJobFilters={false}
                  currentRepo={currentRepo}
                />
              )}
              <JobArtifacts
                jobDetails={jobDetails}
                repoName={repoName}
                selectedJob={job}
              />
            </div>
            <ErrorLines
              errors={errors}
              onClickLine={onErrorLineClick}
              jobDetails={jobDetails}
              job={job}
              highlight={highlight}
            />
          </div>
        )}
        <div className="log-contents flex-fill">
          {rawLogUrl && (
            <ClassicLogViewer
              url={rawLogUrl}
              formatLine={logFormatter}
              initialLine={initialLine}
              onHighlightChange={onHighlightChange}
              errorLineNumbers={errorLineNumbers}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
