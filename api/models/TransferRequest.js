/**
 * TransferRequest.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {
    connection: 'redis',
    attributes: {
        ticketId: {
            type: 'integer',
            primaryKey: true,
            required: true
        },
        transferer: {
            type: 'integer'
        },
        conference: {
            type: 'string'
        },
        operatorChannel: {
            type: 'string'
        },
        customerChannel: {
            type: 'string'
        },
        transferNotes: {
            type: 'string'
        },
        // Add a reference to Operator
        transferee: {
            model: 'Operator'
        }

    }
};

