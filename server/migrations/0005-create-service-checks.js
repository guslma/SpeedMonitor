import { DataTypes } from 'sequelize';

// Creates the table where the services check (is WhatsApp, YouTube... answering?) keeps its results
export async function up(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('service_checks')) {
        await queryInterface.createTable('service_checks', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            service: { type: DataTypes.STRING, allowNull: false },
            time: { type: DataTypes.STRING, allowNull: false },
            state: { type: DataTypes.STRING, allowNull: false },
            ms: { type: DataTypes.INTEGER, allowNull: true },
            rtt: { type: DataTypes.INTEGER, allowNull: true },
            status: { type: DataTypes.INTEGER, allowNull: true },
            ip: { type: DataTypes.STRING, allowNull: true }
        });
        await queryInterface.addIndex('service_checks', ['service', 'time']);
    }
}
