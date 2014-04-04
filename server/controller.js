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


function join(req, res) {
  res.render('join');
}

function createAccount(req, res) {
  var email = req.body.email;
  var password = req.body.password;
  var name = escape(req.body.name);
  if (email.indexOf(".edu", email.length - 4) == -1) {
    return res.render('join', {error: 'You must use a .edu email'});
  }
  if (!password || password.length < 8) {
    return res.render('join', {error: 'You must use a password with at least 8 charaters'});
  }
  var schoolId = email.substring(email.indexOf('@')+1);
  if (!name || !schoolId) {
    return res.render('join', {error: 'You must choose a name and pick your school'});
  }
  hashNewPassword(password, function(err, result) {
    if (err) {
      console.error('error hashing new password', err);
      return res.render('join', {error: 'Our site is having an issue, please try again'});
    }
    var passwordStuff = result;
    myUtils.getDbClient(function(err) {
      return res.render('join', {error: 'Our site is having an issue, please try again'});
    }, function(client, done) {
      var confirmationId = myUtils.newUUID();
      var insertQuery = 'insert into students (email, password, name, schoolId, emailConfirmationId) values ($1, $2, $3, $4, $5)';
      var insertParams = [email, passwordStuff, name, schoolId, confirmationId];
      client.query(insertQuery, insertParams, function(err, result) {
        if (err) {
          if (err.code === '23505') {
            done();
            console.log('user exists');
            res.render('join', {error: 'Sorry, an account with this email already exists.'});
          } else if (err.code === '23503') {
            console.log('new school! create entry in school table');
            client.query('insert into schools (schoolId) values ($1)', [schoolId], function(err, result) {
              if (err) {
                done();
                console.error('problem creating new school', err);
                return res.render('join', {error: 'Sorry, we weren\'t able to create your account. Please try again soon.'});
              }
              console.log('created new school', result);
              client.query(insertQuery, insertParams, function(err, result) {
                done();
                if (err) {
                  console.error('problem adding user after creating new school', err);
                  return res.render('join', {error: 'Sorry, we weren\'t able to create your account. Please try again soon.'});
                }
                console.log('added new user after creating new school', result);
                emailHelper.sendNewEmailConfirmation({name: name, email: email, confirmationId: confirmationId});
                res.render('joinSuccess', {name: name, email: email});
              });
            });
          } else {
            done();
            console.error('problem inserting new user with code', err.code, err);
            res.render('join', {error: 'Our site is having an issue, please try again.'});
          }
        } else {
          done();
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
  res.render('account');
}

function login(req, res) {
  res.locals.destination = req.params.destination;
  res.render('login');
}

function showPasswordReset(req, res) {
  res.render('passwordreset');
}

function passwordReset(req, res) {
  var email = req.body.email;
  var resetToken = myUtils.newUUID();
  myUtils.getDbClient(function(err) {
    res.render('passwordreset', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.'});
  }, function(client, done) {
    client.query('update students set passwordResetToken = $1,passwordResetRequestTime = $2 where email = $3', [resetToken, new Date(), email], function(err, result) {
      done();
      if (err) {
        res.render('passwordreset', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.'});
      } else {
        emailHelper.sendPasswordReset({email: email, name: email, resetToken: resetToken});
        res.render('passwordreset', {message:'If an account with your email exists, you will receive an email shortly with instuctions to reset your password.'});
      }
    });
  });
}

function myBooks(req, res) {
  console.log('cookie', req.cookies && req.cookies['import-books']);
  var email = req.user.email;
  myUtils.getDbClient(function(err) {
    res.render('myBooks', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.'});
  }, function(client, done) {
    client.query('select * from bookList where email = $1 order by ownership', [email], function(err, result) {
      if (err) {
        done();
        res.render('myBooks', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.'});
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
              res.render('myBooks', {error: 'Sorry, we couldn\'t get your books right now. Please try again later'});
            } else {
              res.render('myBooks', {books: results[1], school: {name: results[0].name, textbookLookupUrl: results[0].textbooklookupurl}});
            }
          }
        );
      }
    });
  });
}

function addBooks(req, res) {
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
    var ownership = req.body.own || req.body.selling || req.body.buying || req.body.remove;
    if (ownership === 'remove') {
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
    } else {
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
    }
  } else if (action === 'addTextbookLookupUrl') {
    var newTextbookLookupUrl = req.body.textbookLookupUrl;
    myUtils.getDbClient(function(err) {
      res.locals.error = 'Sorry, we couldn\'t add your school\'s textbook lookup page. Please try again later.';
      return myBooks(req, res);
    }, function(client, done) {
      client.query('update schools set textbooklookupurl=$1 from students where students.email = $2 and students.schoolid = schools.schoolid', [newTextbookLookupUrl, req.user.email], function(err, result) {
        done();
        if (err) {
          console.error('problem updating schools textbook lookup url');
          res.locals.error = 'Sorry, we couldn\'t add your school\'s textbook lookup page. Please try again later.';
        }
        return myBooks(req, res);
      });
    });
  }
}

function importBooks(req, res) {
  var isbns;
  if (req.body.isbns) {
    isbns = JSON.parse(req.body.isbns);
  } else {
    isbns = req.cookies && req.cookies['import-books'] && req.cookies['import-books'].isbns;
  }
  if (!(isbns && isbns.length)) {
    req.flash('message', ['You don\'t have any books to import.']);
    if (req.user) {
      res.redirect('/mybooks');
    } else {
      res.redirect('/');
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
      res.redirect('/mybooks');
    }, function(client, done) {
      async.each(importIsbns, function(isbn, callback) {
        client.query('insert into bookList values ($1, $2, $3)', [req.user.email, isbn, 'buying'], function(err, result) {
          if (err && err.code === '23505') {
            problems.push('ISBN '+isbn+": This book is already in your Book List");
          }
          console.log('insert', result && result.rowCount, 'errs:', err);
          callback(undefined, result);
        });
      }, function(err) {
        done();
        if (err) {
          console.error('problem importing books', err);
          req.flash('error', ['Sorry, something went terribly wrong and we couldn\'t import all of your books. Please try that again.']);
        } else {
          res.clearCookie('import-books');
          req.flash('error', [problems.length+' books were not added because they are already in your book list.']);
          req.flash('message', [importIsbns.length-problems.length+' books were successfully imported!']);
        }
        res.redirect('/mybooks');
      });
    });
  } else {
    res.cookie('import-books', { isbns:importIsbns, time:new Date() });
    req.flash('message', ['Please log in so we can add your books to your Book List!']);
    res.redirect('/login/import');
  }
}

function findBooks(req, res) {
  myUtils.getDbClient(function(err) {
    res.render('findBooks', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.'});
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
          res.render('findBooks', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.'});
        } else {
          for (var i = 0; i < results[1].length; i++) {
            // copy over the number of sellers for each book
            results[1][i].numSellers = results[0][results[1][i].isbn] || 0;
          }
          res.render('findBooks', { books: results[1] });
        }
      }
    );
  });
}

function foundBook(req, res) {
  var action = req.body.action;
  var isbn = req.body.isbn;
  console.log('isbn',isbn);
  console.log('message', req.body.message);
  switch(action) {
    case 'message':
      var message = escape(req.body.message);
      myUtils.getDbClient(function(err) {
        res.locals.error = 'Sorry, we\'re having some problems with the website right now. Please try again soon.';
        findBooks(req, res);
      }, function(client, done) {
        client.query('select students.name,students.email from bookList,students where bookList.ownership = \'selling\' and bookList.email = students.email and students.schoolId = $2 and emailConfirmed and bookList.isbn = $1', [isbn, req.user.schoolid], function(err, result) {
          done();
          console.log('peeps', JSON.stringify(result.rows));
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
                res.locals.error = 'Sorry, we\'re having trouble finding that book. Make sure you have a valid ISBN and please try again soon.';
                return findBooks(req, res);
              }
              emailHelper.sendBookInquiryEmail({
                toPeople: toPeople,
                fromPerson: { name: req.user.name, email: req.user.email },
                message: message,
                title: book.title,
                isbn: book.isbn
              }, function(err, result) {
                if (err) {
                  console.error('error sending inquiry email', err);
                  res.locals.error = 'Sorry, there was a problem sending your email. Please try again soon.';
                  findBooks(req, res);
                } else {
                  res.locals.message = 'Your email has been sent!';
                  findBooks(req, res);
                }
              });
            });
          } else {
            res.locals.error = 'Sorry, no one is selling that book!';
            findBooks(req, res);
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
module.exports.import = importBooks;
