/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


module.exports = function (grunt) {

    grunt.config.set('jshint', {
        jshint: {
            src: ['api/**/*.js']
        }
    });
    grunt.loadNpmTasks('grunt-contrib-jshint');
};
