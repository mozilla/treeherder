import React from 'react';
import PropTypes from 'prop-types';
import { Pagination } from 'react-bootstrap';

class PaginationGroup extends React.Component {
  navigatePage = (page) => {
    const { updateParams } = this.props;
    updateParams({ page });
  };

  render() {
    const { viewablePageNums, currentPage = 1, count = 1 } = this.props;
    // First and last viewable pages from the pagination. The controls
    // shows maximum 5 pages.
    const firstViewablePage = viewablePageNums[0];
    const lastViewablePage = viewablePageNums[viewablePageNums.length - 1];

    const firstButtonAvailable = firstViewablePage > 1;
    const prevButtonAvailable = currentPage > 1;
    const nextButtonAvailable = currentPage < count;
    const lastButtonAvailable = lastViewablePage < count;

    return (
      <Pagination
        aria-label={`Page ${currentPage}`}
        className="custom-pagination"
      >
        <Pagination.First
          disabled={!firstButtonAvailable}
          onClick={() => this.navigatePage(1)}
          linkClassName="d-flex align-items-center justify-content-center"
        >
          <span aria-hidden="true">«</span>
          <span className="sr-only">First</span>
        </Pagination.First>
        <Pagination.Prev
          disabled={!prevButtonAvailable}
          onClick={() => this.navigatePage(currentPage - 1)}
          linkClassName="d-flex align-items-center justify-content-center"
        >
          <span aria-hidden="true">‹</span>
          <span className="sr-only">Previous</span>
        </Pagination.Prev>
        {viewablePageNums.map((num) => {
          const isActive = num === currentPage;
          return (
            <Pagination.Item
              key={num}
              active={isActive}
              onClick={() => this.navigatePage(num)}
              linkClassName="d-flex align-items-center justify-content-center"
              aria-label={`Go to page ${num}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span aria-hidden={isActive}>{num}</span>
              {isActive && <span className="sr-only">Current page</span>}
            </Pagination.Item>
          );
        })}
        <Pagination.Next
          disabled={!nextButtonAvailable}
          onClick={() => this.navigatePage(currentPage + 1)}
          linkClassName="d-flex align-items-center justify-content-center"
        >
          <span aria-hidden="true">›</span>
          <span className="sr-only">Next</span>
        </Pagination.Next>
        <Pagination.Last
          disabled={!lastButtonAvailable}
          onClick={() => this.navigatePage(count)}
          linkClassName="d-flex align-items-center justify-content-center"
        >
          <span aria-hidden="true">»</span>
          <span className="sr-only">Last</span>
        </Pagination.Last>
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

export default PaginationGroup;
