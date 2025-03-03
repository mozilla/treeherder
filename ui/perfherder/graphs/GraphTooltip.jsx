import React from 'react';
import PropTypes from 'prop-types';
import countBy from 'lodash/countBy';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExclamationCircle,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';

import { alertStatusMap, endpoints } from '../perf-helpers/constants';
import {
  getApiUrl,
  getJobsUrl,
  getPerfCompareBaseSubtestsURL,
} from '../../helpers/url';
import { create } from '../../helpers/http';
import RepositoryModel from '../../models/repository';
import { displayNumber, getStatus } from '../perf-helpers/helpers';
import Clipboard from '../../shared/Clipboard';
import { toMercurialDateStr } from '../../helpers/display';

const GraphTooltip = ({
  testData,
  infraAffectedData,
  user,
  updateData,
  projects,
  updateStateParams,
  lockTooltip,
  closeTooltip,
  datum,
  x,
  y,
  windowWidth,
}) => {
  const testDetails = testData.find(
    (item) => item.signature_id === datum.signature_id,
  );

  const isDatumAffected = infraAffectedData.has(datum.revision);

  const flotIndex = testDetails.data.findIndex((item) =>
    datum.dataPointId
      ? item.dataPointId === datum.dataPointId
      : item.pushId === datum.pushId,
  );
  const dataPointDetails = testDetails.data[flotIndex];

  const retriggers = countBy(testDetails.resultSetData, (resultSetId) =>
    resultSetId === datum.pushId ? 'retrigger' : 'original',
  );
  const retriggerNum = retriggers.retrigger - 1;
  const prevFlotDataPointIndex = flotIndex - 1;
  const value = dataPointDetails.y;

  const v0 =
    prevFlotDataPointIndex !== -1
      ? testDetails.data[prevFlotDataPointIndex].y
      : value;
  const deltaValue = value - v0;
  const deltaPercent = value / v0 - 1;
  let alert;
  let alertStatus;
  let isCommonAlert = false;
  let commonAlertStatus;

  if (dataPointDetails.alertSummary && dataPointDetails.alertSummary.alerts) {
    alert = dataPointDetails.alertSummary.alerts.find(
      (alert) => alert.series_signature.id === testDetails.signature_id,
    );
  }

  if (datum.commonAlert) {
    isCommonAlert = true;
  }

  if (alert) {
    alertStatus =
      alert.status === alertStatusMap.acknowledged && testDetails.alertSummary
        ? getStatus(testDetails.alertSummary.status)
        : getStatus(alert.status, alertStatusMap);
  } else if (isCommonAlert) {
    commonAlertStatus = getStatus(datum.commonAlert.status);
  }

  const repositoryName = projects.find(
    (repositoryName) => repositoryName.name === testDetails.repository_name,
  );

  let prevRevision;
  let prevPushId;
  let pushUrl;
  const originalDataPointIdx = testDetails.data.findIndex(
    (e) => e.revision === dataPointDetails.revision,
  );

  if (prevFlotDataPointIndex !== -1 && originalDataPointIdx > 0) {
    const prevDataPointIdx = originalDataPointIdx - 1;
    const repoModel = new RepositoryModel(repositoryName);

    prevRevision = testDetails.data[prevDataPointIdx].revision;
    prevPushId = testDetails.data[prevDataPointIdx].pushId;
    pushUrl = repoModel.getPushLogRangeHref({
      fromchange: prevRevision,
      tochange: dataPointDetails.revision,
    });
  }

  const jobsUrl = getJobsUrl({
    repo: testDetails.repository_name,
    revision: dataPointDetails.revision,
    selectedJob: dataPointDetails.jobId,
    group_state: 'expanded',
  });

  const createAlert = async () => {
    let data;
    let failureStatus;

    ({ data, failureStatus } = await create(getApiUrl(endpoints.alertSummary), {
      repository_id: testDetails.projectId,
      framework_id: testDetails.framework_id,
      push_id: dataPointDetails.pushId,
      prev_push_id: prevPushId,
    }));

    if (failureStatus) {
      return updateStateParams({
        errorMessages: [
          `Failed to create an alert summary for push ${dataPointDetails.push_id}: ${data}`,
        ],
      });
    }

    const newAlertSummaryId = data.alert_summary_id;
    ({ data, failureStatus } = await create(getApiUrl(endpoints.alert), {
      summary_id: newAlertSummaryId,
      signature_id: testDetails.signature_id,
    }));

    if (failureStatus) {
      updateStateParams({
        errorMessages: [
          `Failed to create an alert for alert summary ${newAlertSummaryId}: ${data}`,
        ],
      });
    }

    updateData(
      testDetails.signature_id,
      testDetails.projectId,
      newAlertSummaryId,
      flotIndex,
    );
  };

  const verticalOffset = 15;
  const horizontalOffset = x >= 1275 && windowWidth <= 1825 ? 100 : 0;
  const centered = {
    x: x - 280 / 2 - horizontalOffset,
    y: y - (186 + verticalOffset),
  };

  return (
    <foreignObject width="100%" height="100%" x={centered.x} y={centered.y}>
      <div
        className={`graph-tooltip ${lockTooltip ? 'locked' : null}`}
        xmlns="http://www.w3.org/1999/xhtml"
        data-testid="graphTooltip"
      >
        <Button
          outline
          color="secondary"
          className="close mr-3 my-2 ml-2"
          onClick={closeTooltip}
        >
          <FontAwesomeIcon
            className="pointer text-white"
            icon={faTimes}
            size="xs"
            title="close tooltip"
          />
        </Button>
        <div className="body">
          <div>
            <p data-testid="repoName">({testDetails.repository_name})</p>
            <p className="small" data-testid="platform">
              {testDetails.platform}
            </p>
          </div>
          <div>
            <p>
              {displayNumber(value)}
              {testDetails.measurementUnit && (
                <span> {testDetails.measurementUnit}</span>
              )}
              <span className="text-muted">
                {testDetails.lowerIsBetter
                  ? ' (lower is better)'
                  : ' (higher is better)'}
              </span>
            </p>
            <p className="small">
              &Delta; {displayNumber(deltaValue.toFixed(1))} (
              {(100 * deltaPercent).toFixed(1)}%)
            </p>
            {isDatumAffected && (
              <p className="small text-warning">
                Could be affected by infra changes.
              </p>
            )}
          </div>

          <div>
            <span>
              <a href={pushUrl} target="_blank" rel="noopener noreferrer">
                {dataPointDetails.revision.slice(0, 12)}
              </a>{' '}
              {(dataPointDetails.jobId || prevRevision) && '('}
              {dataPointDetails.jobId && (
                <a href={jobsUrl} target="_blank" rel="noopener noreferrer">
                  job
                </a>
              )}
              {dataPointDetails.jobId && prevRevision && ', '}
              {prevRevision && (
                <a
                  href={getPerfCompareBaseSubtestsURL(
                    testDetails.repository_name,
                    prevRevision,
                    testDetails.repository_name,
                    dataPointDetails.revision,
                    testDetails.framework_id,
                    testDetails.parentSignature || testDetails.signature_id,
                    testDetails.parentSignature || testDetails.signature_id,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  compare
                </a>
              )}
              {(dataPointDetails.jobId || prevRevision) && ') '}
              <Clipboard
                text={dataPointDetails.revision}
                description="Revision"
                outline
              />
            </span>
            {dataPointDetails.alertSummary && (
              <p>
                <Link
                  to={`./alerts?id=${dataPointDetails.alertSummary.id}`}
                  target="_blank"
                >
                  <FontAwesomeIcon
                    className="text-warning"
                    icon={faExclamationCircle}
                    size="sm"
                  />
                  {` Alert # ${dataPointDetails.alertSummary.id}`}
                </Link>
                <span className="text-muted">
                  {` - ${alertStatus} `}
                  {alert && alert.related_summary_id && (
                    <span>
                      {alert.related_summary_id !==
                      dataPointDetails.alertSummary.id
                        ? 'to'
                        : 'from'}
                      <Link
                        to={`./alerts?id=${alert.related_summary_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >{` alert # ${alert.related_summary_id}`}</Link>
                    </span>
                  )}
                </span>
                <Clipboard
                  text={dataPointDetails.alertSummary.id.toString()}
                  description="Alert Summary id"
                  outline
                />
              </p>
            )}
            {isCommonAlert && !dataPointDetails.alertSummary && (
              <p>
                <Link
                  to={`./alerts?id=${datum.commonAlert.id}`}
                  target="_blank"
                >
                  <FontAwesomeIcon
                    className="text-warning"
                    icon={faExclamationCircle}
                    size="sm"
                  />
                  {` Alert # ${datum.commonAlert.id}`}
                </Link>
                <span className="text-muted">{` - ${commonAlertStatus} `}</span>
                <Clipboard
                  text={datum.commonAlert.id.toString()}
                  description="Alert Summary id"
                  outline
                />
                <p className="small text-danger">Common alert</p>
              </p>
            )}
            {!dataPointDetails.alertSummary && prevPushId && (
              <p className="pt-2">
                {user.isStaff ? (
                  <Button
                    color="darker-info"
                    outline
                    size="sm"
                    onClick={createAlert}
                  >
                    create alert
                  </Button>
                ) : (
                  <span>(log in as a a sheriff to create)</span>
                )}
              </p>
            )}
            <p className="small text-white pt-2">
              {`Push time: ${toMercurialDateStr(dataPointDetails.x)}`}
            </p>
            <p className="small text-white pt-2">
              {`Retrigger time: ${toMercurialDateStr(
                dataPointDetails.retrigger_time,
              )}`}
            </p>
            {Boolean(retriggerNum) && (
              <p className="small">{`Retriggers: ${retriggerNum}`}</p>
            )}
          </div>
        </div>
        <div
          className="tip"
          style={{ transform: `translateX(${horizontalOffset}px)` }}
        />
      </div>
    </foreignObject>
  );
};

GraphTooltip.propTypes = {
  dataPoint: PropTypes.shape({}),
  testData: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  user: PropTypes.shape({}).isRequired,
  updateData: PropTypes.func.isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})),
};

GraphTooltip.defaultProps = {
  projects: [],
  dataPoint: undefined,
};

export default GraphTooltip;
