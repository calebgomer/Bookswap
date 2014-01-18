var pg = require('pg');

function getDbClient(fail, success) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
      console.error('error getting client from pool', err);
      return fail({status:500, error: 'our database is having trouble, please try again soon'});
    }
    success(client, done);
  });
}

function endDbConnection() {
  pg.end();
}

module.exports.getDbClient = getDbClient;
module.exports.endDbConnection = endDbConnection;
