/**
 * Chat.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {

    connection: 'redis',
    attributes: {
        chatId: {
            type: 'string',
            primaryKey: true,
            required: true
        },
        opName: {
            type: 'string'
        },
        to: {
            type: 'string'
        },
        date: {
            type: 'dateTime'
        },
        message: {
            type: 'string'
        },
        from: {
            model: 'Operator'
        },timestamp:{
            type: 'integer'
        }

    }
};

