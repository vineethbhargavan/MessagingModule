var ami_host = 'localhost';
var manager = 'operatorComm'
var password = 'abc123';
var ami = new require('asterisk-manager')('5038', ami_host, manager, password, true);

var pg = require('pg');
var pgConString = "postgres://192.168.0.56/1300_staging"
var pg_client = new pg.Client(pgConString);
pg_client.connect();


if (ami != undefined) {
    try {
        ami.keepConnected();
        ami.on('userevent', function (evt) {
            //sails.log.info("userevent" + JSON.stringify(evt))
            if (evt.userevent == "TriggerCallPopup") {
                sails.log.info("userevent" + JSON.stringify(evt));
                sails.sockets.broadcast(evt.operator, 'triggerIncomingCall', evt);
                //emitSocketActionToOperator(evt.operator, evt, 'triggerIncomingCall');
            }
            if (evt.mode == "3") {
                //check of there are any more tickets to serve...if not unblock the user.
                //update the state of the ticket.
                sails.log.info("TriggerCallPopup ..processing for a joined call" + JSON.stringify(evt));
                sails.controllers.operator.joinCallComplete(evt.operator, evt.ticketid);

            }
        });
    } catch (err) {
        sails.log.info('exception occured:During AMI action', err.message);
    }
} else {
    sails.log.info('AMI object is not Present Trying to login agan');
    ami = new require('asterisk-manager')('5038', ami_host, manager, password, true);
}


function setHangupFlagOnOriginator(operatorChannel, variable, value) {
    sails.log.info('setHangUpFlag setHangUpFlag ', operatorChannel);
    ami.action({
        'action': 'setvar',
        'channel': operatorChannel,
        'variable': 'skip_hangup_actions',
        'value': value
    }, function (err, res) {
        sails.log.info("Response From setChannelVariable" + JSON.stringify(res));
    });
}
function getEndpoint(opid, callback) {
    var querytext = "select sip_prefered,phnum,iswebrtc from opprf where flag=1 and isbusy=0 and id ='" + opid + "'";
    pg_client.query(querytext, function (err, queryResult) {
        //sails.log.info(queryResult.rows);
        if (err)
            return callback(true);
        if (queryResult === undefined)
            return callback(true);
        if (queryResult.rows === undefined) {
            return callback(true);
        }
        if (queryResult.rows[0] !== undefined) {
            sails.log.info("SIP prefered status getEndpoint" + queryResult.rows[0].sip_prefered);
            var endpoint = "";
            if (queryResult.rows[0].iswebrtc === 1) {
                endpoint = "SIP/1900888333" + opid + "@59.100.237.234";
                return callback(false, endpoint);
            } else if (queryResult.rows[0].sip_prefered) {
                endpoint = "SIP/20" + opid + "@59.100.237.234";
                return callback(false, endpoint);
            } else {
                endpoint = "DAHDI/GO/" + queryResult.rows[0].phnum;
                return callback(false, endpoint);
            }
        } else {
            return callback(true);
        }
    });
}

function constructTransferCall(opid, conference, operatorChannel, customerChannel, ticket_id, transferEndpoint, orig_op) {
    //var confprefix = opid + "_" + custkey;
    // below action is to check if it is a valid conference.
    //Trigger Incoming call
    ami.action({
        'action': 'confbridgelist',
        'conference': conference
    }, function (err, res) {
        sails.log.info("Response From conconfbridgelist" + JSON.stringify(res));
        if (res.response != "Error") {
            muteConfLeg(customerChannel, conference, 'confbridgeunmute', function (status) {
                if (status) {
                    originateCallOnChannel(conference, customerChannel, operatorChannel, ticket_id, transferEndpoint, 'transferee_answers', opid, orig_op);
                    //muteChannel(customerChannel, 'off');
                }
            });
        } else {
            //Need to handled it.
            var data = {};
            data.ticketId = ticket_id;
            data.status = 500;
            data.operator_id = opid;
            //emitSocketActionToOperator(opid, data, 'transferJoinStatus');
            sails.sockets.broadcast(opid, 'transferJoinStatus', data);
        }
    });

}
function muteChannel(channel, state) {
    ami.action({
        'action': 'muteaudio',
        'direction': 'all',
        'state': state,
        'channel': channel
    }, function (err, res) {
        sails.log.info("Response From muteChannel" + JSON.stringify(res));
    });
}

function muteConfLeg(channel, conference, action, callback) {
    ami.action({
        'action': action,
        'conference': conference,
        'channel': channel
    }, function (err, res) {
        sails.log.info("Response From muteConfLeg" + JSON.stringify(res));
        if (res.response == "Success") {
            callback(true);
        } else {
            callback(false);
        }
    });
}

function originateCallOnChannel(conference, channel, peerChannel, ticket, endpoint, context, operator, orig_op) {
    var op_custkey = conference.split("_");
    ami.action({
        'action': 'originate',
        'channel': endpoint,
        'context': context,
        'exten': 'mainentry',
        'priority': 1,
        'async': 'true',
        'variable': {
            'conference': conference,
            'wisperChannel': channel,
            'peerChannel': peerChannel,
            'TICKET': ticket,
            'OPERATOR': operator,
            'ORIG_OPERATOR': orig_op,
            'ORIG_CUSTKEY': op_custkey[1]
        }
    }, function (err, res) {
        sails.log.info("Response From Originate originateWishperOnChannel" + JSON.stringify(res));
    });
}



process.on('uncaughtException', function (err) {
    sails.log.info(' process.on unhandled exception caught : ', err.message);
    //var ami = new require('asterisk-manager')('5038', ami_host, 'dashboard', 'abc123', true);
    //ami.keepConnected();

});

module.exports = {
    mohAction: function (data, action, context1, context2) {
        muteConfLeg(data.operatorChannel, data.conference, action, function (status) {
            if (status) {
                originateCallOnChannel(data.conference, data.customerChannel, data.operatorChannel, data.ticketId, context1, context2, data.transferee, data.transferer);
                muteConfLeg(data.customerChannel, data.conference, action, function (status) {
                    if (status) {
                        sails.sockets.broadcast(data.transferer, 'mohAck', data)
                    }
                });
            }
        });
    }, joinCall: function (data) {
        getEndpoint(data.transferee, function (err, transferEndpoint) {
            sails.log.info('getEndpoint' + JSON.stringify(transferEndpoint));
            if (err) {
                return;
            }
            if (transferEndpoint !== 0) {
                constructTransferCall(data.transferee, data.conference, data.operatorChannel, data.customerChannel, data.ticketId, transferEndpoint, data.transferer);
            } else {
                return;
            }
        });
    }, setHangupFlagOnOriginator: function (data) {
        setHangupFlagOnOriginator(data.operatorChannel, 'skip_hangup_actions', 11);
    }, checkValidCall: function (conference, callback) {
        if(conference === undefined || conference == ""){
            return callback(false);
        }
        ami.action({
            'action': 'confbridgelist',
            'conference': conference
        }, function (err, res) {
            sails.log.info("Response From conconfbridgelist" + JSON.stringify(res));
            if (res.response != "Error") {
                return callback(true);
            } else {
                return callback(false);
            }
        });
    }
};



