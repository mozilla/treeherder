import React from 'react';
import { Row, Pagination, PaginationItem, PaginationLink } from 'reactstrap';

class Paging extends React.Component {
  constructor(props) {
    super(props);
    this.validated = this.props.validated;
    this.state = {
      page: this.validated.page ? parseInt(this.validated.page, 10) : 1,
      count: 0,
    };
  }

  navigatePage = page => {
    this.setState({ page }, this.fetchAlertSummaries);
    this.props.validated.updateParams({ page });
  };

  render() {
    const { pageNums } = this.props;
    const { page, count } = this.state;
    return (
      <div>
        {pageNums.length > 1 && (
          <Row className="justify-content-center pb-5">
            {/* The first and last pagination navigation links
                  aren't working correctly (icons aren't visible)
                  so they haven't been added */}
            <Pagination aria-label={`Page ${page}`}>
              {page > 1 && (
                <PaginationItem>
                  <PaginationLink
                    className="text-info"
                    previous
                    onClick={() => this.navigatePage(page - 1)}
                  />
                </PaginationItem>
              )}
              {pageNums.map(num => (
                <PaginationItem
                  key={num}
                  active={num === page}
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
              {page < count && (
                <PaginationItem>
                  <PaginationLink
                    className="text-info"
                    next
                    onClick={() => this.navigatePage(page + 1)}
                  />
                </PaginationItem>
              )}
            </Pagination>
          </Row>
        )}
      </div>
    );
  }
}

export default Paging;
