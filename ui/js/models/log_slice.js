'use strict';

treeherder.factory('ThLogSliceModel', [
    '$http', '$q', '$timeout', 'thUrl',
    function($http, $q, $timeout, thUrl) {

    // ThLogSliceModel is the js counterpart of logslice

    var ThLogSliceModel = function(job_id, buffer_chunk_size, buffer_size) {
        this.job_id = job_id;
        this.chunk_size = buffer_chunk_size || 500;
        this.buffer_size = buffer_size || 10;
        this.buffer = {};
    };

    ThLogSliceModel.get_uri = function(){return thUrl.getProjectUrl("/logslice/");};

    ThLogSliceModel.prototype.find_in_buffer = function (options) {
        var ret = [], arr;

        for (var i = options.start_line; i < options.end_line; i += this.chunk_size) {
            arr = this.buffer[Math.floor(i/this.chunk_size)] || false;

            if (arr) {
                // update for LRU
                arr.used = Date.now();
                ret = ret.concat(arr.data);
            } else {
                return false;
            }
        }    

        return ret;
    };

    ThLogSliceModel.prototype.insert_into_buffer = function (options, res) {
        for (var i = options.start_line, j = 0; i < options.end_line; i += this.chunk_size, j++) {
            this.buffer[Math.floor(i/this.chunk_size)] = {
                data: res.slice(j * this.chunk_size, (j+1) * this.chunk_size), 
                used: Date.now()
            };
        }

        var size = this.buffer_size + 1;

        while (size > this.buffer_size) {
            size = 0;
            var indexLRU = 0, baseDate = Date.now();

            for (var i in this.buffer) {
                if (this.buffer.hasOwnProperty(i)) {
                    size++;
                    if (this.buffer[i].used < baseDate) {
                        baseDate = this.buffer[i].used;
                        indexLRU = i;
                    }
                }
            }

            if (size > this.buffer_size) {
                delete this.buffer[indexLRU];
            }
        }
    };

    ThLogSliceModel.prototype.load_more = function (bounds, element) {
        var deferred = $q.defer(), range, req, above, below;
        var self = this;

        if (!this.loading) {
            // move the line number either up or down depending which boundary was hit
            this.line_number = moveLineNumber(bounds);

            range = {
                start: this.line_number,
                end: this.line_number
            };

            if (bounds.top) {
                above = getChunkAbove(range);
            } else if (bounds.bottom) {
                below = getChunkBelow(range);
            } else {
                range = getChunksSurrounding(this.line_number);
            }

            // dont do the call if we already have all the lines
            if ( range.start === range.end ) return deferred.promise;

            this.loading = true;

            this.get_line_range({
                job_id: this.job_id, 
                start_line: range.start, 
                end_line: range.end
            }).then(function(data) {
                var slicedData, length;

                drawErrorLines(data);

                if (bounds.top) {
                    for (var i = data.length - 1; i >= 0; i--) {
                        // make sure we are inserting at the right place
                        if (self.lines[0].index != data[i].index + 1) continue;
                        self.lines.unshift(data[i]);
                    }

                    $timeout(function () {
                        if (above) removeChunkBelow();
                    }, 100);
                } else if (bounds.bottom) {
                    var sh = element.scrollHeight;
                    var lines = self.lines;

                    for (var i = 0; i < data.length; i++) {
                        // make sure we are inserting at the right place
                        if (lines[ lines.length - 1 ].index != data[i].index - 1) continue;
                        self.lines.push(data[i]);
                    }

                    $timeout(function () {
                        if (below) {
                            removeChunkAbove();
                            element.scrollTop -= element.scrollHeight - sh;
                        }
                    }, 100);
                } else {
                    self.lines = data;
                }

                self.loading = false;
                deferred.resolve();
            });
        } else {
            deferred.reject();
        }

        return deferred.promise;
    };

    ThLogSliceModel.prototype.get_line_range = function(options, config) {
        config = config || {};
        var timeout = config.timeout || null;
        var found = this.find_in_buffer(options);
        var self = this;

        if (found) {
            var deferred = $q.defer();

            deferred.resolve(found);

            return deferred.promise;
        }

        return $http.get(ThLogSliceModel.get_uri(),{
            params: options,
            timeout: timeout
        }).then(function (res) {
            self.insert_into_buffer(options, res.data);

            return res.data;
        });
    };

    return ThLogSliceModel;
}]);
