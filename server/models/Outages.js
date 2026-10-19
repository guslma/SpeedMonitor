import Sequelize from 'sequelize';
import db from '../config/database.js';

// A period without internet. "end" is the last moment the connection was seen down while the outage is ongoing.
export default db.define("outages", {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    start: {
        type: Sequelize.STRING,
        allowNull: false
    },
    end: {
        type: Sequelize.STRING,
        allowNull: false
    },
    ongoing: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
    },
    // "internet" when the router answered but the internet did not, "local" when the router did not answer either
    cause: {
        type: Sequelize.STRING,
        defaultValue: "unknown"
    },
    // Where the outage was recorded ("monitor" is the connection check)
    source: {
        type: Sequelize.STRING,
        defaultValue: "monitor"
    }
}, {createdAt: false, updatedAt: false});
