import React from 'react';
import PropTypes from 'prop-types';

import { getAllUrlParams } from '../helpers/location';

function PushLoadErrors(props) {
  const { loadingPushes, currentRepo, revision, repoName } = props;
  const urlParams = getAllUrlParams();
  urlParams.delete("revision");

  const isRevision = revision => (
    revision && (revision.length === 12 || revision.length === 40)
  );

  return (
    <div className="push-load-errors">
      {!loadingPushes && isRevision(revision) && currentRepo && currentRepo.url &&
        <div className="push-body unknown-message-body">
          <span>
            {revision &&
              <span>
                <span>Waiting for a push with revision <strong>{revision}</strong></span>
                <a
                  href={currentRepo.getPushLogHref(revision)}
                  target="_blank"
                  rel="noopener"
                  title={`open revision ${revision} on ${currentRepo.url}`}
                >(view pushlog)</a>
                <span className="fa fa-spinner fa-pulse th-spinner" />
                <div>If the push exists, it will appear in a few minutes once it has been processed.</div>
              </span>
            }
          </span>
        </div>
      }
      {!loadingPushes && !isRevision(revision) &&
        <div className="push-body unknown-message-body">
          This is an invalid or unknown revision. Please change it, or click
          <a href={`/#/jobs?${urlParams.toString()}`}> here</a> to reload the latest revisions from {repoName}.
        </div>
      }
      {!loadingPushes && !revision && currentRepo &&
        <div className="push-body unknown-message-body">
          <span>
            <div><b>No pushes found.</b></div>
            <span>No commit information could be loaded for this repository.
              More information about this repository can be found <a href={currentRepo.url}>here</a>.</span>
          </span>
        </div>
      }
      {!loadingPushes && !Object.keys(currentRepo).length &&
        <div className="push-body unknown-message-body">
          <span>
            <div><b>Unknown repository.</b></div>
            <span>This repository is either unknown to Treeherder or it does not exist.
              If this repository does exist, please <a href="https://bugzilla.mozilla.org/enter_bug.cgi?product=Tree%20Management&component=Treeherder">
              file a bug against the Treeherder product in Bugzilla</a> to get it added to the system.
            </span>
          </span>
        </div>
      }
    </div>
  );
}

PushLoadErrors.propTypes = {
  loadingPushes: PropTypes.bool.isRequired,
  currentRepo: PropTypes.object.isRequired,
  revision: PropTypes.string.isRequired,
  repoName: PropTypes.string.isRequired,
};

export default PushLoadErrors;
