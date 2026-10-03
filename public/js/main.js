document.addEventListener('submit', (e) => {
  const msg = e.target.dataset.confirm;
  if (msg && !confirm(msg)) e.preventDefault();
});
document.addEventListener('change', (e) => {
  if (e.target.matches('[data-autosubmit]')) e.target.form.submit();
});
