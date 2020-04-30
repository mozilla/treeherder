import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

import { getAllUrlParams } from '../../helpers/location';
import { uiJobsUrlBase } from '../../helpers/url';

function PushLoadErrors(props) {
  const { loadingPushes, currentRepo, revision, repoName } = props;
  const urlParams = getAllUrlParams();
  urlParams.delete('revision');

  const isRevision = (revision) =>
    revision && (revision.length === 12 || revision.length === 40);

  return (
    <div className="push-load-errors">
      {!loadingPushes &&
        isRevision(revision) &&
        currentRepo &&
        currentRepo.url && (
          <div className="push-body unknown-message-body">
            <span>
              {revision && (
                <div>
                  <p>
                    Waiting for push with revision&nbsp;
                    <a
                      href={currentRepo.getPushLogHref(revision)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open revision ${revision} on ${currentRepo.url}`}
                    >
                      {revision}
                    </a>
                    &nbsp;
                    <FontAwesomeIcon
                      icon={faSpinner}
                      pulse
                      className="th-spinner"
                      title="Loading..."
                    />
                  </p>
                  <p>
                    If the push exists, it will appear in a few minutes once it
                    has been processed.
                  </p>
                </div>
              )}
            </span>
          </div>
        )}
      {!loadingPushes && revision && !isRevision(revision) && currentRepo.url && (
        <div className="push-body unknown-message-body">
          This is an invalid or unknown revision. Please change it, or click
          <a href={`${uiJobsUrlBase}?${urlParams.toString()}`}> here</a> to
          reload the latest revisions from {repoName}.
        </div>
      )}
      {!loadingPushes && !revision && currentRepo && currentRepo.url && (
        <div className="push-body unknown-message-body">
          <span>
            <div>
              <b>No pushes found.</b>
            </div>
            <span>
              No commit information could be loaded for this repository. More
              information about this repository can be found{' '}
              <a href={currentRepo.url}>here</a>.
            </span>
          </span>
        </div>
      )}
      {!loadingPushes && !currentRepo.url && (
        <div className="push-body unknown-message-body">
          <span>
            <div>
              <b>Unknown repository.</b>
            </div>
            <span>
              This repository is either unknown to Treeherder or it does not
              exist. If this repository does exist, please{' '}
              <a href="https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree%20Management&component=Treeherder">
                file a bug against the Treeherder product in Bugzilla
              </a>{' '}
              to get it added to the system.
            </span>
          </span>
        </div>
      )}
    </div>
  );
}

PushLoadErrors.propTypes = {
  loadingPushes: PropTypes.bool.isRequired,
  currentRepo: PropTypes.shape({
    url: PropTypes.string,
    pushLogUrl: PropTypes.string,
  }).isRequired,
  repoName: PropTypes.string.isRequired,
  revision: PropTypes.string,
};

PushLoadErrors.defaultProps = {
  revision: null,
};

const mapStateToProps = ({ pushes: { loadingPushes } }) => ({ loadingPushes });

export default connect(mapStateToProps)(PushLoadErrors);
