module.exports = function(grunt) {

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),

        useminPrepare:{
            html:'webapp/app/index.html',
            options:{
                dest:'dist'
            }
        },
        usemin:{ html:['dist/index.html'] },
        copy:{

            main: {

                files: [

                    { src:'webapp/app/index.html', dest:'dist/index.html' },

                    { src:'webapp/app/help.html', dest:'dist/help.html' },

                    { src:'webapp/app/logviewer.html', dest:'dist/logviewer.html' }
                ],
            },
            // Copy img dir
            img:{
                expand: true,
                src: 'webapp/app/img/*',
                dest: 'dist/img/',
                flatten: true
                },
            partials:{
                expand: true,
                src: 'webapp/app/partials/*',
                dest: 'dist/partials/',
                flatten: true
                },
            fonts:{
                expand: true,
                src: 'webapp/app/fonts/*',
                dest: 'dist/fonts/',
                flatten: true
                },
        },
        uglify:{
            options:{
                report: 'min',
                compress: true,
                // Cannot use mangle, it will break angularjs's dependency
                // injection
                mangle: false
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-usemin');

    // Default tasks
    grunt.registerTask('build', [

        'copy:main',
        'copy:img',
        'copy:partials',
        'copy:fonts',
        'useminPrepare',
        'concat',
        'cssmin',
        'uglify',
        'usemin'
        ]);


};
