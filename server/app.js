// web server and router
var fs = require('fs');
var https = require('https');
var express = require('express');
var app = express();
var path = require('path');
var controller = require('./controller');

// user authentication
var passport = require('passport');
var LocalLoginStrategy = require('passport-local').Strategy;
var myUtils = require('./myUtils');

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.use(express.static(path.join(__dirname, 'public')));
  app.set('view engine', 'jade');
  app.use(express.cookieParser());
  app.use(express.bodyParser());
  app.use(express.session({secret:process.env.SESSION_SECRET}));
  app.use(express.csrf());
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(function (req, res, next) {
    res.locals.csrfToken = req.csrfToken();
    res.locals.user = req.user;
    next();
  });
  app.use(app.router);
});

app.configure('production', function() {
  app.all('*', function(req, res, next) {
    if (req.secure || (process.env.HEROKU && req.headers['x-forwarded-proto'] === 'https')) {
      next();
    } else {
      res.json(505, {error: 'please use https with all your requests'});
    }
  });
});

app.configure('development', function() {
  app.use(express.logger('dev'));
})

if (process.env.HEROKU || process.env.NODE_ENV === 'development') {
  app.listen(process.env.PORT || 3000);
} else {
  var credentials = {
    key: fs.readFileSync(process.env.TLS_KEY_PATH, 'utf8'),
    cert: fs.readFileSync(process.env.TLS_CERT_PATH, 'utf8'),
  };
  https.createServer(credentials, app).listen(process.env.SECURE_PORT || 3001);
}

app.get('/', function(req, res) {
  console.log('csrf',req.csrfToken());
  var user = req.user;
  if (user) {
    user.csrf = req.csrfToken();
  }
  res.json(user || { 'message': 'Hello random person'});
});

app.get('/account/:email/:password', controller.getAccount);
app.get('/join', controller.join);
app.post('/join', controller.createAccount);
app.get('/login', controller.login);
app.post('/login', passport.authenticate('local', {successRedirect:'/', failureRedirect:'/login' }));
app.get('/my/books', loggedIn, controller.myBooks);
app.post('/my/books', loggedIn, controller.addBooks);
app.get('/find/books', loggedIn, controller.findBooks);

// setup passport
passport.use(new LocalLoginStrategy({usernameField:'email'},
  function(email, password, done) {
    controller.authenticateUser(email, password, function(err, user) {
      if (err) {
        done(null, false, {message:'Your email or password are incorrect!'});
      } else {
        done(null, user);
      }
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.email);
});

passport.deserializeUser(function(email, done) {
  myUtils.getDbClient(function(err) {
    return done(err);
  }, function(client, clientDone) {
    client.query('select email,name,schoolId from students where email = $1', [email], function(err, result) {
      clientDone();
      var user;
      if (result.rowCount) {
        user = result.rows[0];
      }
      done(err, user);
    });
  });
});

// middleware to ensure user is logged in
function loggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.redirect('/login');
  }
}
