var validatorScript = document.createElement('script');
validatorScript.type = 'text/javascript';
validatorScript.src = 'http://bookswap-web.herokuapp.com/javascripts/validator.min.js';
document.getElementsByTagName('head')[0].appendChild(validatorScript);

var isbns = {};
var isbnRegex13 = /[\D]{1}[0-9]{13}[\D]{1}/;
var isbnRegex10 = /[\D]{1}[0-9]{9}[0-9x]{1}[\D]{1}/;

var isbnRegex13_x = /[\D]{1}[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}[\D]{1}/;
var isbnRegex10_x = /[\D]{1}[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9]{1}-?[0-9x]{1}[\D]{1}/;

function getIsbns() {
  getIsbn13s();
  getIsbn10s();
  console.log(isbns);
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

/*
<div class="modal">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>
        <h4 class="modal-title">Book Swap Textbook Import</h4>
      </div>
      <div class="modal-body">
        <h4>We'll get more information like titles, authors, images, etc. when we get back to Book Swap.</h4>
        <ul>
          <li>9780077514488</li>
          <li>9781429246606</li>
          <li>9780471295051</li>
          <li>9780895827487</li>
        </ul>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary">Import Into Book Swap</button>
      </div>
    </div>
  </div>
</div>
*/
