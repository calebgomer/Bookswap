// inserts some mock data

var async = require('async');
var myUtils = require('../myUtils');

function dbFail(err) {
  console.error('error!!',err);
}

function insertFakeSchools(callback) {
  myUtils.getDbClient(dbFail, function(client, done) {
    function allDone(err) {
      done();
      callback(err);
    }
    var insertQuery = 'insert into schools values ($1, $2, $3)';
    async.series([
      function(callback) {
        client.query(insertQuery, ['school1id', 'School 1', 'http://gvsu.verbacompare.com/'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['school2id', 'School 2', 'http://gvsu.verbacompare.com/'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['school3id', 'School 3', 'http://gvsu.verbacompare.com/'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['mail.gvsu.edu', 'Grand Valley State University', 'http://gvsu.verbacompare.com/'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['vt.edu', 'Virginia Tech', 'http://epos9-phx.sequoiars.com/ePOS?this_category=1427&store=109&form=shared3%2fgm%2fmain%2ehtml&design=109'], callback);
      }
    ], allDone);
  });
}

function insertFakeStudents(callback) {
  myUtils.getDbClient(dbFail, function(client, done) {
    function allDone(err, result) {
      done();
      callback(err);
    }
    var insertQuery = 'insert into students (email, password, name, schoolId) values ($1, $2, $3, $4)';
    async.series([
      function(callback) {
        client.query(insertQuery, ['student1@school.edu', 'pass1', 'Student One', 'school1id'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['student2@school.edu', 'pass2', 'Student Two', 'school2id'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['student3@school.edu', 'pass3', 'Student Three', 'school3id'], callback);
      }
    ], allDone);
  });
}

function insertFakeBooks(callback) {
  myUtils.getDbClient(dbFail, function(client, done) {
    function allDone(err) {
      done();
      callback(err);
    }
    var insertQuery = 'insert into bookList values ($1, $2, $3)';
    async.series([
      function(callback) {
        client.query(insertQuery, ['student1@school.edu', '9780132149181', 'own'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['student1@school.edu', '9780133370461', 'selling'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['student2@school.edu', '9780123944245', 'buying'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['student2@school.edu', '9780133370461', 'buying'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['student3@school.edu', '9780123944245', 'selling'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['student3@school.edu', '9780133370461', 'own'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['calebgomer@school2.edu', '9780132149181', 'own'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['calebgomer@school2.edu', '9780133370461', 'selling'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['calebgomer@school3.edu', '9780123944245', 'buying'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['calebgomer@school3.edu', '9780133370461', 'buying'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['kremere@mail.gvsu.edu', '9780123944245', 'selling'], callback);
      },
      function(callback) {
        client.query(insertQuery, ['kremere@mail.gvsu.edu', '9780133370461', 'own'], callback);
      }
    ], allDone);
  });
}

async.series([
    insertFakeSchools,
    insertFakeStudents,
    insertFakeBooks
  ],
  function(err) {
    myUtils.endDbConnection();
    if (err) {
      console.error(err);
    }
    else {
      console.log('done, no errors');
    }
  }
);
