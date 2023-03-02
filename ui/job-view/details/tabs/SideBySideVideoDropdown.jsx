import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'reactstrap';

export default class SideBySideVideo extends React.Component {
  constructor(props) {
    super(props);
    const { url } = this.props;
    this.state = {
      url,
    };
  }

  onReplayHandler = () => {
    this.setState({ url: '' }, () => this.setState({ url: this.props.url }));
  };

  render() {
    const { value } = this.props;
    const { url } = this.state;
    return (
      <>
        <div>
          <img src={url} width="100%" alt={value} />
        </div>
        <div>
          <Button
            size="sm"
            className="mt-1 mr-1"
            onClick={this.onReplayHandler}
          >
            Reload
          </Button>
          <a href={url}>{value}</a>
        </div>
      </>
    );
  }
}

SideBySideVideo.propTypes = {
  url: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};
