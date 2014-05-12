module.exports = function(grunt) {

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        clean: ['dist/'],

        useminPrepare:{
            index: {
                src:'webapp/app/index.html',
                options:{
                    dest:'dist'
                }
            },
            help: {
                src:'webapp/app/help.html',
                options:{
                    dest:'dist'
                }
            },
            logviewer: {
                src:'webapp/app/logviewer.html',
                options:{
                    dest:'dist'
                }
            }
        },

        usemin:{ html:['dist/index.html', 'dist/help.html', 'dist/logviewer.html'] },

        copy:{

            main: {

                files: [

                    { src:'webapp/app/index.html', dest:'dist/index.html' },

                    { src:'webapp/app/help.html', dest:'dist/help.html' },

                    { src:'webapp/app/logviewer.html', dest:'dist/logviewer.html' },

                    { src:'webapp/app/vendor/zeroclipboard/ZeroClipboard.swf', dest:'dist/vendor/zeroclipboard/ZeroClipboard.swf' }
                ]
            },
            // Copy img dir
            img:{
                expand: true,
                src: 'webapp/app/img/*',
                dest: 'dist/img/',
                flatten: true
                },
            // Copy html in partials
            partials:{
                expand: true,
                src: 'webapp/app/partials/*',
                dest: 'dist/partials/',
                flatten: true
                },
            // Copy fonts
            fonts:{
                expand: true,
                src: 'webapp/app/fonts/*',
                dest: 'dist/fonts/',
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
        }
    });

    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-usemin');

    // Default tasks
    grunt.registerTask('build', [
        'clean',
        'copy:main',
        'copy:img',
        'copy:partials',
        'copy:fonts',
        'copy:plugins',
        'useminPrepare',
        'concat',
        'cssmin',
        'uglify',
        'usemin'
        ]);


};
