var myUtils = require('./myUtils');
var async = require('async');
var Mandrill = require('mandrill-api/mandrill');
var mandrill = new Mandrill.Mandrill();
var flags = {
  'Password Reset':'on',
  'Use Google':'on',
  'Use Amazon':'on'
};
var apis = {
  'Mandrill': { usage:0, limit:12000 },
  'Google': { link:'https://code.google.com/apis/console/b/0/?noredirect#project:50327074689:quotas' },
  // 'Amazon': { }
};
var funFacts = {};
function dashboard(req, res) {
  async.parallel([
      function(callback) {
        mandrill.users.info(function(info) {
          var limit = Math.min(info.hourly_quota*24*30,12000);
          var usage = info.stats.last_30_days.sent;
          apis.Mandrill = { usage:usage, limit:limit };
          callback();
        });
      },
      function(callback) {
        myUtils.getDbClient(res, function(client, done) {
          var infoQuery = 'select numStudents, numConfirmedStudents, numSchools, numBooks ' +
          'from (select count(email) as numStudents from students) numStudents ' +
          'cross join (select count(email) as numConfirmedStudents from students where emailConfirmed) numConfirmedStudents ' +
          'cross join (select count(schoolId) as numSchools from schools) numSchools ' +
          'cross join (select count(isbn) as numBooks from bookList) numBooks'
          client.query(infoQuery, function(err, result) {
            done();
            if (!err) {
              funFacts['Number of Students'] = result.rows[0].numstudents;
              funFacts['Number of Confirmed Students'] = result.rows[0].numconfirmedstudents;
              funFacts['Number of Books'] = result.rows[0].numbooks;
              funFacts['Number of Schools'] = result.rows[0].numschools;
            }
            callback();
          });
        });
      },
      function(callback) {
        switch(req.body.action) {
          case 'query':
            var query = req.body.query;
            myUtils.getDbClient(res, function(client, done) {
              client.query(query, function(err, result) {
                done();
                result = result || {};
                result.query = query;
                callback(err, result);
              });
            });
            break;
          case 'toggleFlag':
            if (req.body.flagName && flags[req.body.flagName]) {
              flags[req.body.flagName] = flags[req.body.flagName]==='off'?'on':'off';
            }
            callback();
            break;
          default:
            callback();
            break;
        }
      }
    ], function(err, result) {
      if (err) {
        res.locals.errors.push(err);
      }
      res.locals.results = result[2];
      res.locals.apis = apis;
      res.locals.featureFlags = flags;
      res.locals.funFacts = funFacts;
      res.render('admin/dashboard');
  });
}

module.exports.dashboard = dashboard;
