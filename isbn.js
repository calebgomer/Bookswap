var isbns = {};
var isbnRegex13 = /[\D^-]{1}[0-9]{13}[\D^-]{1}/;
var isbnRegex10 = /[\D^-]{1}[0-9]{10}[\D^-]{1}/;

var isbnRegex13_x = /[\D^-]{1}[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}[\D^-]{1}/;
var isbnRegex10_x = /[\D^-]{1}[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}[\D^-]{1}/;

function getIsbns() {
  getIsbn13s();
  getIsbn10s();
}

function getIsbn13s() {
  var start = 0;
  var text = document.body.innerHTML;
  var end = text.length;
  while (start < end) {
    var textToCheck = text.substring(start);
    var isbnStart = textToCheck.search(isbnRegex13);
    // var isbnStuff = textToCheck.match(isbnRegex13);
    // var isbn = isbnStuff[0].substring(1, isbnStuff[0].length - 1);

    console.log('stuff', isbn);
    if (isbnStart === -1) {
      console.log('done');
      console.log(isbns);
      return;
    }
    var isbn = textToCheck.substring(isbnStart + 1, isbnStart + 14);
    isbns[isbn] = isbn;
    start += isbnStart + 14;
  }
}

function getIsbn10s() {
  var start = 0;
  var text = document.body.innerHTML;
  var end = text.length;
  while (start < end) {
    var textToCheck = text.substring(start);
    // var isbnStart = textToCheck.search(isbnRegex10);
    var isbnStart = textToCheck.match(isbnRegex10);
    console.log('stuff', isbnStart);
    if (isbnStart === -1) {
      console.log('done');
      console.log(isbns);
      return;
    }
    var isbn = textToCheck.substring(isbnStart + 1, isbnStart + 11);
    isbns[isbn] = isbn;
    start += isbnStart + 11;
  }
}
