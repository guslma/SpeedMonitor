import { DataTypes } from 'sequelize';

// Creates the table where the connection check records outages
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
}
