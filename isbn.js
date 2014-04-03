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

    // console.log('stuff', isbn);
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
