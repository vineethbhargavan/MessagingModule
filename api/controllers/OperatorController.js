/**
 * OperatorController
 *
 * @description :: Server-side logic for managing operators
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
var Promise = require('es6-promise').Promise;
module.exports = {
    testSocket: function (req, res) {
        var roomId = req.param('operatorId');
        sails.log.info('testSocket' + roomId);
        res.send();
    },
    handshakeResponse: function (req, res) {
        var roomId = req.param('operatorId');
        var chatgroup = req.param('chatgroup');
        var values = req.allParams();
        sails.log.info('Socket check' + req.isSocket);
        sails.log.info('join request' + values.operatorId);
        sails.log.info('SocketID' + sails.sockets.getId(req));
        if (req.isSocket) {
            sails.log.info('availableRooms chatgroup' + chatgroup);
            socketJoin(req, res, chatgroup)
                    .then(createOperatorObj)
                    .then(updateOpprf.bind({query: {id: roomId, flag: 1}}))
                    .then(updateUsers.bind({query: {id: roomId, logged_in: 1, last_login: new Date()}}))
                    .then(updateSocketSubscribers)
                    .then(setSessionVariables.bind({req: req, res: res}))
                    .catch(function (err) {
                        sails.log.info('Error in Executing' + err);
                    });
        }
    }, initiateTransfer: function (req) {
        var data = req.allParams();
        sails.log.info('transferRequest transferRequest ', data.transferee);
        if (data.transferee !== undefined) {
            //create A transferRequestObject
            //first check if the ticket is valid.
            checkValidCall(data)
                    .then(createTransferReq)
                    .then(notifyOperator)
                    .then(waitForTransfereeAction)
                    .then(findTransferRequest)
                    .then(clearTransferReq)
                    .then(notifyOperator)
                    .catch(function (err) {
                        sails.log.info(err);
                    });
        }
    }, logout: function (opid, chatgroup, callback) {
        sails.log.info('Inside logout action');
        updateOpprf(opid, {id: opid, flag: 0, isbusy: 0})
                .then(updateUsers.bind({query: {id: opid, logged_in: 0, last_active: new Date()}}))
                .then(findOperator)
                .then(flushOutOperator)
                .then(callback)
                .catch(function (err) {
                    sails.log.info(err);
                });
    }, transferRequestAck: function (req) {
        var data = req.allParams();
        sails.log.info('TransferRequest ACK received for' + JSON.stringify(data));
        if (data.ack === 200) {
            AsteriskInterfaceService.setHangupFlagOnOriginator(data);
            updateOpprf(data.transferee, {id: data.transferee, isblocked: 1})
                    .catch(function (err) {
                        sails.log.info(err);
                    });
        }
        transferRequestUpdate(data)
                .then(notifyOperator)
                .catch(function (err) {
                    sails.log.info(err);
                });
    }, joinCall: function (req) {
        var data = req.allParams();
        sails.log.info('joinCall received for' + JSON.stringify(data));
        AsteriskInterfaceService.joinCall(data);

    }, joinCallComplete: function (operatorId, ticketId) {
        sails.log.info('joinCallComplete for:' + operatorId);
        findTransferRequest(ticketId)
                .then(clearTransferReq)
                .then(notifyOperator)
                .then(checkTransferReqStatus)
                .then(updateOpprf.bind({query: {id: operatorId, isblocked: 0}}))
                .catch(function (err) {
                    sails.log.info(err);
                });

    }, moh: function (req) {
        sails.log.info('moh' + JSON.stringify(req.allParams()));
        AsteriskInterfaceService.mohAction(req.allParams(), 'confbridgemute', 'Local/main@caller_moh_deadcontext', 'caller_moh_feedback');
    }, revertMoh: function (req) {
        sails.log.info('moh' + JSON.stringify(req.allParams()));
        AsteriskInterfaceService.mohAction(req.allParams(), 'confbridgeunmute', 'Local/main@caller_remove_moh_deadcontext', 'caller_remove_moh_feedback');
    }, getPendingTransferRequests: function (req) {
        var data = req.allParams();
        Operator.findOne(data.operatorId).populate('tickets').exec(function (err, requests) {
            if (err)
                return;
            sails.log.info('getPendingTransferRequests' + JSON.stringify(data));
            if (requests !== undefined)
                sails.sockets.broadcast(requests.operatorId, 'transferRequest', requests.tickets);
        });
    }
    

};

var waitForTransfereeAction = function(data) {
    return new Promise(function (resolve) {
        setTimeout(function () {
            return resolve(data.ticketId);
        }, 3000);
    });
};

var updateSocketSubscribers = function (roomId) {
    return new Promise(function (resolve, reject) {
        sails.log.info('&&&&&&&&&&&updateSocketSubscribers');
        sails.sockets.subscribers(roomId, function (err, socket_ids) {
            if (err)
                return reject('socketSubscribers not added');
            var counter = socket_ids.length;
            sails.log.info('counter' + counter);
            var availableRooms = JSON.stringify(sails.sockets.rooms());
            sails.log.info('availableRooms' + availableRooms);
            return resolve();
        });
    });
};

var socketJoin = function (req, res, chatgroup) {
    return new Promise(function (resolve, reject) {
        for (i = 0; i < chatgroup.length; i++) {
            socketJoinAction(req, res, chatgroup[i]);
        }
        return resolve(req);
    });
};

var socketJoinAction = function (req, res, room) {
    sails.sockets.join(req, room, function (err) {
        if (err) {
            return reject(res.serverError(err));
        }
        sails.log.info('Socket Join' + room);
    });
};

var setSessionVariables = function (req, res) {
    res = this.res;
    req = this.req;
    return new Promise(function (resolve, reject) {
        sails.log.info('%%%%%%%%%%%%%setSessionVariables');
        req.session.operatorId = req.param('operatorId');
        req.session.chatgroup = req.param('chatgroup');
        var roomNames = JSON.stringify(sails.sockets.socketRooms(req));
        sails.log.info('Socket Rooms' + roomNames);
        sails.log.info('Session obj during login' + JSON.stringify(req.session));
        return resolve(res.send());
    });
};

var createOperatorObj = function (req) {
    return new Promise(function (resolve, reject) {
        var roomId = req.param('operatorId');
        var chatgroup = req.param('chatgroup');
        Operator.create({operatorId: roomId, chatgroups: chatgroup}).exec(function (err, updated) {
            if (err) { //returns if an error has occured, ie id doesn't exist.
                sails.log.info('operator Update Error' + err);
//                for (var i = 0; i < chatgroup.length; i++) {
//                    sails.log.info('Operator Rooms' + chatgroup[i]);
//                    sails.sockets.broadcast(chatgroup[i], 'updateOperatorList');
//                }
                return reject(err);
            } else {
                sails.log.info('operator Updated' + JSON.stringify(updated));
                for (var i = 0; i < chatgroup.length; i++) {
                    sails.log.info('Operator Rooms' + chatgroup[i]);
                    sails.sockets.broadcast(chatgroup[i], 'updateOperatorList', chatgroup[i]);
                }
                return resolve(roomId);
            }
        });
    });
};

var updateOpprf = function (opid, query) {
    if (query === undefined)
        query = this.query;
    sails.log.info('updateOpprf' + JSON.stringify(query));
    return new Promise(function (resolve, reject) {
        Opprf.update(opid, query).exec(function (err, updated) {
            if (err)
                return reject(err);
            sails.log.info('updateOpprf updated' + JSON.stringify(updated));
            return resolve(opid);
        });
    });
};

var updateUsers = function (opid, query) {
    if (query === undefined)
        query = this.query;
    return new Promise(function (resolve, reject) {
        Users.update(opid, query).exec(function (err) {
            if (err)
                return reject(err);
            return resolve(opid);
        });
    });
};

var flushOutOperator = function (operator) {
    var chatgroup = operator.chatgroups;
    return new Promise(function (resolve, reject) {
        Operator.destroy({operatorId: operator.operatorId}).exec(function (err) {
            if (err)
                return reject(err);
            sails.log.info("Operator Purge for " + operator.operatorId);
            for (var i = 0; i < chatgroup.length; i++) {
                sails.log.info('Operator Rooms' + chatgroup[i]);
                sails.sockets.broadcast(chatgroup[i], 'updateOperatorList', chatgroup[i]);
            }
            return resolve(operator);
        });
    });
};

//For initiateTransfer Request
var checkValidCall = function (data) {
    return new Promise(function (resolve, reject) {
        AsteriskInterfaceService.checkValidCall(data.conference, function (result) {
            if (result) {
                sails.log.info('checkValidCall validcall ');
                return resolve(data);
            } else {
                sails.log.info('transferRequest for Invalid/Inactive Call ', data.ticketId);
                sails.sockets.broadcast(data.transferer, 'transferRequestACK', data);
                return reject('not a valid call' + data.ticketId);
            }
        });
    });
};

var createTransferReq = function (data) {
    return new Promise(function (resolve, reject) {
        TransferRequest.create(data).exec(function (err, updated) {
            if (err) { //returns if an error has occured, ie id doesn't exist.
                sails.log.info('TransferRequest Update Error' + err);
                sails.sockets.broadcast(data.transferer, 'transferRequestACK', data);
                return reject('TransferRequest Update Error' + err);
            } else {
                return resolve(updated);
            }
        });
    });
};

var findOperator = function (opid) {
    return new Promise(function (resolve, reject) {
        Operator.findOne(opid).populate('tickets').exec(function (err, requests) {
            if (err) {
                return reject('Invalid Operator');
            }
            if (requests !== undefined) {
                return resolve(requests);
            } else {
                return reject('No Valid Operator');
            }
        });
    });
};

var notifyOperator = function (data) {
    return new Promise(function (resolve, reject) {
        Operator.findOne(data.transferee).populate('tickets').exec(function (err, requests) {
            if (err) {
                sails.sockets.broadcast(data.transferer, 'transferRequestACK', data);
                return reject('Invalid Operator');
            }
            if (requests !== undefined) {
                sails.log.info('Operator after TransferRequest Updated' + JSON.stringify(requests));
                sails.sockets.broadcast(requests.operatorId, 'transferRequest', requests.tickets);
                return resolve(data);
            } else {
                sails.sockets.broadcast(data.transferer, 'transferRequestACK', data);
                return resolve(data);
            }
        });
    });
};


var findTransferRequest = function (ticketId) {
    return new Promise(function (resolve, reject) {
        TransferRequest.findOne(ticketId).exec(function (err, ticketState) {
            if (err)
                return reject('Transfer request DB error');
            if (ticketState === undefined) {
                return reject('Transfer request DB Invalid');
            } else if (ticketState.ack === 0 || ticketState.ack === 400) {
                sails.sockets.broadcast(ticketState.transferer, 'transferRequestACK', ticketState);
                return resolve(ticketState);
            } else {
                return reject('Tickets SeTimeout complete without any action :');
            }
        });
    });
};

var clearTransferReq = function (ticketState) {
    return new Promise(function (resolve, reject) {
        TransferRequest.destroy(ticketState).exec(function (err) {
            if (err)
                return reject(err);
            sails.log.info('TransferRequest cleared for ticket id' + JSON.stringify(ticketState));
            return resolve(ticketState);
        });
    });

};
var transferRequestUpdate = function (data) {
    return new Promise(function (resolve, reject) {
        TransferRequest.update(data.ticketId, data).exec(function (err, updated) {
            if (err)
                return reject(err);
            sails.log.info('TransferRequest ACK updated for ticket id' + JSON.stringify(updated));
            sails.sockets.broadcast(updated[0].transferer, 'transferRequestACK', updated[0]);
            resolve(updated[0]);
        });
    });
};
var checkTransferReqStatus = function (requests) {
    return new Promise(function (resolve, reject) {
        if (requests.tickets.length === 0) {
            resolve(requests.operatorId);
        } else {
            reject(requests.tickets.length);
        }
    });
};