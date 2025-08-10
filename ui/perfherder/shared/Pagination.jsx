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
      /* The first and last pagination navigation links
         aren't working correctly (icons aren't visible)
         so they haven't been added */
      <Pagination aria-label={`Page ${currentPage}`}>
        <Pagination.First
          className="text-info"
          disabled={!firstButtonAvailable}
          onClick={() => this.navigatePage(1)}
        />
        <Pagination.Prev
          className="text-info"
          disabled={!prevButtonAvailable}
          onClick={() => this.navigatePage(currentPage - 1)}
        />
        {viewablePageNums.map((num) => (
          <Pagination.Item
            key={num}
            active={num === currentPage}
            className="text-info pagination-active"
            onClick={() => this.navigatePage(num)}
            aria-label={`pagination-button-${num}`}
          >
            {num}
          </Pagination.Item>
        ))}
        <Pagination.Next
          className="text-info"
          disabled={!nextButtonAvailable}
          onClick={() => this.navigatePage(currentPage + 1)}
        />
        <Pagination.Last
          className="text-info"
          disabled={!lastButtonAvailable}
          onClick={() => this.navigatePage(count)}
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
