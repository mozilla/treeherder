import React from 'react';
import PropTypes from 'prop-types';
import { Pagination } from 'react-bootstrap';

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
      <Pagination aria-label={`Page ${currentPage}`}>
        <Pagination.First
          disabled={!firstButtonAvailable}
          onClick={() => this.navigatePage(1)}
          linkClassName="text-info d-flex align-items-center justify-content-center"
        />
        <Pagination.Prev
          disabled={!prevButtonAvailable}
          onClick={() => this.navigatePage(currentPage - 1)}
          linkClassName="text-info d-flex align-items-center justify-content-center"
        />
        {viewablePageNums.map((num) => {
          const isActive = num === currentPage;
          return (
            <Pagination.Item
              key={num}
              active={isActive}
              onClick={() => this.navigatePage(num)}
              linkClassName="text-info d-flex align-items-center justify-content-center"
              aria-label={`Go to page ${num}`}
            >
              {num}
            </Pagination.Item>
          );
        })}
        <Pagination.Next
          disabled={!nextButtonAvailable}
          onClick={() => this.navigatePage(currentPage + 1)}
          linkClassName="text-info d-flex align-items-center justify-content-center"
        />
        <Pagination.Last
          disabled={!lastButtonAvailable}
          onClick={() => this.navigatePage(count)}
          linkClassName="text-info d-flex align-items-center justify-content-center"
        />
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
