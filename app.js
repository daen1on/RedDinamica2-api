'use strict'

// app.js has all the set up for express
let express = require('express');
//let bodyParser = require('body-parser'); deprecated?
let path = require('path');
let app = express();


// x-frame option
const helmet = require("helmet");
//cors
var cors = require('cors')
var corsOptions = {
    //credentials: true,
    origin:'http://localhost:4200',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }
// Load routes
let institutionRoutes = require('./routes/institution.routes');
let cityRoutes = require('./routes/city.routes');
let knowledgeAreaRoutes = require('./routes/knowledgeArea.routes');
let professionRoutes = require('./routes/profession.routes');
let followRoutes = require('./routes/follow.routes');
let publicationRoutes = require('./routes/publication.routes');
let commentRoutes = require('./routes/comment.routes');
let messageRoutes = require('./routes/message.routes');
let resourceRoutes = require('./routes/resource.routes');
let lessonRoutes = require('./routes/lesson.routes');
let userRoutes = require('./routes/user.routes');

// Middlewares
app.use(express.urlencoded({ extended: false })); //Parse URL-encoded bodies
app.use(express.json({limit:"20000kb"})); 

// Cors
app.use(cors(corsOptions));

//x-fOpt
app.use(helmet());

// Static route
app.use('/', express.static('client', {redirect:false}));

// Routes
app.use('/api', cityRoutes);
app.use('/api', institutionRoutes);
app.use('/api', knowledgeAreaRoutes);
app.use('/api', professionRoutes);
app.use('/api', followRoutes);
app.use('/api', publicationRoutes);
app.use('/api', commentRoutes);
app.use('/api', messageRoutes);
app.use('/api', resourceRoutes);
app.use('/api', lessonRoutes);
app.use('/api', userRoutes);

// Rewrite url
app.use('*', function(req, res, next){
    res.sendFile(path.resolve('client/index.html'));
});

// Export
module.exports = app;