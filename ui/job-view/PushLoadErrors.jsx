const PushLoadErrors = (props) => {
  const { loadingPushes, currentRepo, revision, repoName } = props;
  const urlParams = new URLSearchParams(location.hash.split('?')[1]);
  urlParams.delete("revision");

  return (
    <div className="push-load-errors">
      {loadingPushes && revision && currentRepo && currentRepo.url &&
        <div className="push-body unknown-message-body">
          <span>
            {revision &&
              <span>
                <span>Waiting for a push with revision <strong>{revision}</strong></span>
                  <a
                    href={currentRepo.getPushLogHref(revision)}
                    target="_blank"
                    title={`open revision ${revision} on ${currentRepo.url}`}
                  >(view pushlog)</a>
                <span className="fa fa-spinner fa-pulse th-spinner" />
                <div>If the push exists, it will appear in a few minutes once it has been processed.</div>
              </span>
            }
          </span>
        </div>
      }
      {!loadingPushes && revision &&
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
};

export default PushLoadErrors;
