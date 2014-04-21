// controller to direct user traffic

var validator = require('validator');
var myUtils = require('./myUtils');
var util = require('util');
var crypto = require('crypto');
var accountHelper = require('./accountHelper');
var emailHelper = require('./emailHelper');
var bookHelper = require('./bookHelper');
var _ = require('underscore');
var async = require('async');
require('buffertools').extend();
var escape = require('escape-html');

// renders templates
function _render(res, template, locals) {
  if (!res) {
    console.error('cannot render without a response object');
    return;
  }
  if (template) {
    res.render(template, locals);
  } else {
    res.locals.errors.push('No template was specified.');
    res.render('epicfail', locals);
  }
}

// redirects responses
function _redirect(res, path) {
  if (res) {
    if (path) {
      res.redirect(path);
    } else {
      console.error('no path to redirect to');
    }
  } else {
    console.error('no response to redirect');
  }
}

// show new user join page
function join(req, res) {
  _join(req, res, _render);
}
function _join(req, res, render) {
  render(res, 'join');
}

// create new user account
// creates new schools if user is first from their school
function createAccount(req, res) {
  _createAccount(req, res, _render);
}
function _createAccount(req, res, render) {
  var name = escape(req.body.name);
  var email = req.body.email;
  var password = req.body.password;
  if (!(name && name.length && name !== 'undefined')) {
    res.locals.errors.push('Please provide your name');
    return render(res, 'join');
  }
  if (!(email && email.length)) {
    res.locals.errors.push('Please provide an email address');
    return render(res, 'join');
  }
  if (email.indexOf(".edu", email.length - 4) == -1) {
    res.locals.errors.push('Please use an email address ending with ".edu"');
    return render(res, 'join');
  }
  var schoolId = email.substring(email.indexOf('@')+1);
  if (!schoolId) {
    res.locals.errors.push('Please provide a real email');
    return render(res, 'join');
  }
  if (!password || password.length < 8) {
    res.locals.errors.push('Please use a password with at least 8 charaters');
    return render(res, 'join');
  }
  hashNewPassword(password, function(err, result) {
    if (err) {
      console.error('error hashing new password', err);
      res.locals.errors.push('Our site is having issues, please try again');
      return render(res, 'join');
    }
    var passwordStuff = result;
    myUtils.getDbClient(function(err) {
      res.locals.errors.push('Our site is having issues, please try again');
      return render(res, 'join');
    }, function(client, done) {
      var confirmationId = myUtils.newUUID();
      var insertQuery = 'insert into students (email, password, name, schoolId, emailConfirmationId) values ($1, $2, $3, $4, $5)';
      var insertParams = [email, passwordStuff, name, schoolId, confirmationId];
      client.query(insertQuery, insertParams, function(err, result) {
        if (err) {
          if (err.code === '23505') {
            done();
            res.locals.errors.push('Sorry, an account with this email already exists.');
            render(res, 'join');
          } else if (err.code === '23503') {
            client.query('insert into schools (schoolId) values ($1)', [schoolId], function(err, result) {
              if (err) {
                done();
                console.error('problem creating new school', err);
                res.locals.errors.push('Sorry, we weren\'t able to create your account. Please try again soon.');
                return render(res, 'join');
              }
              client.query(insertQuery, insertParams, function(err, result) {
                done();
                if (err) {
                  console.error('problem adding user after creating new school', err);
                  res.locals.errors.push('Sorry, we weren\'t able to create your account. Please try again soon.');
                  return render(res, 'join');
                }
                emailHelper.sendNewEmailConfirmation({name: name, email: email, confirmationId: confirmationId});
                render(res, 'joinSuccess', {name: name, email: email});
              });
            });
          } else {
            done();
            console.error('problem inserting new user with code', err.code, err);
            res.locals.errors.push('Our site is having issues, please try again.');
            render(res, 'join');
          }
        } else {
          done();
          emailHelper.sendNewEmailConfirmation({name: name, email: email, confirmationId: confirmationId});
          render(res, 'joinSuccess', {name: name, email: email});
        }
      });
    });
  });
}

// authenticates a user's email and password
function authenticateUser(email, password, callback) {
  myUtils.getDbClient(function(err) {
    console.error('auth error', err);
    callback(err);
  }, function(client, done) {
    client.query('select * from students where email = $1', [email], function(err, result) {
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
                  callback('Your email or password is incorrect');
                }
              }
            }
          );
        } else {
          callback('Your email or password is incorrect');
        }
      }
    });
  });
}

