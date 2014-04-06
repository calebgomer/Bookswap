var myUtils = require('../myUtils');

myUtils.getDbClient(function (err) {
  console.error('Woah...', err);
}, function(client, done) {
  var query = process.argv.slice(2)[0];
  client.query(query, undefined, function(err, result) {
    done();
    myUtils.endDbConnection();
    console.log('Ran command:\n', query);
    if (err) {
      console.error('Oops, errors...', err);
    } else {
      console.log('Successfully '+result.command+'ED', result.rowCount, 'rows, resulting rows:\n', result.rows);
    }
  });
});
