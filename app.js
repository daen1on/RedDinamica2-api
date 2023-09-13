'use strict'

// app.js has all the set up for express
let express = require('express');
let path = require('path');
const crypto = require('crypto');

// Generate a random nonce (16 bytes) as a hexadecimal string
const nonce = crypto.randomBytes(16).toString('hex');

let app = express();

// Set a Content Security Policy header
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', `default-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-${nonce}';`);
    next();
});
//cors
var cors = require('cors');

var corsOptions = {
    origin: ['https://simon.uis.edu.co', 'https://simon.uis.edu.co/'],
    methods: 'GET,POST,PUT,DELETE,PATCH', // Allow all specified methods
    optionsSuccessStatus: 204 // 200; some legacy browsers (IE11, various SmartTVs) choke on 204
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
// x-frame option
const helmet = require('helmet');
// ...
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://example.com', 'https://use.fontawesome.com'],
    styleSrc: ["'self'", 'https://fonts.googleapis.com'],
    // Agrega otras fuentes, imágenes y recursos aquí
  }
}));

app.use(helmet.hsts({
  maxAge: 31536000, // 1 año en segundos
  includeSubDomains: true,
  preload: true,
}));


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