// hashes a password with default parameters and new salt
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

// gets some random bytes for password salt
function saltShaker(keylen, callback) {
  crypto.randomBytes(keylen, callback);
}

// hashes password with a specific salt
function hashPassword(password, salt, callback) {
  var iterations = process.env.HASH_ITERATION || 200000;
  var keylen = process.env.HASH_KEYLEN || 16;
  hashPasswordWithIterationsAndKeylen(password, salt, iterations, keylen, callback);
}

// hashes password with a specific salt, number of iterations, and key length
function hashPasswordWithIterationsAndKeylen(password, salt, iterations, keylen, callback) {
  crypto.pbkdf2(password, salt, iterations, keylen, function(err, key) {
    callback(err, {salt:salt, iterations:iterations, keylen:keylen, key:key});
  });
}

// processes email confirmation requests
function confirmEmail(req, res) {
  _confirmEmail(req, res, _redirect);
}
function _confirmEmail(req, res, redirect) {
  var confirmationId = req.params.confirmationId;
  accountHelper.confirmEmail(confirmationId, function(err, result) {
    if (err) {
      console.error(err);
      req.flash('error', err);
      redirect(res, '/account');
    } else {
      req.flash('message', 'Your email address has been confirmed!');
      redirect(res, '/account');
    }
  });
}

// renders user's account page and handles confirmation email resending
function getAccount(req, res) {
  _getAccount(req, res, _render);
}
function _getAccount(req, res, render) {
  if (req.body && req.body.resendConfirmationEmail) {
    var confirmationId = myUtils.newUUID();
    myUtils.getDbClient(res, function(client, done) {
      client.query('update students set emailConfirmationId = $1 where email = $2', [confirmationId, req.user.email], function(err, result) {
        if (err) {
          console.error('problem resending confirmation email', err);
          res.locals.errors.push('Sorry, we couldn\'t resend your confirmation email. Please try again soon.');
        } else {
          emailHelper.sendNewEmailConfirmation({ name:req.user.name, email:req.user.email, confirmationId:confirmationId });
          res.locals.messages.push(util.format('We sent another confirmation email to %s.', req.user.email));
        }
        render(res, 'account');
      });
    });
  } else {
    render(res, 'account');
  }
}

// displays login page
function login(req, res) {
  _login(req, res, _render);
}
function _login(req, res, render) {
  if (req.path.length >= 6) {
    // removes the '/login' from the path, the rest is the destination
    res.locals.destination = req.path.substring(6);
  }
  render(res, 'login');
}

// displays password reset page
function showPasswordReset(req, res) {
  _showPasswordReset(req, res, _render);
}
function _showPasswordReset(req, res, render) {
  res.locals.resetToken = req.params.resetToken;
  render(res, 'passwordreset');
}

// sends password reset emails and resets passwords
function passwordReset(req, res) {
  _passwordReset(req, res, _render, _redirect);
}
function _passwordReset(req, res, render, redirect) {
  var action = req.body.action;
  switch (action) {
    case 'sendEmail':
      var email = req.body.email;
      var resetToken = myUtils.newUUID();
      myUtils.getDbClient(res, function(client, done) {
        client.query('update students set passwordResetToken = $1,passwordResetRequestTime = $2 where email = $3', [resetToken, new Date(), email], function(err, result) {
          done();
          if (err) {
            console.error('problem setting password reset token', err);
            res.locals.errors.push('Sorry, we\'re having some problems with the website right now. Please try again soon.');
            render(res, 'passwordreset');
          } else {
            if (result.rowCount) {
              emailHelper.sendPasswordReset({email: email, name: email, resetToken: resetToken});
            }
            res.locals.messages.push('If an account with your email exists, you will receive an email shortly with instuctions to reset your password.');
            render(res, 'passwordreset');
          }
        });
      });
      break;
    case 'resetPassword':
      var resetToken = req.body.resetToken;
      var newPassword = req.body.password;
      if (!resetToken) {
        res.locals.errors.push('Sorry, we couldn\'t reset your password. Please request a new email and try again.');
        req.params.resetToken = resetToken;
        return _showPasswordReset(req, res, render);
      }
      if (!(newPassword && newPassword.length >= 8)) {
        res.locals.errors.push('Please choose a password that\'s at least 8 characters.');
        req.params.resetToken = resetToken;
        return _showPasswordReset(req, res, render);
      }
      hashNewPassword(newPassword, function(err, passwordStuff) {
        myUtils.getDbClient(res, function(client, done) {
          client.query('update students set password = $1,passwordResetToken = NULL where passwordResetToken = $2', [passwordStuff, resetToken], function(err, result) {
            done();
            if (err) {
              console.error('problem resetting password', err);
              res.locals.errors.push('Sorry, we couldn\'t reset your password. Please request a new email and try again.');
              render(res, 'passwordreset');
            } else {
              if (result.rowCount) {
                req.flash('message', 'Your password has been reset.');
                redirect(res, '/login');
              } else {
                res.locals.errors.push('Sorry, we couldn\'t reset your password. Please request a new email and try again.');
                render(res, 'passwordreset');
              }
            }
          });
        });
      });
      break;
    default:
      res.locals.warnings.push('What on earth are you doing?');
      render(res, 'passwordreset');
      break;
  }
}

