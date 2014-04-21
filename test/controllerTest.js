// test the most important controller functions

var util = require('util');
var should = require('should');
var sinon = require('sinon');
var rewire = require('rewire');
var controller = rewire('../server/controller');
var myUtils = require('../server/myUtils');
var emailHelper = rewire('../server/emailHelper');

before(function() {
  sinon.stub(myUtils, 'getDbClient').callsArgWith(
    1,
    // client object
    {
      query: function() {
        if (arguments.length) {
          arguments[arguments.length-1](undefined, {rowCount:0, rows:[]});
        }
      }
    },
    // done function
    function() {
      this.calledDone = true;
    }
  );
  sinon.stub(emailHelper, 'sendNewEmailConfirmation').callsArgWith(1, undefined, 'worked');
  sinon.stub(emailHelper, 'sendPasswordReset').callsArgWith(1, undefined, 'worked');
  sinon.stub(emailHelper, 'sendBookInquiryEmail').callsArgWith(1, undefined, 'worked');
});

after(function() {
  myUtils.getDbClient.restore();
  emailHelper.sendNewEmailConfirmation.restore();
});

describe('controller', function() {
  var req, res;
  beforeEach(function() {
    req = {
      body: {},
      user: {
        email: 'mochastudent@somewhere.edu',
        name: 'Mocha Student'
      }
    };
    res = {
      locals: {
        errors: [],
        warnings: [],
        messages: []
      },
      render: function(template, locals) {
        this.__template = template;
        this.__locals = locals;
        throw 'do not use res.render when testing!'
      }
    }
  });

  describe('#getAccount()', function() {
    it('should render account when there is no request body', function(done) {
      controller._getAccount(req, res, function(res, template, locals) {
        template.should.equal('account');
        res.locals.errors.should.be.empty;
        res.locals.warnings.should.be.empty;
        res.locals.messages.should.be.empty;
        done();
      });
    });

    it('should send new confirmation email', function(done) {
      req.body.resendConfirmationEmail = true;
      controller._getAccount(req, res, function(res, template, locals) {
        res.locals.messages[0].should.equal(util.format('We sent another confirmation email to %s.', req.user.email));
        done();
      });
    });
  });

  describe('#login()', function() {
    it('should keep redirect path', function(done) {
      req.path = '/login/redirect/me/here';
      controller._login(req, res, function(res, template, locals) {
        template.should.equal('login');
        res.locals.destination.should.equal('/redirect/me/here');
        done();
      });
    });
  });

  describe('#join()', function() {
    it('should render join', function(done) {
      controller._join(req, res, function(res, template, locals) {
        template.should.equal('join');
        done();
      });
    });
  });

  describe('#createAccount()', function() {
    it('should not create an account without a name', function(done) {
      controller._createAccount(req, res, function(res, template, locals) {
        res.locals.errors[0].should.equal('Please provide your name');
        template.should.equal('join');
        done();
      });
    });
    it('should not create an account without an email', function(done) {
      req.body.name = req.user.name;
      controller._createAccount(req, res, function(res, template, locals) {
        res.locals.errors[0].should.equal('Please provide an email address');
        template.should.equal('join');
        done();
      });
    });
    it('should not create an account without a password', function(done) {
      req.body.name = req.user.name;
      req.body.email = req.user.email;
      controller._createAccount(req, res, function(res, template, locals) {
        res.locals.errors[0].should.equal('Please use a password with at least 8 charaters');
        template.should.equal('join');
        done();
      });
    });
  });
});
