const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const methodOverride = require('method-override');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const expressLayouts = require('express-ejs-layouts');
const moment = require('moment');

const env = require('./config/env');
const { generalLimiter } = require('./middleware/rateLimiter.middleware');
const { notFoundHandler, errorHandler } = require('./middleware/error.middleware');

const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const posRoutes = require('./routes/pos.routes');
const billingRoutes = require('./routes/billing.routes');
const apiRoutes = require('./routes/api.routes');

const app = express();

// ---------- View Engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'partials/layout');

// ---------- Security Middleware ----------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com',  'https://cdn.jsdelivr.net', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(compression());
app.use(morgan(env.isProduction ? 'combined' : 'dev'));

// ---------- Body Parsing ----------
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());
app.use(methodOverride('_method'));

// ---------- Data Sanitization ----------
app.use(mongoSanitize());
app.use(xss());

// ---------- Session (used for flash-style validation errors, CSRF) ----------
app.use(
  session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: env.mongoUri, collectionName: 'sessions' }),
    cookie: {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      maxAge: env.cookieMaxAge
    }
  })
);

// ---------- Rate Limiting ----------
app.use(generalLimiter);

// ---------- Static Files ----------
app.use(express.static(path.join(__dirname, 'public'), { maxAge: env.isProduction ? '1d' : 0 }));

// ---------- Locals available to all views ----------
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.activePath = req.path;
  res.locals.moment = moment;
  next();
});

// ---------- Routes ----------
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/pos', posRoutes);
app.use('/billing', billingRoutes);
app.use('/api', apiRoutes);

app.get('/', (req, res) => res.redirect('/auth/login'));

// ---------- Error Handling ----------
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
