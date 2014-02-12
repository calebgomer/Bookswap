var Mandrill = require('mandrill-api/mandrill');
var m = new Mandrill.Mandrill();
var myUtils = require('./myUtils');
var util = require('util');

function sendEmail(arguments, callback) {
  var email = arguments.email;
  var name = arguments.name;
  var html = arguments.html;
  var text = arguments.text;
  var subject = arguments.subject;

  if (!(email && name && html && text && subject)) {
    return callback('emailHelper.sendEmail: not all parameters were given');
  }

  m.messages.send({
    key: process.env.MANDRILL_APIKEY,
    message: {
      subject: subject,
      html: html,
      text: text,
      from_email: process.env.ROBOT_EMAIL,
      from_name: process.env.ROBOT_NAME,
      to: [{
        email: email,
        name: name,
        type: "to"
      }]
    }
  }, function(err, result) {
    if (callback) {
      callback(err, result);
    }
  });
}

function sendNewEmailConfirmation(arguments, callback) {
  var email = arguments.email;
  var name = arguments.name;
  var confirmationCode = arguments.confirmationId;

  var subject = 'Please Confirm Your Email';
  var emailText = util.format(confirmationEmailText, name, process.env.ROOT_URL, confirmationCode, process.env.ROBOT_NAME);
  var emailHtml = util.format(confirmationEmailHtml, name, process.env.ROOT_URL, confirmationCode, process.env.ROBOT_NAME);
  sendEmail({email: email, name: name, subject: subject, html: emailHtml, text: emailText}, callback);
}

var confirmationEmailText = 'Hi %s,\nThank you for signing up for Book Swap! To confirm your email address, please click the following link. Copy and paste it into the address bar if clicking it does not work.\n\n%s/confirm/%s\n\nThanks,\n%s';
var confirmationEmailHtml = '<p>Hi %s,</p><p>Thank you for signing up for Book Swap! To confirm your email address, please click the following link. Copy and paste it into the address bar if clicking it does not work.</p><p>%s/confirm/%s</p><p>Thanks,<br>%s</p>';

module.exports.sendEmail = sendEmail;
module.exports.sendNewEmailConfirmation = sendNewEmailConfirmation;
