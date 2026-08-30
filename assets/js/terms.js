/* Asendify Realty — Terms & Conditions gate
   Blocks the site behind an "I agree" screen on first visit, and exposes
   a re-openable, non-blocking view via any element with data-open-terms. */

const TERMS_KEY = 'asendify_realty_terms_v1';

const TERMS_HTML = `
  <h2 style="font-size:24px;margin-bottom:4px;">Terms &amp; Fees</h2>
  <p class="mono" style="font-size:12px;color:var(--brass);margin-bottom:22px;">Asendify Realty &middot; Pune &middot; please read before proceeding</p>

  <h3 style="font-size:16px;margin:20px 0 8px;">1. Brokerage fees</h3>
  <ul>
    <li><strong>Renting a flat:</strong> brokerage is <strong>3 months&rsquo; rent, charged to both the landlord and the tenant</strong> (3 months' rent each), payable in full once the rental agreement is signed.</li>
    <li><strong>Buying / selling a flat:</strong> brokerage is <strong>2% of the agreed sale value, charged to both the buyer and the seller</strong> (2% each), payable on registration of the sale deed.</li>
    <li>Brokerage is owed to Asendify Realty regardless of which side (tenant/owner or buyer/seller) initiated contact, once we have facilitated the deal.</li>
    <li><strong>Why 3 months for a rental:</strong> this covers full legal and physical protection provided by Asendify Realty throughout the transaction — document and title verification, ownership and tenancy checks, in-person property and background verification, and hands-on coordination at every stage until the agreement is signed and possession is handed over. This is above the informal one-month norm some local brokers charge for a simple introduction only, and reflects the added diligence and accountability we take on for both sides of the deal.</li>
  </ul>

  <h3 style="font-size:16px;margin:20px 0 8px;">2. Service fee</h3>
  <p>A <strong>45% service fee</strong> applies on top of every payment made to Asendify Realty under these terms — brokerage, token/booking amounts, and any documentation charges we collect. This is billed alongside the underlying fee and is due at the same time.</p>

  <h3 style="font-size:16px;margin:20px 0 8px;">3. Token / booking amount</h3>
  <ul>
    <li>A token amount may be requested to hold a shortlisted property while paperwork is finalised. This is separate from brokerage.</li>
    <li>The token amount is <strong>non-refundable under any circumstances</strong> once paid — this applies regardless of who withdraws from the deal, why, or at what stage.</li>
  </ul>

  <h3 style="font-size:16px;margin:20px 0 8px;">4. Security deposit</h3>
  <ul>
    <li>Refundable security deposits (typical in Pune: 1&ndash;3 months&rsquo; rent for tenants) are paid <strong>directly to the property owner</strong>, not to Asendify Realty.</li>
    <li>We are not a party to the deposit and do not hold, guarantee, or adjudicate deposit refunds at the end of a tenancy.</li>
  </ul>

  <h3 style="font-size:16px;margin:20px 0 8px;">5. Documentation &amp; agreement charges</h3>
  <ul>
    <li>Rental agreement drafting, e-stamping, and registration (where applicable) are charged separately at actual government/vendor cost, split as agreed between tenant and owner.</li>
    <li>For resale, stamp duty, registration charges, and any legal/title-verification fees are payable by the buyer as per prevailing government rates and are not part of our brokerage.</li>
  </ul>

  <h3 style="font-size:16px;margin:20px 0 8px;">6. Cancellation &amp; refund policy</h3>
  <ul>
    <li>Once the rental agreement or sale deed is signed, brokerage already paid is <strong>non-refundable</strong>.</li>
    <li>If a deal falls through before any agreement is signed, brokerage collected (if any) is refunded in full; the token amount is not — see Section 3.</li>
  </ul>

  <h3 style="font-size:16px;margin:20px 0 8px;">7. No hidden fees</h3>
  <p>Every charge that applies to your specific deal is confirmed with you in writing (over WhatsApp or email) before you make any payment. Asendify Realty does not add fees beyond what has been disclosed at the time of confirming a deal.</p>

  <h3 style="font-size:16px;margin:20px 0 8px;">8. Listing accuracy</h3>
  <p>We update listings regularly, but price, availability, and terms are subject to change by the owner and are confirmed only after direct verification with our team. Photos are representative and may be replaced with current photos once a listing is finalised.</p>

  <h3 style="font-size:16px;margin:20px 0 8px;">9. Contact &amp; disputes</h3>
  <p>All enquiries are handled over WhatsApp/email with Asendify Realty. Any disputes are subject to resolution in Pune, Maharashtra.</p>
`;

