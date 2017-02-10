'use strict';

var ReactSelectComponent = React.createClass({
    displayName: 'ReactSelectComponent',
    propTypes: {
        list: React.PropTypes.array.isRequired,
        side: React.PropTypes.string.isRequired,
        filter: React.PropTypes.string
    },
    componentDidMount: function() {
        var keyShortcuts = [
            // Shortcut: select all
            ['mod+a', function(ev) {
                ev.preventDefault();
                Array.prototype.slice.call(ev.target.options).map(function (op) {
                    op.selected = true;
                });
            }]
        ];
        keyShortcuts.map(function(data) {
            Mousetrap.bind(data[0], data[1]);
        });
    },
    render: function () {
        var filter = (this.props.filter || "").toLowerCase();
        var list = this.props.list || [];
        var classList = [this.props.side, 'mousetrap'];

        return React.createElement(
            'select',
            { className: classList.join(' '), multiple: true },
            list.sort().map(function (item, index) {
                // only create the item if there is no filter, or if
                // there is a filter and this matches as a substring.
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
});

treeherder.directive('reactselect', function (reactDirective) {
    return reactDirective(ReactSelectComponent);
});