// displays user's book page
function myBooks(req, res) {
  _myBooks(req, res, _render);
}
function _myBooks(req, res, render) {
  var email = req.user.email;
  myUtils.getDbClient(res, function(client, done) {
    client.query('select * from bookList where email = $1 order by ownership', [email], function(err, result) {
      if (err) {
        done();
        res.locals.errors.push('Sorry, we\'re having some problems with the website right now. Please try again soon.');
        render(res, 'myBooks');
      } else {
        var isbns = _.pluck(result.rows, 'isbn');
        async.parallel([
          function(callback) {
            // get school textbook lookup url
            client.query('select schools.name,schools.textbookLookupUrl from schools,students where students.email=$1 and students.schoolId=schools.schoolId limit 1', [req.user.email], function(err, result) {
              done();
              callback(err, result.rowCount && result.rows[0]);
            });
          },
          function(callback) {
            // get book info from apis
            async.map(isbns, bookHelper.getBookInfo, function(err, books) {
              // insert user specific info in as well
              for (var i = books.length - 1; i >= 0; i--) {
                _.extend(books[i], result.rows[i]);
              }
              callback(err, books);
            });
          }], function(err, results) {
            if (err) {
              console.error('error getting my books',err);
              res.locals.errors.push('Sorry, we couldn\'t get your books right now. Please try again later');
              render(res, 'myBooks');
            } else {
              var po = req.body&&req.body.newBookOwnership;
              render(res, 'myBooks', {books: results[1], school: {name: results[0].name, textbookLookupUrl: results[0].textbooklookupurl}, previousOwnership:po});
            }
          }
        );
      }
    });
  });
}

// adds books to user's lists
function addBooks(req, res) {
  _addBooks(req, res, _render);
}
function _addBooks(req, res, render) {
  var action = req.body.action;
  var isbn = req.body.isbn && req.body.isbn.replace(/-/g,'').trim();
  if (action === 'addBook') {
    var ownership = req.body.newBookOwnership;
    if (!validator.isISBN(isbn, 13)) {
      if (validator.isISBN(isbn, 10)) {
        var sum = 38 + 3 * (parseInt(isbn[0]) + parseInt(isbn[2]) + parseInt(isbn[4]) + parseInt(isbn[6]) + parseInt(isbn[8])) + parseInt(isbn[1]) + parseInt(isbn[3]) + parseInt(isbn[5]) + parseInt(isbn[7]);
        var checkDig = (10 - (sum % 10)) % 10;
        isbn = util.format("978%s%d", isbn.substring(0, 9), checkDig);
      } else {
        res.locals.errors.push('Sorry, that is not a valid ISBN. Please provide an ISBN 10 or 13 number.');
        return _myBooks(req, res, render);
      }
    }
    if (!(ownership === 'own' || ownership === 'selling' || ownership === 'buying')) {
      res.locals.errors.push('Ownership must be one of \'own\', \'selling\', or \'buying\'');
      return render(res, 'not a valid ownership');
    }
    myUtils.getDbClient(function(err) {
      res.locals.errors.push('Sorry, we\'re having some problems with the website right now. Please try again soon.');
      res.render('myBooks');
    }, function(client, done) {
      client.query('insert into bookList values ($1, $2, $3)', [req.user.email, isbn, ownership], function(err, result) {
        done();
        if (err) {
          console.error('problem adding new book', err);
          res.locals.errors.push('That didn\'t quite work. Make sure you haven\'t already added that book to your list');
        }
        _myBooks(req, res, render);
      });
    });
  } else if (action === 'modifyBook') {
    var ownership = req.body.own || req.body.selling || req.body.buying || req.body.remove;
    if (ownership === 'remove') {
      myUtils.getDbClient(function(err) {
        res.locals.errors.push('Sorry, we couldn\'t remove that book. Please try again');
        return _myBooks(req, res, render);
      }, function(client, done) {
        client.query('delete from bookList where email=$1 and isbn=$2', [req.user.email, isbn], function(err, result) {
          done();
          if (err) {
            console.error('problem removing book', err);
            res.locals.errors.push('Sorry, we couldn\'t remove that book. Please try again');
          }
          _myBooks(req, res, render);
        });
      });
    } else {
      myUtils.getDbClient(function(err) {
        res.locals.errors.push('Sorry, we couldn\'t update that book. Please try again.');
        return _myBooks(req, res, render);
      }, function(client, done) {
        client.query('update bookList set ownership=$1 where email=$2 and isbn=$3', [ownership, req.user.email, isbn], function(err, result) {
          done();
          if (err) {
            console.error('problem updating book', err);
            res.locals.errors.push('Sorry, we couldn\'t update that book. Please try again.');
          }
          _myBooks(req, res, render);
        });
      });
    }
  } else if (action === 'addTextbookLookupUrl') {
    var newTextbookLookupUrl = req.body.textbookLookupUrl;
    myUtils.getDbClient(function(err) {
      res.locals.errors.push('Sorry, we couldn\'t add your school\'s textbook lookup page. Please try again later.');
      return _myBooks(req, res, render);
    }, function(client, done) {
      client.query('update schools set textbooklookupurl=$1 from students where students.email = $2 and students.schoolid = schools.schoolid', [newTextbookLookupUrl, req.user.email], function(err, result) {
        done();
        if (err) {
          console.error('problem updating schools textbook lookup url');
          res.locals.errors.push('Sorry, we couldn\'t add your school\'s textbook lookup page. Please try again later.');
        }
        return _myBooks(req, res, render);
      });
    });
  }
}

