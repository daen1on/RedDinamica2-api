'use strict'

// app.js has all the set up for express
let express = require('express');
let bodyParser = require('body-parser');

let app = express();

// Load routes
let userRoutes = require('./routes/user.routes');
let institutionRoutes = require('./routes/institution.routes');
let cityRoutes = require('./routes/city.routes');

// Middlewares
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());

// Cors
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
     
    next();
});

// Routes
app.use('/api', cityRoutes);
app.use('/api', institutionRoutes);
app.use('/api', userRoutes);

// Export
module.exports = app;