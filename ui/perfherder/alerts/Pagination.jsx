import React from 'react';
import PropTypes from 'prop-types';
import { Pagination, PaginationItem, PaginationLink } from 'reactstrap';

class PaginationGroup extends React.Component {
  navigatePage = (page) => {
    const { fetchData, updateParams } = this.props;
    fetchData(undefined, false, parseInt(page, 10));
    updateParams({ page });
  };

  render() {
    const { viewablePageNums, currentPage, count } = this.props;
    // First and last viewable pages from the pagination. The controls
    // shows maximum 5 pages.
    const firstViewablePage = viewablePageNums[0];
    const lastViewablePage = viewablePageNums[viewablePageNums.length - 1];

    return (
      /* The first and last pagination navigation links
         aren't working correctly (icons aren't visible)
         so they haven't been added */
      <Pagination aria-label={`Page ${currentPage}`}>
        {firstViewablePage > 1 && (
          <PaginationItem className="text-info">
            <PaginationLink
              className="text-info"
              first
              onClick={() => this.navigatePage(1)}
            />
          </PaginationItem>
        )}
        {currentPage > 1 && (
          <PaginationItem>
            <PaginationLink
              className="text-info"
              previous
              onClick={() => this.navigatePage(currentPage - 1)}
            />
          </PaginationItem>
        )}
        {viewablePageNums.map((num) => (
          <PaginationItem
            key={num}
            active={num === currentPage}
            className="text-info pagination-active"
          >
            <PaginationLink
              className="text-info"
              onClick={() => this.navigatePage(num)}
            >
              {num}
            </PaginationLink>
          </PaginationItem>
        ))}
        {currentPage < count && (
          <PaginationItem>
            <PaginationLink
              className="text-info"
              next
              onClick={() => this.navigatePage(currentPage + 1)}
            />
          </PaginationItem>
        )}
        {lastViewablePage < count && (
          <PaginationItem className="text-info">
            <PaginationLink
              className="text-info"
              last
              onClick={() => this.navigatePage(count)}
            />
          </PaginationItem>
        )}
      </Pagination>
    );
  }
}

PaginationGroup.propTypes = {
  viewablePageNums: PropTypes.arrayOf(PropTypes.number).isRequired,
  currentPage: PropTypes.number,
  count: PropTypes.number,
  fetchData: PropTypes.func.isRequired,
  updateParams: PropTypes.func.isRequired,
};

PaginationGroup.defaultProps = {
  currentPage: 1,
  count: 1,
};

export default PaginationGroup;
