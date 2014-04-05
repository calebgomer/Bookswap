var myUtils = require('./myUtils');

function dashboard(req, res) {
  myUtils.getDbClient(res, function(client, done) {
    client.query('select count(*) as totalStudents from students', function(err, result) {
      done();
      if (err) {
        console.error('admin dashboard error', err);
        res.locals.errors.push('Sorry, we couldn\'t look up anything from the database. Check logs for details. Error code:'+err.code);
        res.render('admin/dashboard');
      } else {
        res.render('admin/dashboard', { totalStudents:result.rows[0].totalstudents} );
      }
    });
  });
}

module.exports.dashboard = dashboard;
