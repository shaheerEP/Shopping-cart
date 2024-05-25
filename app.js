var dotev = require('dotenv').config();
// ...other imports...
const { normalizePort, onError, onListening } = require('./bin/www');
const http = require('http'); // Import the http module

// ...rest of your app.js code...

var createError = require('http-errors'); 
var express = require('express');
var path = require('path'); 
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var hbs = require('express-handlebars');
var usersRouter = require('./routes/users');
var adminRouter = require('./routes/admin'); 
var app = express();
var fileUpload=require('express-fileupload') 
const connection = require('./config/connection');
var session = require('express-session')
const helpers = require('./config/handlebars-helpers');
const Razorpay = require('razorpay'); 
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const connectionString = process.env.DATABASE_URL;
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs'); // Set the view engine to 'handlebars'
app.engine('hbs', hbs({
  extname:'hbs',
  defaultLayout: 'layout',
  layoutsDir: __dirname + '/views/layouts/',
  partialsDir: __dirname + '/views/partials/',
  runtimeOptions: {
    allowProtoPropertiesByDefault: true,
    helpers: helpers
  }
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileUpload());

mongoose.connect(connectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

app.use(session({
  secret: process.env.SESSION_SECRET, 
  resave: false,
  saveUninitialized: true, 
  store: MongoStore.create({
      mongoUrl: connectionString, 
     
  }), 
  cookie: {
      maxAge: 60000000 // 1 hour in milliseconds 
  } 
}));

// ... (Rest of your route logic) ...
app.use('/', usersRouter);
app.use('/admin', adminRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in developmentres.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// Start the server
//  Prepare functions for configuration
const configureServer = (app) => {
  const port = normalizePort(process.env.PORT ||  '3000');
  app.set('port', port);
  const server = http.createServer(app); // Use the imported http module
  server.listen(port, onListening);
  server.on('error', onError);
}
// Call configuration function by passing the app
configureServer(app); 

module.exports = app; 
