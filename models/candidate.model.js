const { DataTypes } = require('sequelize');

module.exports = () => {
    return global.sequelize.define('Candidate', {
        candidate_id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email_id: {
            type: DataTypes.STRING,
            allowNull: false
        },
        phone_number: {
            type: DataTypes.STRING,
            allowNull: false
        },
        candidates_data: {
            type: DataTypes.JSONB
        },
        created_date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        created_by: {
            type: DataTypes.STRING,
            allowNull: false
        },
        modified_date: {
            type: DataTypes.DATE
        },
        modified_by: {
            type: DataTypes.STRING
        }
    }, { tableName: 'candidate_summary', timestamps: false });
}
