import React from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  Label,
  CustomInput,
} from 'reactstrap';

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
        <CustomInput
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
      <Modal isOpen={showModal} data-testid="tags-modal">
        <ModalHeader toggle={this.toggleModal}>Alert Tags</ModalHeader>
        <Form>
          <ModalBody>
            <Label for="performanceTags" />
            <FormGroup>{this.listTags()}</FormGroup>
          </ModalBody>
          <ModalFooter>
            <Button
              color="darker-secondary"
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
          </ModalFooter>
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