// imports books from various websites using the bookmarklet
function importBooks(req, res) {
  _importBooks(req, res, _render, _redirect);
}
function _importBooks(req, res, render, redirect) {
  var isbns;
  if (req.body.isbns) {
    isbns = JSON.parse(req.body.isbns);
  } else {
    isbns = req.cookies && req.cookies['import-books'] && req.cookies['import-books'].isbns;
  }
  if (!(isbns && isbns.length)) {
    req.flash('message', 'You don\'t have any books to import.');
    if (req.user) {
      redirect(res, '/mybooks');
    } else {
      redirect(res, '/');
    }
    return;
  }
  var importIsbns = [];
  for (var i = 0; i < isbns.length; i++) {
    var isbn = escape(isbns[i].replace(/-/g, '').trim());
    if (validator.isISBN(isbn)) {
      if (isbn.length == 10) {
        isbn = bookHelper.isbn10to13(isbn);
      }
      importIsbns.push(isbn);
    }
  }
  var problems = [];
  if (req.user) {
    myUtils.getDbClient(function(err) {
      req.flash('error', ['Sorry, we\'re having problems with our website right now. Please try that again soon.']);
      redirect(res, '/mybooks');
    }, function(client, done) {
      async.each(importIsbns, function(isbn, callback) {
        client.query('insert into bookList values ($1, $2, $3)', [req.user.email, isbn, 'buying'], function(err, result) {
          if (err && err.code === '23505') {
            problems.push('ISBN '+isbn+": This book is already in your Book List");
          }
          callback(undefined, result);
        });
      }, function(err) {
        done();
        if (err) {
          console.error('problem importing books', err);
          req.flash('error', 'Sorry, something went terribly wrong and we couldn\'t import all of your books. Please try that again.');
        } else {
          res.clearCookie('import-books');
          if (problems.length) {
            req.flash('error', '%d books were not added because they are already in your book list.', problems.length);
          }
          req.flash('message', '%d books were successfully imported!', (importIsbns.length-problems.length));
        }
        redirect(res, '/mybooks');
      });
    });
  } else {
    res.cookie('import-books', { isbns:importIsbns, time:new Date() });
    req.flash('message', 'Please log in so we can add your books to your Book List!');
    redirect(res, '/login/import');
  }
}

