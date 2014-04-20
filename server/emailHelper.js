var Mandrill = require('mandrill-api/mandrill');
var m = new Mandrill.Mandrill();
var myUtils = require('./myUtils');
var util = require('util');

function actuallySendEmail(send, callback) {
  m.messages.send(send, function(err, result) {
    if (callback) {
      callback(err, result);
    }
  });
}

function sendEmail(arguments, callback) {
  if (!arguments) {
    return callback && callback('Please provide arguments');
  }
  var fromPerson = arguments.fromPerson || {
    name: process.env.ROBOT_NAME,
    email: process.env.ROBOT_EMAIL
  };
  var toPeople = arguments.toPeople;
  var replyTo = arguments.replyTo;
  var html = arguments.html;
  var text = arguments.text;
  var subject = arguments.subject;
  if (!toPeople) {
    return callback && callback('Please provide toPeople');
  }
  if (!html) {
    return callback && callback('Please provide email html');
  }
  if (!text) {
    return callback && callback('Please provide email text');
  }
  if (!subject) {
    return callback && callback('Please provide a subject');
  }

  if (!(toPeople && html && text && subject)) {
    if (callback) {
      callback('emailHelper.sendEmail: not all parameters were given');
    }
    return;
  }
  var send = {
    key: process.env.MANDRILL_APIKEY,
    message: {
      subject: subject || '(No Subject)',
      html: html || '(No Body)',
      text: text || '(No Body)',
      from_email: fromPerson.email,
      from_name: fromPerson.name,
      to: []
    }
  };
  if (replyTo) {
    send.headers = {
      "Reply-To": replyTo
    }
  }
  for (var i = 0; i < toPeople.length; i++) {
    send.message.to.push({ email:toPeople[i].email, name:toPeople[i].name, type:toPeople[i].type });
  }
  actuallySendEmail(send, callback);
}

var confirmationEmailText = 'Hi %s,\nThank you for signing up for Book Swap! To confirm your email address, please click the following link. Copy and paste it into the address bar if clicking it does not work.\n\n%s/confirm/%s\n\nThanks,\n%s';
var confirmationEmailHtml = '<p>Hi %s,</p><p>Thank you for signing up for Book Swap! To confirm your email address, please click the following link. Copy and paste it into the address bar if clicking it does not work.</p><p>%s/confirm/%s</p><p>Thanks,<br>%s</p>';

function sendNewEmailConfirmation(arguments, callback) {
  if (!(arguments && arguments.email && arguments.name)) {
    return callback && callback('Please provide an email and name');
  }
  var toPeople = [{
    email: arguments.email,
    name: arguments.name,
    type: 'to'
  }];
  var confirmationCode = arguments.confirmationId;
  if (!confirmationCode) {
    return callback && callback('Please provide a confirmation code');
  }

  var subject = 'Please Confirm Your Email';
  var emailText = util.format(confirmationEmailText, toPeople[0].name, process.env.ROOT_URL, confirmationCode, process.env.ROBOT_NAME);
  var emailHtml = util.format(confirmationEmailHtml, toPeople[0].name, process.env.ROOT_URL, confirmationCode, process.env.ROBOT_NAME);
  sendEmail({toPeople: toPeople, subject: subject, html: emailHtml, text: emailText}, callback);
}

var passwordResetEmailText = 'Hi %s,\nIt looks like you made a request to reset your Book Swap password. To complete the process, please click the following link and choose a new password.\n\n%s/passwordreset/%s\n\nIf you did not request to reset your password please ignore this email and your password reset token will invalidate soon.\n\nThanks,\n%s';
var passwordResetEmailHtml = '<p>Hi %s,</p><p>It looks like you made a request to reset your Book Swap password. To complete the process, please click the following link and choose a new password.</p><p>%s/passwordreset/%s</p><p>If you did not request to reset your password please ignore this email and your password reset token will invalidate soon.</p><p>Thanks,<br>%s</p>';

function sendPasswordReset(arguments, callback) {
  if (!(arguments && arguments.email && arguments.name)) {
    return callback && callback('Please provide an email and name');
  }
  var toPeople = [{
    email: arguments.email,
    name: arguments.name,
    type: 'to'
  }];
  var resetToken = arguments.resetToken;
  if (!resetToken) {
    return callback && callback('Please provide a reset token');
  }

  var subject = 'Reset Your Book Swap Password';
  var emailText = util.format(passwordResetEmailText, toPeople[0].name, process.env.ROOT_URL, resetToken, process.env.ROBOT_NAME);
  var emailHtml = util.format(passwordResetEmailHtml, toPeople[0].name, process.env.ROOT_URL, resetToken, process.env.ROBOT_NAME);
  sendEmail({toPeople: toPeople, subject: subject, html: emailHtml, text: emailText}, callback);
}

var bookInquiryEmailText = 'Hi Book Swap Seller,\nI am interested in your copy of "%s" (ISBN: %s).\n%s\n\nThanks!\n%s (%s)\n\nJust like on Craigslist, remember to beware of scams and to be safe.\nhttp://www.craigslist.org/about/scams\nhttp://www.craigslist.org/about/safety';
var bookInquiryEmailHtml = '<p>Hi Book Swap Seller,</p><p>I am interested in your copy of "%s" (ISBN: %s).</p><p>%s</p><p>Thanks!</p><p>%s (%s)</p><h4>Just like on Craigslist, remember to beware of <a href="http://www.craigslist.org/about/scams">scams</a> and to be <a href="http://www.craigslist.org/about/safety">safe</a>.</h4>';

function sendBookInquiryEmail(arguments, callback) {
  var toPeople = arguments.toPeople;
  if (!(toPeople && toPeople.length)) {
    return callback && callback('Please provide recipients');
  }
  var fromPerson = arguments.fromPerson;
  if (!(fromPerson && fromPerson.email && fromPerson.name)) {
    return callback && callback('Please provide a sender');
  }
  var bookIsbn = arguments.isbn;
  if (!bookIsbn) {
    return callback && callback('Please provide an isbn');
  }

  var bookTitle = arguments.title;
  var message = arguments.message;
  for (var i = 0; i < toPeople.length; i++) {
    toPeople[i].type = 'bcc';
  }
  var subject = 'Somebody Wants Your Book!';
  var emailText = util.format(bookInquiryEmailText, bookTitle, bookIsbn, message, fromPerson.name, fromPerson.email);
  var emailHtml = util.format(bookInquiryEmailHtml, bookTitle, bookIsbn, message, fromPerson.name, fromPerson.email);
  sendEmail({ toPeople: toPeople, fromPerson: fromPerson, replyTo: fromPerson.email, subject: subject, html: emailHtml, text: emailText }, callback);
}

module.exports.sendEmail = sendEmail;
module.exports.sendNewEmailConfirmation = sendNewEmailConfirmation;
module.exports.sendPasswordReset = sendPasswordReset;
module.exports.sendBookInquiryEmail = sendBookInquiryEmail;
