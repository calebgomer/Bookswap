var https = require('https');
var http = require('http');
var _ = require("underscore");
var crypto = require('crypto');
var xml2jsParser = require('xml2js').Parser;
var xmlParser = new xml2jsParser();
var AWS_Access_Key_ID = process.env.AWS_ACCESS_KEY_ID
var AWS_Secret_Access_Key = process.env.AWS_SECRET_ACCESS_KEY;
var AWS_Associate_Tag = process.env.AWS_ASSOCIATE_TAG;
var GOOGLE_BOOKS_API_KEY = process.env.GOOGLE_BOOKS_API_KEY;
var util = require('util');

var makeGoogleIsbnQuery = function(isbn, callback) {
  makeGoogleQuery(true, isbn, callback);
};

var makeGoogleBookQuery = function(searchText, callback) {
  makeGoogleQuery(false, searchText, callback);
};

var makeGoogleQuery = function(searchIsbn, searchText, callback) {
  var gQuery = '/books/v1/volumes?q=%s&maxResults=%s&printType=books&country=us&key=%s&fields=items(volumeInfo/title,volumeInfo/subtitle,volumeInfo/authors)';
  var query;
  var maxResults;

  if(searchIsbn) {
    query = 'isbn:' + searchText.toString().replace(/ +/g, '+').trim();
    maxResults = 1;
  } else {
    query = searchText.replace(/ +/g, '+').trim();
    maxResults = 40;
  }

  var gQuery = util.format(gQuery, query, maxResults, GOOGLE_BOOKS_API_KEY);
  var gOptions = {
    host: 'www.googleapis.com',
    path: gQuery
  };

  https.get(gOptions,function(response) {
    var str = '';
    response.on('data',function(chunck) {
      str += chunck;
    });
    response.on('end', function() {
      var resJson;
      var resErr;
      try {
        resJson = JSON.parse(str);
      } catch(err) {
        resErr = err;
      }
      callback(resErr, resJson);
    });
  });
};

var makeAmazonQuery = function(isbn, callback) {
  var aQuery = '';
  aQuery += 'AWSAccessKeyId='+AWS_Access_Key_ID;
  aQuery += '&AssociateTag='+AWS_Associate_Tag;
  aQuery += '&Condition=All';
  aQuery += '&IdType=ISBN';
  aQuery += '&ItemId='+encodeURIComponent(isbn);
  aQuery += '&Operation=ItemLookup';
  aQuery += '&ResponseGroup='+encodeURIComponent('Images,OfferSummary,Offers');
  aQuery += '&SearchIndex=Books';
  aQuery += '&Service=AWSECommerceService';
  var timeString = (new Date()).toJSON();
  timeString = timeString.substring(0,timeString.length-5) + 'Z';
  timeString = encodeURIComponent(timeString);
  aQuery += '&Timestamp='+timeString;
  aQuery += '&Version=2009-01-06';

  var toSign = 'GET\nwebservices.amazon.com\n/onca/xml\n' + aQuery;

  var hmac = crypto.createHmac('SHA256', AWS_Secret_Access_Key);
  hmac.update(toSign);
  var signature = hmac.digest('base64');
  signature = encodeURIComponent(signature);

  var signedRequest = '/onca/xml?' + aQuery + '&Signature=' + signature;

  var request = {
    host: 'webservices.amazon.com',
    path: signedRequest
  };

  http.get(request,function(response) {
    var str = '';
    response.on('data',function(chunck) {
      str += chunck;
    });
    response.on('end', function() {
      xmlParser.parseString(str, function(err,result) {
        callback(undefined, result);
      });
    });
  });
};

module.exports.googleBookSearch = makeGoogleBookQuery;
module.exports.googleIsbnSearch = makeGoogleIsbnQuery;
module.exports.amazonIsbnSearch = makeAmazonQuery;
