// web server and router
var fs = require('fs');
var https = require('https');
var flash = require('connect-flash');
var express = require('express');
var csrf = express.csrf();
var app = express();
var path = require('path');
var controller = require('./controller');
var admin = require('./admin');
var util = require('util');
var _ = require('underscore');

// user authentication
var passport = require('passport');
var LocalLoginStrategy = require('passport-local').Strategy;
var myUtils = require('./myUtils');

var Mandrill = require('mandrill-api/mandrill');
var m = new Mandrill.Mandrill();

app.configure(function() {
  app.set('views', __dirname + '/views');
  app.use(express.static(path.join(__dirname, 'public')));
  app.set('view engine', 'jade');
  app.use(express.cookieParser());
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.session({secret:process.env.SESSION_SECRET}));
  app.use(customCsrf);
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());
  app.use(function (req, res, next) {
    if (req.url !== '/import') {
      res.locals.csrfToken = req.csrfToken();
    }
    res.locals.path = req.path;
    res.locals.user = req.user;
    res.locals.errors = req.flash('error');
    res.locals.warnings = req.flash('warning');
    res.locals.messages = req.flash('message');
    if (req.user && !req.user.emailconfirmed) {
      res.locals.warnings.push({ message:'You haven\'t confirmed your email yet so you cannot buy or sell books with other students.', link:'/account' });
    }
    next();
  });
  app.use(app.router);
});

app.configure('production', function() {
  app.all('*', function(req, res, next) {
    if (req.secure || (process.env.HEROKU && req.headers['x-forwarded-proto'] === 'https')) {
      next();
    } else {
      return res.redirect(['https://', req.get('Host'), req.url].join(''));
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
  res.render('home');
});

// user functions
app.get('/join', controller.join);
app.post('/join', controller.createAccount);
app.get('/confirm/:confirmationId', controller.confirmEmail);
app.get('/passwordreset', controller.showPasswordReset);
app.get('/passwordreset/:resetToken', controller.showPasswordReset);
app.post('/passwordreset', controller.passwordReset);
app.get('/login', controller.login);
app.get('/login/*', controller.login);
app.post('/login', function(req, res) {
  var destination = req.body.destination || '/';
  passport.authenticate('local', {
    successRedirect:destination, failureRedirect:util.format('/login%s', destination), failureFlash:true
  })(req, res);
});
app.get('/logout', function(req, res) { req.logout(); res.redirect('/'); });
app.get('/mybooks', loggedIn, controller.myBooks);
app.post('/mybooks', loggedIn, controller.addBooks);
app.get('/findbooks', loggedIn, controller.findBooks);
app.post('/findbooks', loggedIn, controller.foundBook);
app.get('/account', loggedIn, controller.getAccount);
app.post('/account', loggedIn, controller.getAccount);
app.get('/import', controller.import);
app.post('/import', controller.import);

// admin functions (must have ADMINS environment variable set)
app.get('/admin', loggedIn, ensureAdmin, admin.dashboard);
app.post('/admin', loggedIn, ensureAdmin, admin.dashboard);

// setup passport
passport.use(new LocalLoginStrategy({usernameField:'email'},
  function(email, password, done) {
    controller.authenticateUser(email, password, function(err, user) {
      if (err) {
        done(null, false, {message:err.error||'Your email or password are incorrect!'});
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
    client.query('select email,name,schoolId,emailConfirmed from students where email = $1', [email], function(err, result) {
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
    if (res.locals.errors.length) {
      req.flash('error', res.locals.errors);
    }
    if (res.locals.warnings.length) {
      req.flash('warning', res.locals.warnings);
    }
    if (res.locals.messages.length) {
      req.flash('message', res.locals.messages);
    }
    res.redirect(util.format('/login%s', req.path));
  }
}

// middleware to ensure logged in user is an admin
function ensureAdmin(req, res, next) {
  if (req.user && process.env.ADMINS) {
    var email = req.user.email;
    var adminEmails = JSON.parse(process.env.ADMINS);
    for (var i = 0; i < adminEmails.length; i++) {
      if (email === adminEmails[i]) {
        return next();
      }
    }
  }
  res.redirect('/');
}

function customCsrf(req, res, next) {
  if (req.url === '/import') {
    next();
  } else {
    csrf(req, res, next);
  }
}
