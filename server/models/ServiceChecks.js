import Sequelize from 'sequelize';
import db from '../config/database.js';

// One check of one service. "state" is up, slow, down or offline (the internet itself was down, so the
// service is not blamed); "ms" is the time until the page answered and "rtt" the time to connect to it
export default db.define("service_checks", {
    id: {type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    service: {type: Sequelize.STRING, allowNull: false},
    time: {type: Sequelize.STRING, allowNull: false},
    state: {type: Sequelize.STRING, allowNull: false},
    ms: {type: Sequelize.INTEGER, allowNull: true},
    rtt: {type: Sequelize.INTEGER, allowNull: true},
    status: {type: Sequelize.INTEGER, allowNull: true},
    ip: {type: Sequelize.STRING, allowNull: true}
}, {tableName: "service_checks", createdAt: false, updatedAt: false});
