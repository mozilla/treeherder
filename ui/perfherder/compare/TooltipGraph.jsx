import React from 'react';
import PropTypes from 'prop-types';
import numeral from 'numeral';
import { Table } from 'reactstrap';

export default class TooltipGraph extends React.Component {
  constructor(props) {
    super(props);

    this.canvasRef = React.createRef();
    this.context = null;
    this.state = {
      minValue: null,
      maxValue: null,
    };
  }

  componentDidMount() {
    const [minValue, maxValue] = this.calculateValues();
    this.setState({ minValue, maxValue });
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.state !== nextState;
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.minValue !== this.state.minValue) {
      const canvas = this.canvasRef.current;
      this.context = canvas.getContext('2d');
      this.context.globalAlpha = 0.3;
      this.plotValues();
    }
  }

  calculateValues = () => {
    const { replicates } = this.props;

    let maxValue = Math.max.apply(null, replicates);
    let minValue = Math.min.apply(null, replicates);

    if (maxValue - minValue > 1) {
      maxValue = Math.ceil(maxValue * 1.001);
      minValue = Math.floor(minValue / 1.001);
    }
    return [minValue, maxValue];
  };

  plotValues = () => {
    const { minValue, maxValue } = this.state;
    this.props.replicates.forEach((value) => {
      this.context.beginPath();
      this.context.arc(
        (180 / (maxValue - minValue)) * (value - minValue) + 5,
        18,
        5,
        0,
        360,
      );
      this.context.fillStyle = 'white';
      this.context.fill();
    });
  };

  abbreviatedNumber = (num) =>
    num.toString().length <= 5 ? num : numeral(num).format('0.0a');

  render() {
    const { minValue, maxValue } = this.state;
    return (
      <Table className="tooltip-table">
        {(minValue || maxValue) && (
          <tbody>
            <tr>
              <td className="value-column text-white">
                {this.abbreviatedNumber(minValue)}
              </td>
              <td className="distribution-column">
                <canvas ref={this.canvasRef} width={190} height={30} />
              </td>
              <td className="value-column text-white">
                {this.abbreviatedNumber(maxValue)}
              </td>
            </tr>
          </tbody>
        )}
      </Table>
    );
  }
}

TooltipGraph.propTypes = {
  replicates: PropTypes.arrayOf(PropTypes.number).isRequired,
};
