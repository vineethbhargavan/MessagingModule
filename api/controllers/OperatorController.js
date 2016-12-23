/**
 * OperatorController
 *
 * @description :: Server-side logic for managing operators
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {
    handshakeResponse: function (req, res) {
        var roomId = req.param('operatorId');
        var chatgroup = req.param('chatgroup');
        var values = req.allParams();
        sails.log.info('Socket check' + req.isSocket);
        sails.log.info('join request' + values.operatorId);
        sails.log.info('SocketID' + sails.sockets.getId(req));
        if (req.isSocket) {
            sails.sockets.join(req, chatgroup);
            sails.sockets.join(req, roomId, function (err) {
                if (err) {
                    return res.serverError(err);
                }
                req.session.operatorId = roomId;
                req.session.chatgroup = chatgroup;
                res.send();
                var roomNames = JSON.stringify(sails.sockets.socketRooms(req));
                sails.log.info('Socket Rooms' + roomNames);
                sails.log.info('Session obj during login' + JSON.stringify(req.session));
                //create OperatorObj

                Operator.create({operatorId: roomId}).exec(function (err, updated) {
                    if (err) { //returns if an error has occured, ie id doesn't exist.
                        sails.log.info('operator Update Error' + err);
                    } else {
                        sails.log.info('operator Updated' + JSON.stringify(updated));
                        initialiseLoginParams(roomId, function (err, data) {
                            if (err)
                                return;
                            sails.sockets.broadcast(chatgroup, 'updateOperatorList');
                        });
                    }
                });
            });
            sails.sockets.subscribers(roomId, function (err, socket_ids) {
                var counter = socket_ids.length;
                sails.log.info('counter' + counter);
            });
            var availableRooms = JSON.stringify(sails.sockets.rooms());
            sails.log.info('availableRooms' + availableRooms);
        }
    }, initiateTransfer: function (req) {
        var data = req.allParams();
        sails.log.info('transferRequest transferRequest ', data.transferee);
        if (data.transferee !== undefined) {
            //create A transferRequestObject
            //first check if the ticket is valid.
            AsteriskInterfaceService.checkValidCall(data.conference, function (result) {
                if (result) {
                    TransferRequest.create(data).exec(function (err, updated) {
                        if (err) { //returns if an error has occured, ie id doesn't exist.
                            sails.log.info('TransferRequest Update Error' + err);
                            sails.sockets.broadcast(data.transferer, 'transferRequestACK', data);
                        } else {
                            sails.log.info('TransferRequest Updated' + JSON.stringify(updated));
                            Operator.findOne(data.transferee).populate('tickets').exec(function (err, requests) {
                                if (err)
                                    sails.sockets.broadcast(data.transferer, 'transferRequestACK', data);
                                if (requests !== undefined) {
                                    sails.log.info('Operator after TransferRequest Updated' + JSON.stringify(requests));
                                    sails.sockets.broadcast(requests.operatorId, 'transferRequest', requests.tickets);
                                } else {
                                    sails.sockets.broadcast(updated.transferer, 'transferRequestACK', updated);
                                }

                            });
                            //check if the ticket has been accepted by the transferee
                            setTimeout(function () {
                                TransferRequest.findOne(updated.ticketId).exec(function (err, ticketState) {
                                    if (ticketState == undefined) {
                                        return;
                                    }
                                    if (ticketState.ack == 0 || ticketState.ack == 400) {
                                        sails.sockets.broadcast(ticketState.transferer, 'transferRequestACK', ticketState);
                                        TransferRequest.destroy(ticketState).exec(function (err) {
                                            if (err)
                                                return;
                                            sails.log.info('TransferRequest cleared for ticket id' + JSON.stringify(ticketState));
                                            Operator.findOne(ticketState.transferee).populate('tickets').exec(function (err, requests) {
                                                if (err)
                                                    return;
                                                sails.log.info('Tickets request after deleting :' + JSON.stringify(requests));
                                                sails.sockets.broadcast(requests.operatorId, 'transferRequest', requests.tickets);
                                            });
                                        });
                                    } else {
                                        sails.log.info('Tickets SeTimeout complete without any action :');
                                    }
                                });
                            }, 30000);
                        }
                    });
                } else {
                    sails.log.info('transferRequest for Invalid/Inactive Call ', data.ticketId);
                    sails.sockets.broadcast(data.transferer, 'transferRequestACK', data);
                }
            });


            //AsteriskInterfaceService.initiateTransferAction(data);
        }
    }, logout: function (opid, chatgroup, callback) {
        Opprf.update(opid, {id: opid, flag: 0, isbusy: 0}).exec(function (err, qUpdated) {
            if (err) { //returns if an error has occured, ie id doesn't exist.
                sails.log.info('Opprf Update Error' + err);
                return callback(null);
            } else {
                sails.log.info('Opprf Updated' + JSON.stringify(qUpdated));
                Operator.destroy({operatorId: opid}).exec(function (err) {
                    if (err)
                        return callback(null);
                    sails.log.info("Operator Purge for " + opid);
                    Users.update(opid, {id: opid, logged_in: 0, last_active: new Date()}).exec(function (err, qUpdated) {
                        if (err)
                            return callback(null);
                        sails.log.info("Users updated for " + opid);
                        sails.sockets.broadcast(chatgroup, 'updateOperatorList');
                        return callback(null, opid);
                    });
                });
            }
        });
        //work on promise to bundle these requests

    }, transferRequestAck: function (req) {
        var data = req.allParams();
        sails.log.info('TransferRequest ACK received for' + JSON.stringify(data));
        if (data.ack === 200) {
            //setHangupFlagOnOriginator(data.operatorChannel, 'skip_hangup_actions', 11);
            AsteriskInterfaceService.setHangupFlagOnOriginator(data);
            //save the details in DB.
            //set opprf to blocked.
            Opprf.update(data.transferee, {id: data.transferee, isblocked: 1}).exec(function (err, qUpdated) {
                if (err)
                    return;
                sails.log.info('TransferRequest ACK Accepted and op blocked' + JSON.stringify(qUpdated));
                //sails.sockets.broadcast(requests.operatorId, 'transferRequest', requests.tickets);
            });
        }
        TransferRequest.update(data.ticketId, data).exec(function (err, updated) {
            if (err)
                return;
            sails.log.info('TransferRequest ACK updated for ticket id' + JSON.stringify(updated));
            sails.sockets.broadcast(updated[0].transferer, 'transferRequestACK', updated[0]);
            Operator.findOne(updated[0].transferee).populate('tickets').exec(function (err, requests) {
                if (err)
                    return;
                sails.log.info('transferRequestAck updating details to transferer :' + JSON.stringify(requests));
                sails.log.info('transferRequestAck updating details to transferer :' + requests.operatorId);
                sails.sockets.broadcast(requests.operatorId, 'transferRequest', requests.tickets);

            });
        });

    }, joinCall: function (req) {
        var data = req.allParams();
        sails.log.info('joinCall received for' + JSON.stringify(data));
        AsteriskInterfaceService.joinCall(data);

    }, joinCallComplete: function (operatorId, ticketId) {
        sails.log.info('joinCallComplete for:' + operatorId);
        TransferRequest.findOne(ticketId).exec(function (err, ticketState) {
            if (err)
                return;
            TransferRequest.destroy(ticketState).exec(function (err) {
                if (err)
                    return;
                Operator.findOne(operatorId).populate('tickets').exec(function (err, requests) {
                    if (err)
                        sails.sockets.broadcast(data.transferer, 'transferRequestACK', data);
                    sails.log.info('Operator after TransferRequest Updated' + JSON.stringify(requests));
                    sails.sockets.broadcast(requests.operatorId, 'transferRequest', requests.tickets);
                    if (requests.tickets.length === 0) {
                        //unblock the user
                        Opprf.update(requests.operatorId, {id: requests.operatorId, isblocked: 0}).exec(function (err, qUpdated) {
                            if (err)
                                return;
                            sails.log.info('Operator unblocked' + JSON.stringify(qUpdated));
                        });
                    }

                });

            })

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

function initialiseLoginParams(opid, callback) {
    Opprf.update(opid, {id: opid, flag: 1}).exec(function (err, qUpdated) {
        if (err)
            return callback(true);
        Users.update(opid, {id: opid, logged_in: 1, last_login: new Date()}).exec(function (err, qUpdated) {
            if (err)
                return callback(true);
            return callback(false, true);
        });
    });
}