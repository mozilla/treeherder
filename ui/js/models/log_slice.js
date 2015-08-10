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

                for (var k in this.buffer) {
                    if (this.buffer.hasOwnProperty(k)) {
                        size++;
                        if (this.buffer[k].used < baseDate) {
                            baseDate = this.buffer[k].used;
                            indexLRU = k;
                        }
                    }
                }

                if (size > this.buffer_size) {
                    delete this.buffer[indexLRU];
                }
            }
        };

        ThLogSliceModel.prototype.get_line_range = function(options, config) {
            config = config || {};
            var timeout = config.timeout || null;
            var found = this.find_in_buffer(options);
            var self = this;
            var deferred = $q.defer();

            if (found) {
                deferred.resolve(found);
                return deferred.promise;
            }

            return $http.get(ThLogSliceModel.get_uri(),{
                params: options,
                timeout: timeout
            }).then(function (res) {
                self.insert_into_buffer(options, res.data);

                return res.data;
            }, function (res) {
                return $q.reject("Log not found");
            });

        };

        return ThLogSliceModel;
    }]);
