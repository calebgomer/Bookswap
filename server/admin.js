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
function dashboard(req, res) {
  async.parallel([
      function(callback) {
        mandrill.users.info(function(info) {
          var limit = Math.min(info.hourly_quota*24*30,12000);
          var usage = info.stats.last_30_days.sent;
          apis['Mandrill'] = { usage:usage, limit:limit };
          callback();
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
                if (err) {
                  res.locals.errors.push(err);
                }
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
      res.locals.results = result[1];
      res.locals.apis = apis;
      res.locals.featureFlags = flags;
      res.render('admin/dashboard');
  });
}

module.exports.dashboard = dashboard;
