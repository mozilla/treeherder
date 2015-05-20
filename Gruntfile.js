/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

module.exports = function(grunt) {

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        clean: ['dist/'],

        htmlangular: {
            options: {
                reportpath: null
            },
            files: {
                src: ['webapp/app/*.html'],
                nonull: true
            },
        },

        useminPrepare:{
            index: {
                src:'webapp/app/index.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            help: {
                src:'webapp/app/help.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            logviewer: {
                src:'webapp/app/logviewer.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
            perf: {
                src:'webapp/app/perf.html',
                nonull: true,
                options:{
                    dest:'dist'
                }
            },
        },

        usemin:{ html:['dist/index.html', 'dist/help.html', 'dist/logviewer.html',
                       'dist/perf.html'] },

        'cache-busting': {
            indexjs: {
                replace: ['dist/**/*.html'],
                replacement: 'index.min.js',
                file: 'dist/js/index.min.js',
                cleanup: true //Remove previously generated hashed files.
            },
            logviewerjs: {
                replace: ['dist/**/*.html'],
                replacement: 'logviewer.min.js',
                file: 'dist/js/logviewer.min.js',
                cleanup: true
            },
            perfjs: {
                replace: ['dist/**/*.html'],
                replacement: 'perf.min.js',
                file: 'dist/js/perf.min.js',
                cleanup: true
            },
            indexcss: {
                replace: ['dist/**/*.html'],
                replacement: 'index.min.css',
                file: 'dist/css/index.min.css',
                cleanup: true
            },
            logviewercss: {
                replace: ['dist/**/*.html'],
                replacement: 'logviewer.min.css',
                file: 'dist/css/logviewer.min.css',
                cleanup: true
            },
            perfcss: {
                replace: ['dist/**/*.html'],
                replacement: 'perf.min.css',
                file: 'dist/css/perf.min.css',
                cleanup: true
            },
            helpcss: {
                replace: ['dist/**/*.html'],
                replacement: 'help.min.css',
                file: 'dist/css/help.min.css',
                cleanup: true
            }
        },

        copy:{

            main: {
                files: [
                    { src:'webapp/app/index.html', dest:'dist/index.html', nonull: true },
                    { src:'webapp/app/help.html', dest:'dist/help.html', nonull: true },
                    { src:'webapp/app/logviewer.html', dest:'dist/logviewer.html', nonull: true },
                    { src:'webapp/app/perf.html', dest:'dist/perf.html', nonull: true }
                ]
            },
            // Copy img dir
            img:{
                expand: true,
                src: 'webapp/app/img/*',
                dest: 'dist/img/',
                nonull: true,
                flatten: true
                },
            // Copy html in partials
            partials:{
                expand: true,
                src: 'webapp/app/partials/*',
                dest: 'dist/partials/',
                nonull: true,
                flatten: true
                },
            // Copy fonts
            fonts:{
                expand: true,
                src: 'webapp/app/fonts/*',
                dest: 'dist/fonts/',
                nonull: true,
                flatten: true
                },
            // Copy html in plugins, make sure not to flatten
            // to retain the directory structure for the html
            // and make paths relative with cwd definition.
            plugins:{
                expand: true,
                cwd: 'webapp/app/plugins/',
                src: '**/*.html',
                dest: 'dist/plugins/',
                nonull: true,
                flatten: false
                }
        },
        uglify:{
            options:{
                report: 'min',
                // Cannot use mangle, it will break angularjs's dependency
                // injection
                mangle: false
            }
        },
        ngtemplates: {
            treeherder: {
                cwd: 'webapp/app',
                src: ['partials/main/*.html', 'plugins/**/*.html'],
                dest: 'dist/js/index.min.js',
                options: {
                    usemin: 'dist/js/index.min.js',
                    append: true,
                    htmlmin: {
                        collapseBooleanAttributes:      true,
                        collapseWhitespace:             true,
                        conservativeCollapse:           true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      true,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true,
                        keepClosingSlash: true
                    }
                }
            },
            logviewer: {
                cwd: 'webapp/app',
                src: 'partials/logviewer/*.html',
                dest: 'dist/js/logviewer.min.js',
                options: {
                    usemin: 'dist/js/logviewer.min.js',
                    append: true,
                    htmlmin: {
                        collapseBooleanAttributes:      true,
                        collapseWhitespace:             true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      true,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true,
                        keepClosingSlash: true
                    }
                }
            },
            perf: {
                cwd: 'webapp/app',
                src: 'partials/perf/*.html',
                dest: 'dist/js/perf.min.js',
                options: {
                    usemin: 'dist/js/perf.min.js',
                    append: true,
                    htmlmin: {
                        collapseBooleanAttributes:      true,
                        collapseWhitespace:             true,
                        removeAttributeQuotes:          true,
                        removeComments:                 true,
                        removeEmptyAttributes:          true,
                        removeRedundantAttributes:      true,
                        removeScriptTypeAttributes:     true,
                        removeStyleLinkTypeAttributes:  true,
                        keepClosingSlash: true
                    }
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-usemin');
    grunt.loadNpmTasks('grunt-cache-busting');
    grunt.loadNpmTasks('grunt-angular-templates');
    grunt.loadNpmTasks('grunt-html-angular-validate');

    // Default tasks
    grunt.registerTask('build', [
        'clean',
        'copy:main',
        'copy:img',
        'copy:fonts',
        'useminPrepare',
        'concat',
        'cssmin',
        'uglify',
        'usemin',
        'ngtemplates',
        'cache-busting'
        ]);
};
