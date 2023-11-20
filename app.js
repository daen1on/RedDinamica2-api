'use strict'

// app.js has all the set up for express
let express = require('express');
let path = require('path');

// Generate a random nonce (16 bytes) as a hexadecimal string
const crypto = require("crypto");
const helmet = require('helmet');
let app = express();

// Generate a random nonce value
const generateNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

// Pass the generated nonce value to your front-end application
const nonce = generateNonce();



app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-eval'",
        "'strict-dynamic'",
        `'nonce-${nonce}'`,
        'https://cdnjs.cloudflare.com',
        'http://localhost:3800', // Allow scripts from your local host
        'http://localhost:4200',
      ],
      scriptSrcElem: ["'self'", 'http://localhost:3800','http://localhost:4200'], // Allow script elements from your local host
      scriptSrcAttr: ["'self'", "'unsafe-inline'", `'nonce-${nonce}'`], // Allowing unsafe-inline for inline event handlers
      styleSrc: ["'self'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: [
        "'self'",
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
        'https://kit.fontawesome.com/5c86bdc790.js'],
    },
  })
);

//cors
var cors = require('cors');
var corsOptions = {
  origin: ['https://simon.uis.edu.co', 'https://simon.uis.edu.co/reddinamica', 'http://localhost:4200', 'https://localhost:4200'],
  methods: 'GET,POST,PUT,DELETE,PATCH', // Allow all specified methods
  optionsSuccessStatus: 204, // 200; some legacy browsers (IE11, various SmartTVs) choke on 204
  allowedHeaders: ['font-display', 'font-family', 'font-style', 'font-weight', 'src', 'Content-Type', 'authorization'], // Add 'authorization' here
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