function injectTermsStyles() {
  if (document.getElementById('terms-gate-styles')) return;
  const style = document.createElement('style');
  style.id = 'terms-gate-styles';
  style.textContent = `
    .terms-overlay{
      position:fixed; inset:0; z-index:1000;
      background:rgba(28,27,25,0.72);
      display:flex; align-items:center; justify-content:center; padding:24px;
    }
    .terms-modal{
      background:var(--paper); border:1.5px solid var(--ink); border-radius:10px;
      max-width:640px; width:100%; max-height:85vh; display:flex; flex-direction:column;
      box-shadow:0 24px 60px -20px rgba(0,0,0,0.5);
    }
    .terms-modal .terms-body{ overflow-y:auto; padding:28px 30px 10px; }
    .terms-modal .terms-body ul{ margin:8px 0 14px; padding-left:20px; }
    .terms-modal .terms-body li{ margin-bottom:6px; font-size:14.5px; color:var(--stone); }
    .terms-modal .terms-body p{ font-size:14.5px; color:var(--stone); }
    .terms-modal .terms-footer{
      border-top:1px solid var(--line); padding:18px 30px 24px; background:var(--paper-dim);
      border-radius:0 0 10px 10px;
    }
    .terms-check{ display:flex; align-items:flex-start; gap:10px; font-size:13.5px; margin-bottom:16px; color:var(--ink); }
    .terms-check input{ margin-top:3px; }
    .terms-actions{ display:flex; gap:12px; }
    .terms-actions .btn-primary:disabled{ opacity:0.4; cursor:not-allowed; }
    body.terms-locked{ overflow:hidden; }
  `;
  document.head.appendChild(style);
}

function buildModal({ blocking }) {
  const overlay = document.createElement('div');
  overlay.className = 'terms-overlay';
  overlay.innerHTML = `
    <div class="terms-modal">
      <div class="terms-body">${TERMS_HTML}</div>
      <div class="terms-footer">
        ${blocking ? `
          <label class="terms-check">
            <input type="checkbox" id="terms-checkbox">
            I have read and agree to Asendify Realty's brokerage fees, deposit, and cancellation terms above.
          </label>
          <div class="terms-actions">
            <button class="btn btn-primary" id="terms-agree" disabled>I Agree — Continue to site</button>
          </div>
        ` : `
          <div class="terms-actions">
            <button class="btn btn-outline" id="terms-close">Close</button>
          </div>
        `}
      </div>
    </div>
  `;
  return overlay;
}

function openTerms({ blocking }) {
  injectTermsStyles();
  const overlay = buildModal({ blocking });
  document.body.appendChild(overlay);
  if (blocking) document.body.classList.add('terms-locked');

  if (blocking) {
    const checkbox = overlay.querySelector('#terms-checkbox');
    const agreeBtn = overlay.querySelector('#terms-agree');
    checkbox.addEventListener('change', () => { agreeBtn.disabled = !checkbox.checked; });
    agreeBtn.addEventListener('click', () => {
      localStorage.setItem(TERMS_KEY, new Date().toISOString());
      document.body.classList.remove('terms-locked');
      overlay.remove();
    });
  } else {
    overlay.querySelector('#terms-close').addEventListener('click', () => overlay.remove());
  }
}

function initTermsGate() {
  const accepted = localStorage.getItem(TERMS_KEY);
  if (!accepted) openTerms({ blocking: true });

  document.querySelectorAll('[data-open-terms]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openTerms({ blocking: false });
    });
  });
}

document.addEventListener('DOMContentLoaded', initTermsGate);
