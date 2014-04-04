var validatorScript = document.createElement('script');
validatorScript.type = 'text/javascript';
validatorScript.src = 'http://bookswap-web.herokuapp.com/javascripts/validator.min.js';
document.getElementsByTagName('head')[0].appendChild(validatorScript);
if (!window.jQuery) {
  var jQScript = document.createElement('script');
  jQScript.type = 'text/javascript';
  jQScript.src = '//code.jquery.com/jquery-1.11.0.min.js';
  document.getElementsByTagName('head')[0].appendChild(jQScript);
}

var isbns = {};
var isbnRegex13 = /[\D]{1}[0-9]{13}[\D]{1}/;
var isbnRegex10 = /[\D]{1}[0-9]{9}[0-9x]{1}[\D]{1}/;

var isbnRegex13_x = /[\D]{1}[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}[\D]{1}/;
var isbnRegex10_x = /[\D]{1}[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9x]{1}[\D]{1}/;

function getIsbns() {
  getIsbn13s();
  getIsbn10s();
  if (Object.keys(isbns).length) {
    if (confirm('Book Swap found some books that we can add to your book swap account\'s book buying list. Ready?')) {
      console.log('go');
    }
  } else {
    alert('Book Swap searched the page but didn\'t find any textbooks. Technically we\'re looking for ISBN numbers and it doesn\'t look like there\'s any on here.');
  }
}

function getIsbn13s() {
  var start = 0;
  var text = document.body.innerHTML;
  var end = text.length;
  while (start < end) {
    var isbnStuff = text.substring(start).match(isbnRegex13_x);
    if (isbnStuff) {
      var isbn = isbnStuff[0].substring(1, isbnStuff[0].length - 1).replace(/-/g,'');
      if (validator.isISBN(isbn) && !isbns[isbn]) {
        isbns[isbn] = isbn;
      }
      start += isbnStuff.index + isbnStuff[0].length;
    } else {
      return;
    }
  }
}

function getIsbn10s() {
  var start = 0;
  var text = document.body.innerHTML;
  var end = text.length;
  while (start < end) {
    var isbnStuff = text.substring(start).match(isbnRegex10_x);
    if (isbnStuff) {
      var isbn = isbnStuff[0].substring(1, isbnStuff[0].length - 1).replace(/-/g,'');
      if (validator.isISBN(isbn) && !isbns[isbn]) {
        isbns[isbn] = isbn;
      }
      start += isbnStuff.index + isbnStuff[0].length;
    } else {
      return;
    }
  }
}

setTimeout(getIsbns, 1000);
