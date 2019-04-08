import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';
import { faStar as faStarSolid } from '@fortawesome/free-solid-svg-icons';

import { getBugUrl } from '../../../helpers/url';
import RevisionLinkify from '../../../shared/RevisionLinkify';
import { longDateFormat } from '../../../helpers/display';

export default function ClassificationsPanel(props) {
  const { classification, job, bugs, currentRepo, classificationMap } = props;

  const failureId = classification.failure_classification_id;
  const icon = failureId === 7 ? faStarRegular : faStarSolid;
  const iconClass = `star-${job.result}`;
  const classificationName = classificationMap[failureId];

  return (
    <React.Fragment>
      <li>
        <span title={classificationName.name}>
          <FontAwesomeIcon
            icon={icon}
            className={iconClass}
            title={iconClass}
          />
          <span className="ml-1">{classificationName.name}</span>
        </span>
        {!!bugs.length && (
          <a
            target="_blank"
            rel="noopener noreferrer"
            href={getBugUrl(bugs[0].bug_id)}
            title={`View bug ${bugs[0].bug_id}`}
          >
            <em> {bugs[0].bug_id}</em>
          </a>
        )}
      </li>
      {classification.text.length > 0 && (
        <li>
          <em>
            <RevisionLinkify repo={currentRepo}>
              {classification.text}
            </RevisionLinkify>
          </em>
        </li>
      )}
      <li className="revision-comment">
        {new Date(classification.created).toLocaleString(
          'en-US',
          longDateFormat,
        )}
      </li>
      <li className="revision-comment">{classification.who}</li>
    </React.Fragment>
  );
}

ClassificationsPanel.propTypes = {
  currentRepo: PropTypes.object.isRequired,
  classification: PropTypes.object.isRequired,
  classificationMap: PropTypes.object.isRequired,
  job: PropTypes.object.isRequired,
  bugs: PropTypes.array.isRequired,
};