// shows online book links and matches users with each other
function findBooks(req, res) {
  _findBooks(req, res, _render);
}
function _findBooks(req, res, render) {
  myUtils.getDbClient(function(err) {
    res.locals.errors.push('Sorry, we\'re having some problems with the website right now. Please try again soon.');
    render(res, 'findBooks');
  }, function(client, done) {
    async.parallel([
      function(callback) {
        // get number of sellers selling books
        client.query('select count(bookList.*) as numSellers,isbn from bookList inner join students on bookList.email = students.email where ownership = \'selling\' and schoolId = $2 and emailConfirmed and isbn in (select isbn from bookList,students where students.email = bookList.email and bookList.email = $1 and ownership = \'buying\' and emailConfirmed) group by bookList.isbn', [req.user.email, req.user.schoolid], function(err, result) {
          if (err) {
            return callback(err);
          }
          var numSellers = {};
          for (var i = 0; i < result.rows.length; i++) {
            numSellers[result.rows[i].isbn] = result.rows[i].numsellers;
          }
          callback(err, numSellers);
        });
      },
      function(callback) {
        // get all user's books
        client.query('select * from bookList where email = $1 and ownership = \'buying\'', [req.user.email], function(err, result) {
          if (err) {
            return callback(err);
          }
          var isbns = _.pluck(result.rows, 'isbn');
            // get book info from apis
          async.map(isbns, bookHelper.getBookInfo, function(err, books) {
            // insert user specific info in as well
            for (var i = books.length - 1; i >= 0; i--) {
              _.extend(books[i], result.rows[i]);
            }
            callback(err, books);
          });
        });
      }], function(err, results) {
        done();
        if (err) {
          console.error('error finding books',err);
          res.locals.errors.push('Sorry, we\'re having some problems with the website right now. Please try again soon.');
          render(res, 'findBooks');
        } else {
          for (var i = 0; i < results[1].length; i++) {
            // copy over the number of sellers for each book
            results[1][i].numSellers = results[0][results[1][i].isbn] || 0;
          }
          var sortedBooks = _.sortBy(results[1], function(book) { return -book.numSellers; });
          render(res, 'findBooks', { books: results[1] });
        }
      }
    );
  });
}

// send an email to book sellers
function foundBook(req, res) {
  _foundBook(req, res, _render);
}
function _foundBook(req, res, render) {
  var action = req.body.action;
  var isbn = req.body.isbn;
  switch(action) {
    case 'message':
      var message = escape(req.body.message);
      myUtils.getDbClient(function(err) {
        res.locals.errors.push('Sorry, we\'re having some problems with the website right now. Please try again soon.');
        _findBooks(req, res, render);
      }, function(client, done) {
        client.query('select students.name,students.email from bookList,students where bookList.ownership = \'selling\' and bookList.email = students.email and students.schoolId = $2 and emailConfirmed and bookList.isbn = $1', [isbn, req.user.schoolid], function(err, result) {
          done();
          var toPeople = [];
          for (var i = 0; i < result.rows.length; i++) {
            toPeople.push({
              name: result.rows[i].name,
              email: result.rows[i].email,
              type: 'bcc'
            });
          }
          if (toPeople.length) {
            bookHelper.getBookInfo(isbn, function(err, book) {
              if (err) {
                res.locals.errors.push('Sorry, we\'re having trouble finding that book. Make sure you have a valid ISBN and please try again soon.');
                return _findBooks(req, res, render);
              }
              emailHelper.sendBookInquiryEmail({
                toPeople: toPeople,
                fromPerson: { name: req.user.name, email: req.user.email },
                message: message,
                title: book.title,
                isbn: book.isbn
              }, function(result) {
                res.locals.messages.push('Your email has been sent!');
                findBooks(req, res);
              }, function(err) {
                console.error('error sending inquiry email', err);
                res.locals.errors.push('Sorry, there was a problem sending your email. Please try again soon.');
                _findBooks(req, res, render);
              });
            });
          } else {
            res.locals.errors.push('Sorry, no one is selling that book!');
            _findBooks(req, res, render);
          }
        });
      });
      break;
  }
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
module.exports.foundBook = foundBook;
module.exports.passwordReset = passwordReset;
module.exports.showPasswordReset = showPasswordReset;
module.exports.importBooks = importBooks;

module.exports._getAccount = _getAccount;
module.exports._login = _login;
module.exports._join = _join;
module.exports._confirmEmail = _confirmEmail;
module.exports._createAccount = _createAccount;
module.exports._myBooks = _myBooks;
module.exports._addBooks = _addBooks;
module.exports._findBooks = _findBooks;
module.exports._foundBook = _foundBook;
module.exports._passwordReset = _passwordReset;
module.exports._showPasswordReset = _showPasswordReset;
module.exports._importBooks = _importBooks;
