// MouldNova RFQ shared form handler
// Submits to Web3Forms → email to zhangyuanbo123@163.com, CC zhangyuanbo123@gmail.com

const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const WEB3FORMS_KEY = 'b8384c65-d5fe-4eb2-bdd7-2b407d18773b';

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
    btn.textContent = 'Sending\u2026';
    btn.disabled = true;
  }

  try {
    // Collect form fields (skip file input — large CAD files go via WhatsApp)
    const fd = new FormData(form);
    const data = {};
    fd.forEach((value, key) => {
      if (key === 'file') return; // skip file upload
      data[key] = value;
    });

    const res = await fetch(WEB3FORMS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: 'New Inquiry from ' + (data.name || 'Website Visitor') + ' \u2014 MouldNova',
        from_name: 'MouldNova Website',
        cc: 'zhangyuanbo123@gmail.com',
        replyto: data.email || '',
        ...data,
        page_url: window.location.href,
      }),
    });

    const result = await res.json();

    if (result.success) {
      form.style.display = 'none';
      if (successEl) successEl.style.display = 'block';
    } else {
      throw new Error(result.message || 'Submission failed');
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
