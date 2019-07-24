import React from 'react';
import PropTypes from 'prop-types';
import countBy from 'lodash/countBy';
import moment from 'moment';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';

import { alertStatusMap, endpoints } from '../constants';
import { getJobsUrl, createQueryParams, getApiUrl } from '../../helpers/url';
import { create } from '../../helpers/http';
import RepositoryModel from '../../models/repository';
import { displayNumber, getStatus } from '../helpers';

const GraphTooltip = ({ dataPoint, testData, user, updateData, projects }) => {
  // we either have partial information provided by the selected
  // query parameter or the full dataPoint object provided from the
  // graph library
  const datum = dataPoint.datum ? dataPoint.datum : dataPoint;
  const testDetails = testData.find(
    item => item.signature_id === datum.signature_id,
  );

  const flotIndex = testDetails.data.findIndex(
    item => item.pushId === datum.pushId,
  );
  const dataPointDetails = testDetails.data[flotIndex];

  const retriggers = countBy(testDetails.resultSetData, resultSetId =>
    resultSetId === dataPoint.pushId ? 'retrigger' : 'original',
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

  if (dataPointDetails.alertSummary && dataPointDetails.alertSummary.alerts) {
    alert = dataPointDetails.alertSummary.alerts.find(
      alert => alert.series_signature.id === testDetails.signature_id,
    );
  }

  if (alert) {
    alertStatus =
      alert.status === alertStatusMap.acknowledged
        ? getStatus(testDetails.alertSummary.status)
        : getStatus(alert.status, alertStatusMap);
  }

  const repository_name = projects.find(
    repository_name => repository_name.name === testDetails.repository_name,
  );

  let prevRevision;
  let prevPushId;
  let pushUrl;
  if (prevFlotDataPointIndex !== -1) {
    prevRevision = testDetails.data[prevFlotDataPointIndex].revision;
    prevPushId = testDetails.data[prevFlotDataPointIndex].pushId;
    const repoModel = new RepositoryModel(repository_name);
    pushUrl = repoModel.getPushLogRangeHref({
      fromchange: prevRevision,
      tochange: dataPointDetails.revision,
    });
  }

  const jobsUrl = `${getJobsUrl({
    repo: testDetails.repository_name,
    revision: dataPointDetails.revision,
  })}${createQueryParams({
    selectedJob: dataPointDetails.jobId,
    group_state: 'expanded',
  })}`;

  // TODO refactor create to use getData wrapper
  const createAlert = () =>
    create(getApiUrl(endpoints.alertSummary), {
      repository_id: testDetails.projectId,
      framework_id: testDetails.framework_id,
      push_id: dataPointDetails.pushId,
      prev_push_id: prevPushId,
    })
      .then(response => response.json())
      .then(response => {
        const newAlertSummaryId = response.alert_summary_id;
        return create(getApiUrl('/performance/alert/'), {
          summary_id: newAlertSummaryId,
          signature_id: testDetails.signature_id,
        }).then(() =>
          updateData(
            testDetails.signature_id,
            testDetails.projectId,
            newAlertSummaryId,
            flotIndex,
          ),
        );
      });

  return (
    <div className="body">
      <div>
        <p>({testDetails.repository_name})</p>
        <p className="small">{testDetails.platform}</p>
      </div>
      <div>
        <p>
          {displayNumber(value)}
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
      </div>

      <div>
        {prevRevision && (
          <span>
            <a href={pushUrl} target="_blank" rel="noopener noreferrer">
              {dataPointDetails.revision.slice(0, 13)}
            </a>{' '}
            (
            {dataPointDetails.jobId && (
              <a href={jobsUrl} target="_blank" rel="noopener noreferrer">
                job
              </a>
            )}
            ,{' '}
            <a
              href={`#/comparesubtest${createQueryParams({
                originalProject: testDetails.repository_name,
                newProject: testDetails.repository_name,
                originalRevision: prevRevision,
                newRevision: dataPointDetails.revision,
                originalSignature: testDetails.signature_id,
                newSignature: testDetails.signature_id,
                framework: testDetails.framework_id,
              })}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              compare
            </a>
            )
          </span>
        )}
        {dataPointDetails.alertSummary && (
          <p>
            <a
              href={`perf.html#/alerts?id=${dataPointDetails.alertSummary.id}`}
            >
              <FontAwesomeIcon
                className="text-warning"
                icon={faExclamationCircle}
                size="sm"
              />
              {` Alert # ${dataPointDetails.alertSummary.id}`}
            </a>
            <span className="text-muted">
              {` - ${alertStatus} `}
              {alert.related_summary_id && (
                <span>
                  {alert.related_summary_id !== dataPointDetails.alertSummary.id
                    ? 'to'
                    : 'from'}
                  <a
                    href={`#/alerts?id=${alert.related_summary_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >{` alert # ${alert.related_summary_id}`}</a>
                </span>
              )}
            </span>
          </p>
        )}
        {!dataPointDetails.alertSummary && prevPushId && (
          <p className="pt-2">
            {user.isStaff ? (
              <Button color="info" outline size="sm" onClick={createAlert}>
                create alert
              </Button>
            ) : (
              <span>(log in as a a sheriff to create)</span>
            )}
          </p>
        )}
        <p className="small text-white pt-2">{`${moment
          .utc(dataPointDetails.x)
          .format('MMM DD hh:mm:ss')} UTC`}</p>
        {Boolean(retriggerNum) && (
          <p className="small">{`Retriggers: ${retriggerNum}`}</p>
        )}
      </div>
    </div>
  );
};

GraphTooltip.propTypes = {
  dataPoint: PropTypes.shape({}).isRequired,
  testData: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  user: PropTypes.shape({}).isRequired,
  updateData: PropTypes.func.isRequired,
  projects: PropTypes.arrayOf(PropTypes.shape({})),
};

GraphTooltip.defaultProps = {
  projects: [],
};

export default GraphTooltip;
