var validator = require('validator');
var myUtils = require('./myUtils');
var util = require('util');
var crypto = require('crypto');
var accountHelper = require('./accountHelper');
var emailHelper = require('./emailHelper');
require('buffertools').extend();

function join(req, res) {
  res.render('join');
}

function createAccount(req, res) {
  var email = req.body.email;
  var password = req.body.password;
  var name = req.body.name;
  var schoolId = req.body.schoolId;
  if (email.indexOf(".edu", email.length - 4) == -1) {
    return res.render('join', {error: 'You must use a .edu email'});
  }
  var schoolId = email.substring(email.indexOf('@')+1);
  if (!password || password.length < 8) {
    return res.render('join', {error: 'You must use a password with at least 8 charaters'});
  }
  if (!name || !schoolId) {
    return res.render('join', {error: 'You must choose a name and pick your school'});
  }
  hashNewPassword(password, function(err, result) {
    if (err) {
      console.error('error hashing new password', err);
      return res.render('join', {error: 'Our site is having an issue, please try again'});
    }
    var passwordStuff = result;// JSON.stringify(result);
    myUtils.getDbClient(function(err) {
      return res.render('join', {error: 'Our site is having an issue, please try again'});
    }, function(client, done) {
      var confirmationId = myUtils.newUUID();
      var insertQuery = 'insert into students (email, password, name, schoolId, emailConfirmationId) values ($1, $2, $3, $4, $5)';
      client.query(insertQuery, [email, passwordStuff, name, schoolId, confirmationId], function(err, result) {
        done();
        if (err) {
          if (err.code === '23505') {
            console.log('user exists');
            res.render('join', {error: 'Sorry, an account with this email already exists.'});
          } else {
            console.error('problem inserting new user', err);
            res.render('join', {error: 'Our site is having an issue, please try again.'});
          }
        } else {
          console.log('added new user', result);
          emailHelper.sendNewEmailConfirmation({name: name, email: email, confirmationId: confirmationId});
          res.render('joinSuccess', {name: name, email: email});
        }
      });
    });
  });
}

function authenticateUser(email, password, callback) {
  myUtils.getDbClient(function(err) {
    console.error(err);
    callback(err);
  }, function(client, done) {
    client.query('select * from students where email = $1', [email], function(err, result) {
      console.log(result);
      done();
      if (err) {
        console.error(err);
        callback(err);
      } else {
        if (result.rowCount) {
          var user = result.rows[0];
          var passwordStuff = JSON.parse(user.password);
          passwordStuff.salt = new Buffer(passwordStuff.salt);
          passwordStuff.key = new Buffer(passwordStuff.key);
          hashPasswordWithIterationsAndKeylen(password,
            passwordStuff.salt,
            passwordStuff.iterations,
            passwordStuff.keylen,
            function(err, computedStuff) {
              if (err) {
                callback(err);
              } else {
                if (passwordStuff.key.equals(computedStuff.key)) {
                  delete user.password;
                  callback(null, user);
                } else {
                  callback('Your email or password are incorrect');
                }
              }
            }
          );
        } else {
          callback('Your email or password are incorrect');
        }
      }
    });
  });
}

function hashNewPassword(password, callback) {
  var keylen = process.env.HASH_KEYLEN || 16;
  saltShaker(keylen, function(err, salt) {
    if (err) {
      callback(err);
    } else {
      hashPassword(password, salt, callback);
    }
  });
}

function saltShaker(keylen, callback) {
  crypto.randomBytes(keylen, callback);
}

function hashPassword(password, salt, callback) {
  var iterations = process.env.HASH_ITERATION || 200000;
  var keylen = process.env.HASH_KEYLEN || 16;
  hashPasswordWithIterationsAndKeylen(password, salt, iterations, keylen, callback);
}

function hashPasswordWithIterationsAndKeylen(password, salt, iterations, keylen, callback) {
  crypto.pbkdf2(password, salt, iterations, keylen, function(err, key) {
    callback(err, {salt:salt, iterations:iterations, keylen:keylen, key:key});
  });
}

function confirmEmail(req, res) {
  var confirmationId = req.params.confirmationId;
  console.log(confirmationId);
  accountHelper.confirmEmail(confirmationId, function(err, result) {
    console.log(err);
    if (err) {
      res.json(err);
    } else {
      res.json(result);
    }
  });
}

function getAccount(req, res) {
  var email = req.user.email;
  res.json(req.user);
}

