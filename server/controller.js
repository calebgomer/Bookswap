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
var mongo = require('mongodb');
var booksData;
mongo.Db.connect(process.env.MONGOHQ_URL, function(err, db) {
  db.collection('books', function(err, booksCollection) {
    booksData = booksCollection;
  });
});

function join(req, res) {
  res.render('join');
}

function createAccount(req, res) {
  var email = req.body.email;
  var password = req.body.password;
  var name = req.body.name;
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
      // console.log(result);
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
    client.query('select * from bookList where email = $1 order by ownership', [email], function(err, result) {
      if (err) {
        done();
        res.render('myBooks', {error:'Sorry, we\'re having some problems with the website right now. Please try again soon.', books: new Array()});
      } else {
        var isbns = _.pluck(result.rows, 'isbn');
        async.parallel([
          function(callback) {
            // get school textbook lookup url
            client.query('select schools.name,schools.textbookLookupUrl from schools,students where students.email=$1 and students.schoolId=schools.schoolId limit 1', [req.user.email], function(err, result) {
              done();
              console.log('**********',err,result.rowCount && result.rows[0]);
              callback(err, result.rowCount && result.rows[0]);
            });
          },
          function(callback) {
            // get book info from apis
            async.map(isbns, getBookInfo, function(err, books) {
              // insert user specific info in as well
              for (var i = books.length - 1; i >= 0; i--) {
                _.extend(books[i], result.rows[i]);
              }
              callback(err, books);
            });
          }], function(err, results) {
            if (err) {
              console.err('wtf',err);
              res.render('myBooks', {error: 'Sorry, we couldn\'t get your books right now. Please try again later'});
            } else {
              console.log('rendering');
              res.render('myBooks', {books: results[1], school: {name: results[0].name, textbookLookupUrl: results[0].textbooklookupurl}});
            }
          }
        );
      }
    });
  });
}

function getBookInfo(isbn, callback) {
  booksData.find({'isbn':isbn}).toArray(function(err, items) {
    if (items.length) {
      console.log('cached data found for', isbn);
      return callback(undefined, items[0]);
    }
    console.log('getting new data for', isbn);
    async.parallel([
      function(callback) {
        bookHelper.googleIsbnSearch(isbn, callback);
      }, function(callback) {
        bookHelper.amazonIsbnSearch(isbn, callback);
      }], function(err, results) {
        if (err) {
          return callback(err);
        }
        var book = {
          isbn: isbn,
          title:            results[0].items && results[0].items.length && results[0].items[0].volumeInfo.title || '(No Title Found)',
          subtitle:         results[0].items && results[0].items.length && results[0].items[0].volumeInfo.subtitle || '',
          authors:          results[0].items && results[0].items.length && results[0].items[0].volumeInfo.authors && results[0].items[0].volumeInfo.authors.join(', ') || ['Anonymous'],
          image:            results[1].ItemLookupResponse.Items[0].Item && results[1].ItemLookupResponse.Items[0].Item[0].MediumImage[0].URL[0],
          lowestNewPrice:   results[1].ItemLookupResponse.Items[0].Item && results[1].ItemLookupResponse.Items[0].Item[0].OfferSummary[0].LowestNewPrice && results[1].ItemLookupResponse.Items[0].Item[0].OfferSummary[0].LowestNewPrice[0].FormattedPrice[0],
          lowestUsedPrice:  results[1].ItemLookupResponse.Items[0].Item && results[1].ItemLookupResponse.Items[0].Item[0].OfferSummary[0].LowestUsedPrice && results[1].ItemLookupResponse.Items[0].Item[0].OfferSummary[0].LowestUsedPrice[0].FormattedPrice[0],
          offerPage:        results[1].ItemLookupResponse.Items[0].Item && results[1].ItemLookupResponse.Items[0].Item[0].Offers[0].MoreOffersUrl[0]
        }
        booksData.insert(book, console.log);
        callback(undefined, book);
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
        var isbns = _.pluck(result.rows, 'isbn');
        // get book info from apis
        async.map(isbns, getBookInfo, function(err, books) {
          // insert user specific info in as well
          for (var i = books.length - 1; i >= 0; i--) {
            _.extend(books[i], result.rows[i]);
          }
          console.log(books);
          res.render('findBooks', {books: books});
        });
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
