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
var booksData;
var async = require('async');
var mongo = require('mongodb');
mongo.Db.connect(process.env.MONGOHQ_URL, function(err, db) {
  db.collection('books', function(err, booksCollection) {
    booksData = booksCollection;
  });
});

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

function getBookInfo(isbn, callback) {
  booksData.find({'isbn':isbn}).toArray(function(err, items) {
    if (items.length) {
      return callback(undefined, items[0]);
    }
    async.parallel([
      function(callback) {
        makeGoogleIsbnQuery(isbn, callback);
      }, function(callback) {
        makeAmazonQuery(isbn, callback);
      }], function(err, results) {
        if (err) {
          return callback(err);
        }
        var book = {};
        book.isbn = isbn;
        try {
          book.title = results[0].items[0].volumeInfo.title;
        } catch (err) {
          book.title = '(No Title Found)';
        }
        try {
          book.subtitle = results[0].items[0].volumeInfo.subtitle;
        } catch (err) {
          book.subtitle = '';
        }
        try {
          book.authors = results[0].items[0].volumeInfo.authors.join(', ');
        } catch (err) {
          book.authors = ['(No Authors Found)'];
        }
        try {
          book.image = results[1].ItemLookupResponse.Items[0].Item[0].MediumImage[0].URL[0];
        } catch (err) {
          book.image = undefined;
        }
        try {
          book.lowestNewPrice = results[1].ItemLookupResponse.Items[0].Item[0].OfferSummary[0].LowestNewPrice[0].FormattedPrice[0];
        } catch (err) {
        }
        try {
          book.lowestUsedPrice = results[1].ItemLookupResponse.Items[0].Item[0].OfferSummary[0].LowestUsedPrice[0].FormattedPrice[0];
        } catch (err) {
        }
        try {
          book.offerPage = results[1].ItemLookupResponse.Items[0].Item[0].Offers[0].MoreOffersUrl[0];
        } catch (err) {
        }
        booksData.insert(book, console.log);
        callback(undefined, book);
    });
  });
}

module.exports.googleBookSearch = makeGoogleBookQuery;
module.exports.googleIsbnSearch = makeGoogleIsbnQuery;
module.exports.amazonIsbnSearch = makeAmazonQuery;
module.exports.getBookInfo = getBookInfo;
