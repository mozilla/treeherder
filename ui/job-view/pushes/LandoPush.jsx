import PropTypes from 'prop-types';
import { Col, Row } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faExternalLinkAlt,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';

import { toDateStr } from '../../helpers/display';
import { RevisionList } from '../../shared/RevisionList';

// Statuses a landing job will not move out of.
const FINAL_STATUSES = ['landed', 'failed', 'cancelled'];

// A lando landing job that hasn't been turned into a push yet, displayed with
// the layout of a real push so that its commits can be read while waiting.
export default function LandoPush({ landoJob, landoInstance }) {
  const {
    id,
    error,
    created_at: createdAt,
    requester,
    revisions,
    url,
  } = landoJob;
  const status = landoJob.status.toLowerCase().replace(/_/g, ' ');

  // The commits have no hash yet, so they are displayed without one, and their
  // url is only used as a key. Lando lists them oldest first, while pushes
  // show the tip revision first.
  const landoRevisions = revisions
    .map((revision) => ({
      revision: revision.url,
      author: `${revision.author_name} <${revision.author_email}>`,
      comments: revision.commit_message,
    }))
    .reverse();

  const landingJobLink = (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {id}
    </a>
  );

  return (
    <div className="push" data-testid="lando-push">
      <div className="push-header">
        <div className="push-bar">
          <span className="push-left">
            <span className="push-title-left lando-push-title">
              <span>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {toDateStr(Date.parse(createdAt) / 1000)}{' '}
                  <FontAwesomeIcon
                    icon={faExternalLinkAlt}
                    className="icon-superscript"
                  />
                </a>{' '}
                - {requester}
              </span>
            </span>
          </span>
          <span className="push-progress">
            {status}
            {!FINAL_STATUSES.includes(status) && (
              <FontAwesomeIcon
                icon={faSpinner}
                pulse
                className="th-spinner ms-2"
                title="Loading..."
              />
            )}
          </span>
          {/* Empty, but its margin aligns the status with the job counts
              of a real push. */}
          <span className="push-buttons" />
        </div>
      </div>
      <div className="push-body-divider" />
      <Row className="push g-1 flex-nowrap ms-5">
        <Col xs={5}>
          <RevisionList
            revisions={landoRevisions}
            revisionCount={landoRevisions.length}
            repo={{}}
            widthClass="mb-3 ms-4"
            hideCommitSha
          />
        </Col>
        <Col xs={7} className="job-list job-list-pad">
          {error ? (
            <>
              <span className="text-danger">
                Landing Job {landingJobLink} failed on {landoInstance}:
              </span>
              <div className="lando-push-error">{error}</div>
            </>
          ) : (
            <span className="text-muted">
              This push hasn&apos;t been processed by Lando yet: Landing Job{' '}
              {landingJobLink} to instance {landoInstance}.
              <br />
              Jobs will appear here in a few minutes.
            </span>
          )}
        </Col>
      </Row>
    </div>
  );
}

LandoPush.propTypes = {
  landoJob: PropTypes.shape({
    id: PropTypes.number.isRequired,
    status: PropTypes.string.isRequired,
    error: PropTypes.string,
    created_at: PropTypes.string.isRequired,
    requester: PropTypes.string.isRequired,
    revisions: PropTypes.arrayOf(
      PropTypes.shape({
        author_name: PropTypes.string.isRequired,
        author_email: PropTypes.string.isRequired,
        commit_message: PropTypes.string.isRequired,
        url: PropTypes.string.isRequired,
      }),
    ).isRequired,
    url: PropTypes.string.isRequired,
  }).isRequired,
  landoInstance: PropTypes.string.isRequired,
};
