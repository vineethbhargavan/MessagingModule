/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */


//var client = require('../../assets/js/dependencies/sails.io.js');

//global.io = new client(require('socket.io-client'));
//io.sails.url = 'http://localhost:8002/';
//var io = require('../../assets/js/dependencies/sails.io.js')( require('socket.io-client') );

//    var socketIOClient  = require('socket.io-client');
//    var sailsIOClient  = require('sails.io.js');
//    var io = sailsIOClient(socketIOClient);
//    io.sails.url = 'http://localhost:8002';
var assert = require('assert');
var sinon = require('sinon');

describe('socket request', function () {
    this.timeout(10000);
    var counter = 0;
    it('launchUsers', function (done) {
        var chatgroupsA = ['ausOperators', '1005'];
        var chatgroupsB = ['ausOperators', '1999'];

        var clientA = {
            'operatorId': 1005,
            'name': 'vb',
            'chatgroup': chatgroupsA
        };
        var clientB = {
            'operatorId': 1999,
            'name': 'vb',
            'chatgroup': chatgroupsB
        };
        op1.post('/handshakeResponse', clientA, function (data, jwres) {
            assert.equal(jwres.statusCode, 200);
            //done();
        });
//        var op2 = io.sails.connect('http://localhost:8002');
        op2.post('/handshakeResponse', clientB, function (data, jwres) {

            assert.equal(jwres.statusCode, 200);
            //done();
        });
        op1.on('updateOperatorList', function (data) {
            counter++;
            if (counter === 3) {
                assert.equal(data, chatgroupsA[0]);
                done();
            }
            //console.log('@@@@@@updateOperatorList request recived for ' + data + counter);
        });

    });
    it('CheckNoOfNotifications', function (done) {
        assert.equal(counter, 3);
        done();
    });
    it('Initiate a Transfer Request', function (done) {
        var transferReq = {};
        transferReq.ticketId = '72020';
        transferReq.transferer = '1005';
        transferReq.transferee = '1999';
        transferReq.transferNotes = 'Test notes';
        transferReq.ack = 0;
        transferReq.conference = '1005_2343243.3243';
        transferReq.operatorChannel = 'SIP/888-4545';
        transferReq.customerChannel = 'DHADI-Go-2324214';


        var checkParam = function (val) {
            return val;
        };

        sinon.stub(AsteriskInterfaceService, 'checkValidCall', function (mockvar, cb) {
            return cb(true);
        });
        
//        sinon.stub(sails.controllers.operator, 'waitForTransfereeAction', function () {
//            return transferReq.ticketId;
//        });
        op1.post('/initiateTransfer', transferReq, function (data, jwres) {
            assert.equal(jwres.statusCode, 200);
            //done();
        });
        op2.on('transferRequest', function (data) {
            assert.equal(data.ticketId, transferReq.ticketId);
            done();
        });

    });
});




        