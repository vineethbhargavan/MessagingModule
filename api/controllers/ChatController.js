/**
 * ChatController
 *
 * @description :: Server-side logic for managing chats
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var Promise = require('es6-promise').Promise;
//var sails = require('sails');
var uuid = require('node-uuid');

module.exports = {
    sendMessage: function (req, res) {
        var data = req.allParams();
        data.chatId = uuid.v1();
        data.timestamp = new Date().getTime();
        sails.log.info('sendMessage chatID' + data.chatId);
        updateMessage(data)
                .then(notifyGroup)
                .then(sendAck.bind({res: res}))
                .catch(function (err) {
                    sails.log.info('Error in Executing' + err);
                });

    }, getChatConversation: function (req, res) {
        var data = req.allParams();
        sails.log.info('getChatConversation');
        fetchChatHistory(data)
                .then(sendAck.bind({res: res}))
                .catch(function (err) {
                    sails.log.info('Error in Executing' + err);
                });

    }
};
var fetchChatHistory = function (data) {
    return new Promise(function (resolve, reject) {
        if (data !== undefined) {
            var currentTime = new Date().getTime();
            var previousInterval = currentTime - (24 * 60 * 60 * 1000 * data.duration);
            var where = {};
            where.timestamp = {'>': previousInterval, '<': currentTime};
            where.from = data.from;
            where.to = data.to;
            Chat.find(where).exec(function (err, result) {
                if (err)
                    return reject(err);
                sails.log.info('fetchChatHistory Results' + JSON.stringify(result));
                sails.sockets.broadcast(data.from, 'chatHistory', result);
                return resolve(result);
            });
        } else {
            return reject('Invalid Param');
        }

    });
};


var updateMessage = function (data) {
    return new Promise(function (resolve, reject) {
        if (data !== undefined) {
            Chat.create(data).exec(function (err, result) {
                if (err)
                    return reject(err);
                resolve(result);
            });
        } else {
            return reject('Invalid Param');
        }

    });
};

var notifyGroup = function (result) {
    return new Promise(function (resolve) {
        sails.sockets.broadcast(result.to, 'messageNotification', result);
        return resolve(result);
    });
};
var sendAck = function () {
    var res = this.res;
    return new Promise(function (resolve) {
        return resolve(res.send());
    });
};