import { DataTypes, QueryTypes } from 'sequelize';
import db from '../config/database.js';

// Creates the outages table and estimates past outages from runs of failed speedtests:
// from the first failed test to the next successful one
export async function up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('outages')) {
        await queryInterface.createTable('outages', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            start: { type: DataTypes.STRING, allowNull: false },
            end: { type: DataTypes.STRING, allowNull: false },
            ongoing: { type: DataTypes.BOOLEAN, defaultValue: false },
            cause: { type: DataTypes.STRING, defaultValue: 'unknown' },
            source: { type: DataTypes.STRING, defaultValue: 'monitor' }
        });
    }

    const tests = await db.query('SELECT created, error FROM speedtests ORDER BY created ASC', { type: QueryTypes.SELECT });
    const outages = [];
    let start = null;
    for (const test of tests) {
        const created = new Date(test.created).toISOString();
        if (test.error !== null) {
            if (start === null) start = created;
        } else if (start !== null) {
            outages.push({ start, end: created, ongoing: false, cause: 'unknown', source: 'speedtest' });
            start = null;
        }
    }

    if (outages.length > 0) await queryInterface.bulkInsert('outages', outages);
}
