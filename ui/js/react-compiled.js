'use strict';

var ReactSelectComponent = React.createClass({
    displayName: 'ReactSelectComponent',
    propTypes: {
        list: React.PropTypes.array.isRequired,
        side: React.PropTypes.string.isRequired,
        filter: React.PropTypes.string
    },
    getInitialState: function () {
        return { loading: false };
    },
    // componentWillMount: function() {
    //     // allows it to show a spinner before the list is rendered.  It can
    //     // sometimes take a few seconds.
    //     this.setState({loading: true}, function() {
    //         setTimeout(function() {
    //             this.setState({loading: false});
    //         }.bind(this), 1000 / 60);
    //     });
    //
    // },
    render: function () {
        var filter = (this.props.filter || "").toLowerCase();
        var list = this.props.list || [];
        var el = null;

        if (this.state.loading) {
            el = React.createElement('span', { className: 'fa fa-spinner fa-pulse th-spinner' });
        } else {
            el = React.createElement(
                'select',
                { className: this.props.side, multiple: true },
                list.sort().map(function (item, index) {
                    // only create the item if there is no filter, or if
                    // there is a filter and it is a substring.
                    if (!filter || filter && item.toLowerCase().indexOf(filter) >= 0) {
                        return React.createElement(
                            'option',
                            { value: item,
                                key: index },
                            item
                        );
                    }
                })
            );
        }
        return el;
    }
});

treeherder.directive('reactselect', function (reactDirective) {
    return reactDirective(ReactSelectComponent);
});
