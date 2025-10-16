'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const cors = require('cors');

// =================================================================
// App Initialization
// =================================================================
const app = express();

// =================================================================
// View Engine Configuration
// =================================================================
// Configure EJS to render .html files and set the views directory.
app.engine('html', require('ejs').renderFile);
app.set('views', path.join(__dirname, 'client', 'browser'));
app.set('view engine', 'html');

// =================================================================
// Security Middleware
// =================================================================

// --- 1. Per-Request Nonce Generation ---
// A unique nonce must be generated for each request to make the CSP effective.
app.use((req, res, next) => {
  res.locals.nonce = crypto.randomBytes(16).toString('hex');
  next();
});

// --- 2. Helmet for Security Headers ---
// Sets various security headers to help protect the app from common vulnerabilities.
// The CSP is configured to use the per-request nonce.
const trustedSources = ["'self'"];
if (process.env.NODE_ENV !== 'production') {
  // Allow connections for local development and live reload.
  trustedSources.push('http://localhost:4200', 'ws://localhost:*');
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: trustedSources,
        scriptSrc: [
          // "'strict-dynamic'", // REMOVED: This conflicts with loading scripts like Font Awesome directly.
          'https://cdnjs.cloudflare.com',
          'https://kit.fontawesome.com',
          // Use a function to dynamically apply the nonce for each request.
          (req, res) => `'nonce-${res.locals.nonce}'`,
        ].concat(trustedSources),
        scriptSrcAttr: ["'unsafe-inline'"], // ADDED: Allow inline event handlers like onerror/onload.
        styleSrc: [
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com',
          'https://fonts.gstatic.com',
          "'unsafe-inline'", // Note: Review if this is truly needed.
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
          'https://ka-f.fontawesome.com', // ADDED: Allow Font Awesome to fetch its assets.
        ].concat(trustedSources),
        imgSrc: ['data:'].concat(trustedSources),
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  })
);


// --- 3. CORS Configuration ---
// Configure Cross-Origin Resource Sharing.
const allowedOrigins = [
  'http://localhost:3800',
  'http://localhost:4200',
  'https://localhost:4200',
  'https://simon.uis.edu.co',
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server requests (no origin) and origins from the allowed list.
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
  optionsSuccessStatus: 204, // For legacy browser compatibility.
};
app.use(cors(corsOptions));


// =================================================================
// Body Parsers & Logging
// =================================================================
// Parse JSON and URL-encoded request bodies.
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false }));

// Simple request logger for development.
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// =================================================================
// API Routes
// =================================================================
// Group all API routes under the '/api' prefix.
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
app.use('/api', errorReportRoutes);
app.use('/api', notificationRoutes);
app.use('/api/academic-groups', academicGroupRoutes);
app.use('/api/academic-lessons', academicLessonRoutes);
app.use('/api', adminRoutes);
app.use('/api/cron', cronRoutes);


// =================================================================
// Static File Server & SPA Fallback
// =================================================================
// --- 1. Serve static files specifically for the /reddinamica2 base path ---
// This is crucial for Angular apps with a `base href`. It tells Express to
// look in the 'client/browser' directory for any request starting with '/reddinamica2'.
app.use('/reddinamica2', express.static(path.join(__dirname, 'client', 'browser')));

// --- 2. Serve static files from the root as well ---
// This handles any other static assets that might be at the root, like favicon.ico.
app.use(express.static(path.join(__dirname, 'client', 'browser')));


// --- 3. SPA Fallback ---
// For all other GET requests that are not static files, send the index.html file.
// This is essential for a Single Page Application (SPA) where client-side
// routing is handled by Angular. It ensures that refreshing a page or
// navigating directly to a deep link (e.g., /users/profile) still loads the app.
app.get('*', (req, res) => {
  // Pass the unique, per-request nonce to the template.
  res.render('index.html', { nonce: res.locals.nonce });
});


// =================================================================
// Export App
// =================================================================
module.exports = app;


