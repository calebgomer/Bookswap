var pg = require('pg');
var uuid = require('node-uuid');

function getDbClient(fail, success) {
  pg.connect(process.env.DATABASE_URL, function(err, client, done) {
    if (err) {
      console.error('error getting client from pool', err);
      if (typeof fail === 'function') {
        return fail({status:500, error: 'Our database is having trouble, please try again soon.'});
      } else if (typeof fail === 'object') {
        return fail.render('epicfail', { errors: ['Our database is having trouble, please try again soon.']});
      }
    }
    success(client, done);
  });
}

function endDbConnection() {
  pg.end();
}

function newUUID() {
  return uuid.v4();
}

module.exports.getDbClient = getDbClient;
module.exports.endDbConnection = endDbConnection;
module.exports.newUUID = newUUID;
