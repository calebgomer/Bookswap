var myUtils = require('../myUtils');

myUtils.getDbClient(function (err) {
  console.error('woah...', err);
}, function(client, done) {
  var query = process.argv[2];
  console.log('query\n', query);
  client.query(query, undefined, function(err, result) {
    console.error('errors\n', err);
    console.log('\nresults\n', result);
    done();
    myUtils.endDbConnection();
  });
});
