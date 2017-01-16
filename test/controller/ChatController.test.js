/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
var assert = require('assert');
describe('message to group', function () {
    it('checkMessage', function (done) {
        var messageA = {
            'from': 1005,
            'opName': 'vb',
            'to': 'ausOperators',
            'date': new Date(),
            'message': 'From A to AUS group'
        };
        op1.post('/sendMessage', messageA, function (data, jwres) {
            assert.equal(jwres.statusCode, 200);
        });
        op2.on('messageNotification', function (data) {
            assert.equal(messageA.message, data.message);
            done();
        });
    });
    it('reterive Chat messages', function (done) {
        var request = {
            'from': 1005,
            'to': 'ausOperators',
            'duration': 2
        };
        var counter = 1;
        op1.post('/getChatConversation', request, function (data, jwres) {
            assert.equal(jwres.statusCode, 200);
        });
        op1.on('chatHistory', function (data) {
            assert.equal(counter, data.length);
            done();
        });
    });
});




