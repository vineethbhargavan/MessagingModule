/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var Promise = require('es6-promise').Promise;
var sails = require('sails');

before(function (done) {

    // Increase the Mocha timeout so that Sails has enough time to lift.
    this.timeout(5000);
    var socketIOClient = require('socket.io-client');
    var sailsIOClient = require('sails.io.js');
    var redis = require("redis")
            , rclient = redis.createClient();
    rclient.flushdb(function (err, succeeded) {
        sails.log.info('Redis-DB flushall'+succeeded);
    });



    //var sailsIOClientB = require('sails.io.js');

    sails.lift({
    }, function (err, server) {
        if (err)
            return done(err);
        // here you can load fixtures, etc.
        //sails.log.info('Sails services'+AsteriskInterfaceService.checkValidCall());

        global.io = sailsIOClient(socketIOClient);
        //io.sails.url = 'http://localhost:8002';
        io.sails.autoConnect = false;
        global.op1 = io.sails.connect('http://localhost:8002');
        global.op2 = io.sails.connect('http://localhost:8002');
        done(err, sails);
    });
});

after(function (done) {
    // here you can clear fixtures, etc.
    this.timeout(5000);
    sails.log.info('Socket After disconnect');
    //op1.disconnect();
    delay(1000)
            .then(disconnectSocket.bind({socket: op1}))
            .then(disconnectSocket.bind({socket: op2}))
            .then(shutdownSails.bind({done: done}))
            .catch(function (err) {
                sails.log.info('Error during shutdowm' + err);
            });

});
var delay = function (time) {
    return new Promise(function (resolve) {
        setTimeout(function () {
            sails.log.info('############delaydelaydelaydelaydelay');
            return resolve();
        }, time);
    });
};
var disconnectSocket = function (socket) {
    if (socket === undefined)
        socket = this.socket;
    return new Promise(function (resolve, reject) {
        if (socket.isConnected()) {
            sails.log.info('Socket After disconnect -exec');
            socket.disconnect();
            return resolve();
        } else {
            return reject('No Socket');
        }
    });
};
var shutdownSails = function () {
    var done = this.done;
    return new Promise(function (resolve) {
        sails.log.info('@@@@@@@@@@@@setTimeout disconnect -exec');
        setTimeout(function () {
            sails.log.info('############setTimeout disconnect -exec');
            sails.lower(done);
            resolve(done());
        }, 2000);
    });
};