function login(req, res) {
  res.locals.destination = req.params.destination;
  res.render('login');
}

function myBooks(req, res) {
  var email = req.user.email;
  myUtils.getDbClient(function(err) {
    res.render('myBooks', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.'});
  }, function(client, done) {
    client.query('select * from bookList where email = $1', [email], function(err, result) {
      done();
      if (err) {
        res.render('myBooks', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.', books: new Array()});
      } else {
        res.render('myBooks', {books:result.rows});
      }
    });
  });
}

function addBooks(req, res) {
  var action = req.body.action;
  var isbn = req.body.isbn;
  if (action === 'addBook') {
    var ownership = req.body.newBookOwnership;
    if (!validator.isISBN(isbn, 13)) {
      if (validator.isISBN(isbn, 10)) {
        var sum = 38 + 3 * (parseInt(isbn[0]) + parseInt(isbn[2]) + parseInt(isbn[4]) + parseInt(isbn[6]) + parseInt(isbn[8])) + parseInt(isbn[1]) + parseInt(isbn[3]) + parseInt(isbn[5]) + parseInt(isbn[7]);
        var checkDig = (10 - (sum % 10)) % 10;
        isbn = util.format("978%s%d", isbn.substring(0, 9), checkDig);
        console.log('fixed isbn',isbn);
      } else {
        res.locals.error = 'Sorry, that is not a valid ISBN. Please provide an ISBN 10 or 13 number.';
        return myBooks(req, res);
      }
    }
    if (!(ownership === 'own' || ownership === 'selling' || ownership === 'buying')) {
      return res.send('not a valid ownership');
    }
    myUtils.getDbClient(function(err) {
      res.render('myBooks', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.'});
    }, function(client, done) {
      client.query('insert into bookList values ($1, $2, $3)', [req.user.email, isbn, ownership], function(err, result) {
        done();
        if (err) {
          console.error('problem adding new book', err);
          res.locals.error = 'That didn\'t quite work. Make sure you haven\'t already added that book to your list';
        }
        myBooks(req, res);
      });
    });
  } else if (action === 'modifyBook') {
    var ownership = req.body.ownedBookStatus;
    myUtils.getDbClient(function(err) {
      res.locals.error = 'Sorry, we couldn\'t update that book. Please try again.';
      return myBooks(req, res);
    }, function(client, done) {
      client.query('update bookList set ownership=$1 where email=$2 and isbn=$3', [ownership, req.user.email, isbn], function(err, result) {
        done();
        if (err) {
          console.error('problem updating book', err);
          res.locals.error = 'Sorry, we couldn\'t update that book. Please try again.';
        }
        myBooks(req, res);
      });
    });
  } else if (action === 'removeBook') {
    myUtils.getDbClient(function(err) {
      res.locals.error = 'Sorry, we couldn\'t remove that book. Please try again';
      return myBooks(req, res);
    }, function(client, done) {
      client.query('delete from bookList where email=$1 and isbn=$2', [req.user.email, isbn], function(err, result) {
        done();
        if (err) {
          console.error('problem removing book', err);
          res.locals.error = 'Sorry, we couldn\'t remove that book. Please try again';
        }
        myBooks(req, res);
      });
    });
  }
}

function findBooks(req, res) {
  console.log('school id', req.user.schoolid);
  myUtils.getDbClient(function(err) {
    res.render('findBooks', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.'});
  }, function(client, done) {
    client.query('select bookList.email,isbn,name as seller from bookList,students where bookList.email = students.email and schoolId = $2 and emailConfirmed and isbn in (select isbn from bookList,students where students.email = bookList.email and bookList.email = $1 and ownership = \'buying\' and emailConfirmed) and ownership = \'selling\'', [req.user.email, req.user.schoolid], function(err, result) {
      done();
      if (err) {
        console.log('error finding books', err);
        res.render('findBooks', {books: [], error:'Sorry, we are having trouble matching books for you. Please try again soon.'});
      } else {
        console.log(result);
        res.render('findBooks', {books:result.rows});
      }
    });
  });
}

module.exports.getAccount = getAccount;
module.exports.login = login;
module.exports.join = join;
module.exports.confirmEmail = confirmEmail;
module.exports.createAccount = createAccount;
module.exports.authenticateUser = authenticateUser;
module.exports.myBooks = myBooks;
module.exports.addBooks = addBooks;
module.exports.findBooks = findBooks;
