'use strict';
var jobPlatformDataComponent = React.createClass({
    displayName: 'jobPlatformDataComponent',
    propTypes: {
        id: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        option: React.PropTypes.string.isRequired,
    },
    render() {
        var titleText = `${this.props.name} ${this.props.option}`;
        return React.DOM.td(
            { className: 'platform', },
            React.DOM.span(
                { title: titleText, },
                titleText
            )
        );
    }
});

treeherder.directive('jobplatformtd', function (reactDirective) {
    return reactDirective(jobPlatformDataComponent);
});

