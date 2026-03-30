document.addEventListener('DOMContentLoaded', function() {
  const btn = document.querySelector('.back-button');
  if (btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      if (document.referrer) {
        history.back();
      } else {
        window.location.href = 'index.html';
      }
    });
  }
});