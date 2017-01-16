/**
 * Operator.js
 *
 * @description :: TODO: You might write a short summary of how this model works and what it represents here.
 * @docs        :: http://sailsjs.org/documentation/concepts/models-and-orm/models
 */

module.exports = {
    connection: 'redis',
    attributes: {
        operatorId: {
            type: 'integer',
            primaryKey: true,
            required:true
            
        },
        // Add a reference to Pets
        tickets: {
            collection: 'TransferRequest',
            via: 'transferee'
        },
        chatgroups:{
            type:'array'
        }
    }
};

