var myUtils = require('./myUtils');

function dashboard(req, res) {
  switch(req.body.action) {
    case 'query':
      var query = req.body.query;
      myUtils.getDbClient(res, function(client, done) {
        client.query(query, function(err, result) {
          if (err) {
            res.locals.errors.push(err);
          }
          if (result) {
            result.query = query;
            res.locals.results = result;
          }
          res.render('admin/dashboard');
        });
      });
      break;
    default:
      res.render('admin/dashboard');
      break;
  }
}

module.exports.dashboard = dashboard;
