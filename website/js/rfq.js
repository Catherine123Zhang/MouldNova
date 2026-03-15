// MouldNova RFQ shared form handler
// All LP pages and contact.html use this to submit to the Supabase Edge Function.

const RFQ_ENDPOINT = 'https://eqsxfvzwvfqyufwsvpua.supabase.co/functions/v1/submit-rfq';

/**
 * submitRFQ(form, successEl)
 *
 * @param {HTMLFormElement} form      - The form element to submit
 * @param {HTMLElement|null} successEl - Element to show on success (form is hidden)
 */
window.submitRFQ = async function submitRFQ(form, successEl) {
  const btn = form.querySelector('[type="submit"]');
  const originalText = btn ? btn.textContent : '';

  if (btn) {
    btn.textContent = 'Sending…';
    btn.disabled = true;
  }

  try {
    const res = await fetch(RFQ_ENDPOINT, {
      method: 'POST',
      body: new FormData(form),
    });

    if (res.ok) {
      form.style.display = 'none';
      if (successEl) successEl.style.display = 'block';
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err) {
    console.error('RFQ submission error:', err);
    if (btn) {
      btn.textContent = originalText;
      btn.disabled = false;
    }
    alert('Something went wrong. Please contact us on WhatsApp: +86 182 6866 1068');
  }
};
