import React from 'react';

import individualAlert from '../img/individual-alert.png';
import individualAlertHovered from '../img/individual-alert-hovered.png';
import individualAlertDetails from '../img/individual-alert-details.png';
import absoluteDifference from '../img/individual-alert-absolute-difference.png';
import magnitudeOfChange from '../img/individual-alert-magnitude-of-change.png';
import confidence from '../img/individual-alert-confidence.png';
import compareViewFilters from '../img/compare-view-filters.png';
import hideUncomparableResults from '../img/compare-view-hide-uncomparable-results.png';
import showOnlyImportantChanges from '../img/compare-view-show-only-important-changes.png';
import hideUncertainResults from '../img/compare-view-hide-uncertain-results.png';
import showOnlyNoise from '../img/compare-view-show-only-noise.png';

const alertViewHoverableItems = [
  {
    name: 'Individual alert',
    imageBeforeHover: (
      <img src={individualAlert} alt="Individual alert before hover." />
    ),
    imageAfterHover: (
      <img src={individualAlertHovered} alt="Individual alert after hover." />
    ),
  },
  {
    name: 'Individual alert - absolute difference',
    imageBeforeHover: (
      <img src={individualAlertDetails} alt="Individual alert details." />
    ),
    imageAfterHover: (
      <img
        src={absoluteDifference}
        alt="Individual alert details - absolute difference."
      />
    ),
  },
  {
    name: 'Individual alert - magnitude of change',
    imageBeforeHover: (
      <img src={individualAlertDetails} alt="Individual alert details." />
    ),
    imageAfterHover: (
      <img
        src={magnitudeOfChange}
        alt="Absolute difference details - magnitude of change."
      />
    ),
  },
  {
    name: 'Individual alert - confidence',
    imageBeforeHover: (
      <img src={individualAlertDetails} alt="Individual alert details." />
    ),
    imageAfterHover: (
      <img src={confidence} alt="Absolute difference details - confidence." />
    ),
  },
];

const compareViewHoverableItems = [
  {
    name: 'Filter buttons - Hide uncomparable Results',
    imageBeforeHover: (
      <img src={compareViewFilters} alt="Filter buttons in Compare View." />
    ),
    imageAfterHover: (
      <img
        src={hideUncomparableResults}
        alt="Hide uncomparable results filter in Compare View."
      />
    ),
  },
  {
    name: 'Filter buttons - Show only important changes',
    imageBeforeHover: (
      <img src={compareViewFilters} alt="Filter buttons in Compare View" />
    ),
    imageAfterHover: (
      <img
        src={showOnlyImportantChanges}
        alt="Show only important changes filter in Compare View"
      />
    ),
  },
  {
    name: 'Filter buttons - Hide uncertain results',
    imageBeforeHover: (
      <img src={compareViewFilters} alt="Filter buttons in Compare View" />
    ),
    imageAfterHover: (
      <img
        src={hideUncertainResults}
        alt="Hide uncertain results filter in Compare View"
      />
    ),
  },
  {
    name: 'Filter buttons - Show only noise',
    imageBeforeHover: (
      <img src={compareViewFilters} alt="Filter buttons in Compare View" />
    ),
    imageAfterHover: (
      <img src={showOnlyNoise} alt="Show only noise filter in Compare View" />
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
