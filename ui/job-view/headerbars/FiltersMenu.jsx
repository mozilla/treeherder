import React from 'react';
import PropTypes from 'prop-types';
import { thAllResultStatuses } from '../../js/constants';

export default class FiltersMenu extends React.Component {
  constructor(props) {
    super(props);

    this.resultStatuses = thAllResultStatuses.slice();
    this.resultStatuses.splice(thAllResultStatuses.indexOf('runnable'), 1);

    this.toggleResultStatuses = this.toggleResultStatuses.bind(this);
  }

  isFilterOn(field) {
    const { jobFilters } = this.props;

    return [
      ...jobFilters.getResultStatusArray(),
      ...jobFilters.getClassifiedStateArray(),
    ].includes(field);
  }

  toggleResultStatuses(filterName) {
    const { jobFilters, recalculateUnclassified } = this.props;

    jobFilters.toggleResultStatuses([filterName]);
    recalculateUnclassified();
  }

  toggleClassifiedFilter(filterName) {
    const { jobFilters } = this.props;

    jobFilters.toggleClassifiedFilter(filterName);
  }

  render() {
    const { jobFilters, pinJobs } = this.props;

    return (
      <span>
        <span className="dropdown">
          <button
            id="filterLabel"
            title="Set filters"
            data-toggle="dropdown"
            className="btn btn-view-nav nav-menu-btn dropdown-toggle"
          >Filters</button>
          <ul
            id="filter-dropdown"
            className="dropdown-menu nav-dropdown-menu-right checkbox-dropdown-menu"
            role="menu"
            aria-labelledby="filterLabel"
          >
            <li>
              {this.resultStatuses.map(filterName => (
                <span key={filterName}>
                  <span>
                    <label className="dropdown-item">
                      <input
                        type="checkbox"
                        className="mousetrap"
                        id={filterName}
                        checked={this.isFilterOn(filterName)}
                        onChange={() => this.toggleResultStatuses(filterName)}
                      />{filterName}
                    </label>
                  </span>
                </span>
              ))}
            </li>
            <li className="dropdown-divider separator" />
            <label className="dropdown-item">
              <input
                type="checkbox"
                id="classified"
                checked={this.isFilterOn('classified')}
                onChange={() => this.toggleClassifiedFilter('classified')}
              />classified
            </label>
            <label className="dropdown-item">
              <input
                type="checkbox"
                id="unclassified"
                checked={this.isFilterOn('unclassified')}
                onChange={() => this.toggleClassifiedFilter('unclassified')}
              />unclassified
            </label>
            <li className="dropdown-divider separator" />
            <li
              title="Pin all jobs that pass the global filters"
              className="dropdown-item"
              onClick={pinJobs}
            >Pin all showing</li>
            <li
              title="Show only superseded jobs"
              className="dropdown-item"
              onClick={jobFilters.setOnlySuperseded}
            >Superseded only</li>
            <li
              title="Reset to default status filters"
              className="dropdown-item"
              onClick={jobFilters.resetNonFieldFilters}
            >Reset</li>
          </ul>
        </span>
      </span>

    );
  }
}

FiltersMenu.propTypes = {
  jobFilters: PropTypes.object.isRequired,
  pinJobs: PropTypes.func.isRequired,
  recalculateUnclassified: PropTypes.func.isRequired,
};
