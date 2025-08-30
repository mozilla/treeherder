import React from 'react';
import PropTypes from 'prop-types';
import { Pagination } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faAngleDoubleLeft,
  faAngleLeft,
  faAngleRight,
  faAngleDoubleRight,
} from '@fortawesome/free-solid-svg-icons';

class PaginationGroup extends React.Component {
  navigatePage = (page) => {
    const { updateParams } = this.props;
    updateParams({ page });
  };

  render() {
    const { viewablePageNums, currentPage, count } = this.props;
    // First and last viewable pages from the pagination. The controls
    // shows maximum 5 pages.
    const firstViewablePage = viewablePageNums[0];
    const lastViewablePage = viewablePageNums[viewablePageNums.length - 1];

    const firstButtonAvailable = firstViewablePage > 1;
    const prevButtonAvailable = currentPage > 1;
    const nextButtonAvailable = currentPage < count;
    const lastButtonAvailable = lastViewablePage < count;

    return (
      /* The first and last pagination navigation links
         aren't working correctly (icons aren't visible)
         so they haven't been added */
      <Pagination aria-label={`Page ${currentPage}`}>
        <li className="page-item">
          <button
            className="page-link text-info"
            disabled={!firstButtonAvailable}
            onClick={() => this.navigatePage(1)}
            aria-label="Go to first page"
          >
            <FontAwesomeIcon icon={faAngleDoubleLeft} />
          </button>
        </li>
        <li className="page-item">
          <button
            className="page-link text-info"
            disabled={!prevButtonAvailable}
            onClick={() => this.navigatePage(currentPage - 1)}
            aria-label="Go to previous page"
          >
            <FontAwesomeIcon icon={faAngleLeft} />
          </button>
        </li>
        {viewablePageNums.map((num) => {
          const isActive = num === currentPage;
          return (
            <li key={num} className="page-item">
              <button
                className={`page-link text-info ${isActive ? 'active' : ''}`}
                onClick={() => this.navigatePage(num)}
                aria-label={`Go to page ${num}`}
                aria-current={isActive ? 'page' : undefined}
                disabled={isActive}
                style={isActive ? { backgroundColor: '#e9ecef' } : undefined}
              >
                {num}
              </button>
            </li>
          );
        })}
        <li className="page-item">
          <button
            className="page-link text-info"
            disabled={!nextButtonAvailable}
            onClick={() => this.navigatePage(currentPage + 1)}
            aria-label="Go to next page"
          >
            <FontAwesomeIcon icon={faAngleRight} />
          </button>
        </li>
        <li className="page-item">
          <button
            className="page-link text-info"
            disabled={!lastButtonAvailable}
            onClick={() => this.navigatePage(count)}
            aria-label="Go to last page"
          >
            <FontAwesomeIcon icon={faAngleDoubleRight} />
          </button>
        </li>
      </Pagination>
    );
  }
}

PaginationGroup.propTypes = {
  viewablePageNums: PropTypes.arrayOf(PropTypes.number).isRequired,
  currentPage: PropTypes.number,
  count: PropTypes.number,
  updateParams: PropTypes.func.isRequired,
};

PaginationGroup.defaultProps = {
  currentPage: 1,
  count: 1,
};

export default PaginationGroup;
