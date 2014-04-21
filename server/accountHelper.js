// user account tools

var myUtils = require('./myUtils');

// handle user requests from confirmation email link
function confirmEmail(confirmationId, callback) {
  myUtils.getDbClient(function(err) {
    return callback('Our site is having issues, please try again.');
  }, function(client, done) {
    client.query('update students set emailConfirmed = true where emailConfirmationId = $1', [confirmationId], function(err, result) {
      done();
      if (err) {
        console.error('error confirming email', err);
        callback('Sorry, your email address could not be confirmed. Please log in and have us send you another email.');
      } else {
        if (result.rowCount) {
          callback();
        } else {
          callback('Sorry, your email address could not be confirmed. Please log in and have us send you another email.');
        }
      }
    });
  });
}

module.exports.confirmEmail = confirmEmail;
