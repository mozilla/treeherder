import React from 'react';

import individualAlert from '../img/individual-alert.png';
import hoveredIndividualAlert from '../img/individual-alert-hovered.png';
import absoluteDifference from '../img/individual-alert-absolute-difference.png';
import absoluteDifferenceBefore from '../img/individual-alert-absolute-difference-before.png';
import magnitudeOfChange from '../img/individual-alert-magnitude-of-change.png';
import magnitudeOfChangeBefore from '../img/individual-alert-magnitude-of-change-before.png';
import confidence from '../img/individual-alert-confidence.png';
import confidenceBefore from '../img/individual-alert-confidence-before.png';
import hideUncomparableResults from '../img/compare-view-hide-uncomparable-results.png';
import hideUncomparableResultsBefore from '../img/compare-view-hide-uncomparable-results-before.png';
import showOnlyImportantChanges from '../img/compare-view-show-only-important-changes.png';
import showOnlyImportantChangesBefore from '../img/compare-view-show-only-important-changes-before.png';
import hideUncertainResults from '../img/compare-view-hide-uncertain-results.png';
import hideUncertainResultsBefore from '../img/compare-view-hide-uncertain-results-before.png';
import showOnlyNoise from '../img/compare-view-show-only-noise.png';
import showOnlyNoiseBefore from '../img/compare-view-show-only-noise-before.png';

const alertViewHoverableItems = [
  {
    name: 'Individual alert',
    imageBeforeHover: (
      <img
        src={individualAlert}
        alt="Individual alert in Alerts View- before hover"
      />
    ),
    imageAfterHover: (
      <img
        src={hoveredIndividualAlert}
        alt="Individual alert in Alerts View - after hover"
      />
    ),
  },
  {
    name: 'Individual alert - absolute difference',
    imageBeforeHover: (
      <img
        src={absoluteDifferenceBefore}
        alt="Individual alert absolute difference in Alerts View - before hover"
      />
    ),
    imageAfterHover: (
      <img
        src={absoluteDifference}
        alt="Individual alert absolute difference in Alerts View - after hover"
      />
    ),
  },
  {
    name: 'Individual alert - magnitude of change',
    imageBeforeHover: (
      <img
        src={magnitudeOfChangeBefore}
        alt="Individual alert magnitude of change in Alerts View - before hover"
      />
    ),
    imageAfterHover: (
      <img
        src={magnitudeOfChange}
        alt="Individual alert magnitude of change in Alerts View - after hover"
      />
    ),
  },
  {
    name: 'Individual alert - confidence',
    imageBeforeHover: (
      <img
        src={confidenceBefore}
        alt="Individual alert confidence in Alerts View - before hover"
      />
    ),
    imageAfterHover: (
      <img
        src={confidence}
        alt="Individual alert confidence in Alerts View - after hover"
      />
    ),
  },
];

const compareViewHoverableItems = [
  {
    name: 'Filter buttons - Hide uncomparable results',
    imageBeforeHover: (
      <img
        src={hideUncomparableResultsBefore}
        alt="Hide uncomparable results filter in Compare View - before hover"
      />
    ),
    imageAfterHover: (
      <img
        src={hideUncomparableResults}
        alt="Hide uncomparable results filter in Compare View - after hover"
      />
    ),
  },
  {
    name: 'Filter buttons - Show only important changes',
    imageBeforeHover: (
      <img
        src={showOnlyImportantChangesBefore}
        alt="Show only important changes filter in Compare View - before hover"
      />
    ),
    imageAfterHover: (
      <img
        src={showOnlyImportantChanges}
        alt="Show only important changes filter in Compare View - after hover"
      />
    ),
  },
  {
    name: 'Filter buttons - Hide uncertain results',
    imageBeforeHover: (
      <img
        src={hideUncertainResultsBefore}
        alt="Hide uncertain results filter in Compare View - before hover"
      />
    ),
    imageAfterHover: (
      <img
        src={hideUncertainResults}
        alt="Hide uncertain results filter in Compare View - after hover"
      />
    ),
  },
  {
    name: 'Filter buttons - Show only noise',
    imageBeforeHover: (
      <img
        src={showOnlyNoiseBefore}
        alt="Show only noise filter in Compare View - before hover"
      />
    ),
    imageAfterHover: (
      <img
        src={showOnlyNoise}
        alt="Show only noise filter in Compare View - after hover"
      />
    ),
  },
];

const AdditionalInformationTable = function AdditionalInformationTable() {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Elements with extra information</h3>
      </div>

      <div className="card-body panel-spacing">
        <table>
          <tbody>
            <tr>
              <th colSpan="1">Alerts View</th>
              <th colSpan="1">Before hover</th>
              <th colSpan="1">After hover</th>
            </tr>
          </tbody>

          <tbody>
            {alertViewHoverableItems.map((item) => (
              <tr>
                <td>
                  <span>{item.name}</span>
                </td>
                <td>{item.imageBeforeHover}</td>
                <td>{item.imageAfterHover}</td>
              </tr>
            ))}
          </tbody>

          <tbody>
            <tr>
              <th colSpan="3">Compare View</th>
            </tr>
          </tbody>

          <tbody>
            {compareViewHoverableItems.map((item) => (
              <tr>
                <td>
                  <span>{item.name}</span>
                </td>
                <td>{item.imageBeforeHover}</td>
                <td>{item.imageAfterHover}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdditionalInformationTable;
