var should = require('should');
var sinon = require('sinon');
var rewire = require('rewire');
var emailHelper = rewire('../server/emailHelper');

describe('emailHelper', function() {
  before(function() {
    // keep emails from sending, and provide a way to make sure emails would be sent correctly
    emailHelper.__set__('actuallySendEmail', function(send, callback) {
      callback(undefined, send);
    });
  });

  describe('#sendEmail', function() {
    it('should not send without arguments', function(done) {
      emailHelper.sendEmail(
        undefined,
        function(err, send) {
          err.should.equal('Please provide arguments');
          should.not.exist(send);
          done();
        }
      );
    });
    it('should not send without toPeople', function(done) {
      emailHelper.sendEmail(
        {},
        function(err, send) {
          err.should.equal('Please provide toPeople');
          should.not.exist(send);
          done();
        }
      );
    });
    it('should not send without email html', function(done) {
      emailHelper.sendEmail(
        {
          toPeople:[{ email:'mochastudent@somewhere.edu', name:'Mocha Student' }]
        },
        function(err, send) {
          err.should.equal('Please provide email html');
          should.not.exist(send);
          done();
        }
      );
    });
    it('should not send without email text', function(done) {
      emailHelper.sendEmail(
        {
          toPeople:[{ email:'mochastudent@somewhere.edu', name:'Mocha Student' }],
          html:'html'
        },
        function(err, send) {
          err.should.equal('Please provide email text');
          should.not.exist(send);
          done();
        }
      );
    });
    it('should not send without a subject', function(done) {
      emailHelper.sendEmail(
        {
          toPeople:[{ email:'mochastudent@somewhere.edu', name:'Mocha Student' }],
          html:'html',
          text:'text'
        },
        function(err, send) {
          err.should.equal('Please provide a subject');
          should.not.exist(send);
          done();
        }
      );
    });
    it('should send an email', function(done) {
      emailHelper.sendEmail(
        {
          toPeople:[{ email:'mochastudent@somewhere.edu', name:'Mocha Student' }],
          html:'html',
          text:'text',
          subject:'subject'
        },
        function(err, send) {
          should.not.exist(err);
          should.exist(send);
          done();
        }
      );
    });
  });

  describe('#sendNewEmailConfirmation()', function() {
    it('should not send email without recipient', function(done) {
      emailHelper.sendNewEmailConfirmation(undefined, function(err, send) {
        err.should.equal('Please provide an email and name');
        done();
      });
    });
    it('should not send email without confirmation code', function(done) {
      emailHelper.sendNewEmailConfirmation({email:'mochastudent@somewhere.edu', name:'Mocha Student'}, function(err, send) {
        err.should.equal('Please provide a confirmation code');
        done();
      });
    });
    it('should send email with to one person', function(done) {
      emailHelper.sendNewEmailConfirmation({email:'mochastudent@somewhere.edu', name:'Mocha Student', confirmationId:'confirm'}, function(err, send) {
        should.not.exist(err);
        send.message.subject.should.equal('Please Confirm Your Email');
        send.message.to.length.should.equal(1);
        send.message.to[0].email.should.equal('mochastudent@somewhere.edu');
        done();
      });
    });
  });

  describe('#sendPasswordReset()', function() {
    it('should not send email without recipient', function(done) {
      emailHelper.sendPasswordReset(undefined, function(err, send) {
        err.should.equal('Please provide an email and name');
        done();
      });
    });
    it('should not send email without reset token', function(done) {
      emailHelper.sendPasswordReset({email:'mochastudent@somewhere.edu', name:'Mocha Student'}, function(err, send) {
        err.should.equal('Please provide a reset token');
        done();
      });
    });
    it('should send an email to one person', function(done) {
      emailHelper.sendPasswordReset({email:'mochastudent@somewhere.edu', name:'Mocha Student', resetToken:'reset'}, function(err, send) {
        should.not.exist(err);
        send.message.subject.should.equal('Reset Your Book Swap Password');
        send.message.to.length.should.equal(1);
        send.message.to[0].email.should.equal('mochastudent@somewhere.edu');
        done();
      });
    });
  });

  describe('#sendBookInquiryEmail()', function() {
    it('should not send email without recipients', function(done) {
      emailHelper.sendBookInquiryEmail({}, function(err, send) {
        err.should.equal('Please provide recipients');
        done();
      });
    });
    it('should not send email without sender', function(done) {
      emailHelper.sendBookInquiryEmail(
        {
          toPeople:[{ email: 'mochastudent@somewhere.edu', name: 'Mocha Student' }]
        },
        function(err, send) {
          err.should.equal('Please provide a sender');
          done();
        }
      );
    });
    it('should not send email without an isbn', function(done) {
      emailHelper.sendBookInquiryEmail(
        {
          toPeople:[{ email: 'mochastudent@somewhere.edu', name: 'Mocha Student' }],
          fromPerson: { email: 'mochastudent@somewhere.edu', name: 'Mocha Student' }
        },
        function(err, send) {
          err.should.equal('Please provide an isbn');
          done();
        }
      );
    });
    it('should send email to two recipients from one sender', function(done) {
      emailHelper.sendBookInquiryEmail(
        {
          toPeople:[
            { email: 'mochastudentA@somewhere.edu', name: 'Mocha Student A' },
            { email: 'mochastudentB@somewhere.edu', name: 'Mocha Student B' }
          ],
          fromPerson: { email: 'mochastudent@somewhere.edu', name: 'Mocha Student' },
          isbn: 'isbn'
        },
        function(err, send) {
          should.not.exist(err);
          send.message.to.length.should.equal(2);
          send.message.from_email.should.equal('mochastudent@somewhere.edu');
          send.message.subject.should.equal('Somebody Wants Your Book!');
          done();
        }
      );
    });
  });
});
