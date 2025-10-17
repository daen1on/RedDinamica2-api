'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'client', 'browser'));
app.set('view engine', 'html');

app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('hex');
  next();
});

const trustedSources = ["'self'"];
if (process.env.NODE_ENV !== 'production') {
  trustedSources.push('http://localhost:4200', 'ws://localhost:*');
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: trustedSources,
        scriptSrc: [
          'https://cdnjs.cloudflare.com',
          'https://kit.fontawesome.com',
          (req, res) => `'nonce-${res.locals.nonce}'`,
        ].concat(trustedSources),
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com',
          'https://fonts.gstatic.com',
          "'unsafe-inline'",
        ].concat(trustedSources),
        fontSrc: [
          'https://*.cloudflare.com',
          'https://*.gstatic.com',
          'https://*.googleapis.com',
          'https://*.fontawesome.com',
          'data:',
        ].concat(trustedSources),
        connectSrc: [
          'https://simon.uis.edu.co',
          'https://ka-f.fontawesome.com',
        ].concat(trustedSources),
        imgSrc: ['data:'].concat(trustedSources),
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

const allowedOrigins = [
  'http://localhost:3800',
  'http://localhost:4200',
  'http://localhost:4200/#/',
  'https://localhost:4200',
  'https://simon.uis.edu.co',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false }));

if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

const apiPrefix = '/reddinamica2/api';
const cityRoutes = require('./routes/city.routes');
const institutionRoutes = require('./routes/institution.routes');
const knowledgeAreaRoutes = require('./routes/knowledgeArea.routes');
const professionRoutes = require('./routes/profession.routes');
const followRoutes = require('./routes/follow.routes');
const publicationRoutes = require('./routes/publication.routes');
const commentRoutes = require('./routes/comment.routes');
const messageRoutes = require('./routes/message.routes');
const resourceRoutes = require('./routes/resource.routes');
const lessonRoutes = require('./routes/lesson.routes');
const userRoutes = require('./routes/user.routes');
const errorReportRoutes = require('./routes/errorReports.routes');
const notificationRoutes = require('./routes/notification.routes');
const academicGroupRoutes = require('./routes/academicGroup.routes');
const academicLessonRoutes = require('./routes/academicLesson.routes');
const adminRoutes = require('./routes/admin.routes');
const cronRoutes = require('./routes/cron.routes');

app.use(apiPrefix, cityRoutes);
app.use(apiPrefix, institutionRoutes);
app.use(apiPrefix, knowledgeAreaRoutes);
app.use(apiPrefix, professionRoutes);
app.use(apiPrefix, followRoutes);
app.use(apiPrefix, publicationRoutes);
app.use(apiPrefix, commentRoutes);
app.use(apiPrefix, messageRoutes);
app.use(apiPrefix, resourceRoutes);
app.use(apiPrefix, lessonRoutes);
app.use(apiPrefix, userRoutes);
app.use(apiPrefix, errorReportRoutes);
app.use(apiPrefix, notificationRoutes);
app.use(`${apiPrefix}/academic-groups`, academicGroupRoutes);
app.use(`${apiPrefix}/academic-lessons`, academicLessonRoutes);
app.use(apiPrefix, adminRoutes);
app.use(`${apiPrefix}/cron`, cronRoutes);

app.use('/reddinamica2', express.static(path.join(__dirname, 'client', 'browser')));

app.get('/reddinamica2/*', (req, res) => {
  res.render('index.html', { nonce: res.locals.nonce });
});

app.get('/', (req, res) => {
  res.redirect('/reddinamica2/');
});

module.exports = app;

