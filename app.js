'use strict'

// app.js has all the set up for express
const helmet = require('helmet');
const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const nonce = crypto.randomBytes(32).toString("hex");
const trusted = ["'self'"];
// Middleware to set 'x-content-type-options' header
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
// Serve JavaScript files with the correct MIME type
app.get('/*.js', (req, res, next) => {
  res.type('application/javascript');
  next();
});

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'client'))); // Serve static files first

app.get('/', (req, res) => {
  res.render('index.html', { nonce }); // Pass nonce to the template
});

if (process.env.NODE_ENV !== 'production') {
  trusted.push('http://localhost:*', 'ws://localhost:*');
}

app.get('/*.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  // Rest of the code to send the CSS file
});

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: trusted,
      scriptSrc: [
        "'strict-dynamic'",
        'https://cdnjs.cloudflare.com',
        'https://kit.fontawesome.com',
        'https://fonts.googleapis.com',
        `'nonce-${nonce}'`,
      ].concat(trusted),
      styleSrc: [
        'https://fonts.googleapis.com',
        'https://cdnjs.cloudflare.com',
        'https://fonts.gstatic.com',
        `'nonce-${nonce}'`,

      ].concat(trusted),
      fontSrc: [
        'https://*.cloudflare.com',
        'https://*.gstatic.com',
        'https://*.googleapis.com',
        'https://*.fontawesome.com',
        'data:', // Allowing data URIs for fonts
      ].concat(trusted),
      scriptSrcAttr: [].concat(trusted),
      connectSrc: [
        'https://simon.uis.edu.co',
        'https://fonts.gstatic.com', // Allowing preconnect for fonts.gstatic.com
      ].concat(trusted),
      imgSrc: ['data:'].concat(trusted),
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
    },
  })
);

//cors
var cors = require('cors');
var corsOptions = {
  origin: ['https://simon.uis.edu.co', 'https://simon.uis.edu.co/reddinamica', 'http://localhost:4200', 'https://localhost:4200'],
  methods: 'GET,POST,PUT,DELETE,PATCH', // Allow all specified methods
  optionsSuccessStatus: 204, // 200; some legacy browsers (IE11, various SmartTVs) choke on 204
  allowedHeaders: ['font-display', 'font-family', 'font-style', 'font-weight', 'src', 'Content-Type', 'authorization','Accept','X-requested-with','Origin'], // Add 'authorization' here
  exposedHeaders: ['Content-Type', 'Content-Length', 'Date', 'ETag', 'Accept-Ranges']
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
// ...




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