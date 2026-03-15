// Mobile nav toggle
const hamburger = document.querySelector('.nav__hamburger');
const mobileNav = document.querySelector('.nav__mobile');
if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => {
    mobileNav.classList.toggle('open');
  });
}

// WhatsApp float tooltip
const waFloat = document.querySelector('.wa-float');
if (waFloat) {
  waFloat.addEventListener('click', () => {
    window.open('https://wa.me/8618268661068', '_blank');
  });
}

// Smooth anchor scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// Contact form → Supabase Edge Function (via rfq.js)
const form = document.querySelector('.js-contact-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const successHtml = '<div style="text-align:center;padding:40px 0"><h3 style="color:#A52030;margin-bottom:12px">Message Sent!</h3><p>We\'ll reply within 24 hours. Or reach us directly on WhatsApp: +86 182 6866 1068</p></div>';
    const successDiv = document.createElement('div');
    successDiv.innerHTML = successHtml;
    successDiv.style.display = 'none';
    form.parentNode.insertBefore(successDiv, form.nextSibling);
    await window.submitRFQ(form, successDiv);
  });
}
