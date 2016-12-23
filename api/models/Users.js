module.exports = {
    connection: 'Mysql_1300',
    hookTimeout: 50000,
    attributes: {
        id: {
            type: 'integer',
            primaryKey: true,
            size: 10,
            required: true,
            unique: true,
            //model:'opprf'
        },
        logged_in: {
            type: 'integer',
            size: 2,
            required: true
        }, last_active: {
            type: 'datetime',
            size: 50
        }, last_login: {
            type: 'datetime',
            size: 50
        }


    }
};