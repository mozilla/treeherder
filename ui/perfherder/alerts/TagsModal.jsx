import React from 'react';
import PropTypes from 'prop-types';
import { Modal, Button, Form } from 'react-bootstrap';

export default class TagsModal extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      tags: [],
    };
  }

  componentDidMount = async () => {
    const { alertSummary, performanceTags } = this.props;
    const activeTags = alertSummary.performance_tags || [];

    const tags = performanceTags.map((tag) => ({
      ...tag,
      active: activeTags.includes(tag.name),
    }));

    this.setState({
      tags,
    });
  };

  toggleTag = (index) => {
    const { tags } = this.state;

    tags[index].active = !tags[index].active;
    this.setState({ tags });
  };

  listTags = () => {
    return this.state.tags.map((tag, index) => {
      return (
        <Form.Check
          key={tag.name}
          data-testid={`modal-perf-tag ${tag.name}`}
          type="checkbox"
          id={tag.name}
          name={tag.name}
          label={tag.name}
          checked={tag.active}
          onChange={() => this.toggleTag(index)}
        />
      );
    });
  };

  getActiveTags = () => {
    const { tags } = this.state;
    const activeTags = tags.filter((tag) => tag.active);

    return activeTags.map((tag) => tag.name);
  };

  toggleModal = () => {
    const { toggle, alertSummary, performanceTags } = this.props;
    const activeTags = alertSummary.performance_tags || [];
    const tags = performanceTags.map((tag) => ({
      ...tag,
      active: activeTags.includes(tag.name),
    }));

    this.setState({
      tags,
    });

    toggle();
  };

  render() {
    const { showModal, updateAndClose } = this.props;

    return (
      <Modal
        show={showModal}
        onHide={this.toggleModal}
        data-testid="tags-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>Alert Tags</Modal.Title>
        </Modal.Header>
        <Form>
          <Modal.Body>
            <Form.Label htmlFor="performanceTags" />
            <Form.Group>{this.listTags()}</Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="darker-secondary"
              onClick={(event) => {
                updateAndClose(
                  event,
                  {
                    performance_tags: this.getActiveTags(),
                  },
                  'showTagsModal',
                );
              }}
              type="submit"
            >
              Save
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    );
  }
}

TagsModal.propTypes = {
  alertSummary: PropTypes.shape({}).isRequired,
  performanceTags: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  showModal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
  updateAndClose: PropTypes.func.isRequired,
};
