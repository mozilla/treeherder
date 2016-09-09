'use strict';

var ReactSelectComponent = React.createClass({
    displayName: 'ReactSelectComponent',
    propTypes: {
        list: React.PropTypes.array.isRequired,
        side: React.PropTypes.string.isRequired,
        filter: React.PropTypes.string
    },
    render: function () {
        var filter = (this.props.filter || "").toLowerCase();
        var list = this.props.list || [];

        return (
            <select className={this.props.side} multiple>
                {
                    list.sort().map(function (item, index) {
                        // only create the item if there is no filter, or if
                        // there is a filter and this matches as a substring.
                        if (!filter || (filter && item.toLowerCase().indexOf(filter) >= 0)) {
                            return <option value={item}
                                           key={index}>{item}</option>;
                        }
                    })
                }
            </select>
        )
    }
});

treeherder.directive('reactselect', function (reactDirective) {
    return reactDirective(ReactSelectComponent);
});
