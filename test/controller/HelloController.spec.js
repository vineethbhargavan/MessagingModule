/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

var HelloController = require('../../api/controllers/HelloController'),
        sinon = require('sinon'),
        assert = require('assert');

describe('The Hello Controller', function () {
    describe('when we invoke the index action', function () {

        it('should return hello world message', function () {
            //var mockstring ='mock';
            sinon.stub(TestService, 'sayHello', function (mockstring,cb) {
                return cb('Hello I am the mocked Service');
            });

            // Mocking res.send() method by using a sinon spy
            var send = sinon.spy();

            // Executes controller action
            HelloController.index(null, {
                'send': send
            });

            // Asserts send() method was called and that it was called
            // with the correct arguments: 'Hello World'
            assert(send.called);
            assert(send.calledWith('Our service has a message for you: Hello I am the mocked Service'));
        });
    });
});
