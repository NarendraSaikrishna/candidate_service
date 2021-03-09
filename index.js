const express = require('express');
const app = express();
const candidateRoutes = require('./routes/candidate');


const { Sequelize } = require('sequelize');

//Connect PostgresSQL.
global.sequelize = new Sequelize(`postgres://${process.env.DBUser}:${process.env.DBPass}@localhost:5432/talent_acquisition`);

app.use('/upload-candidates', candidateRoutes);

global.sequelize.authenticate().then(() => {
    console.log('Connection has been established successfully.');
    app.listen(9090, async () => console.log('app listening to port 9090'));
}).catch((err) => {
    console.error('Unable to connect to the database:', err);
})
