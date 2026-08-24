/**
 * Non-module loader for pending-paid.js
 * Use this in HTML pages with regular <script> tags.
 * ES module pages (runner.js, embed-runner.js) import directly from pending-paid.js.
 */
import {
  extractThumb,
  saveSnapshot,
  renderPendingPaidHTML,
  renderPendingPaidInto,
  fetchBalance,
  isInsufficient,
  firePricingModal,
  checkAuthOrRedirect,
  clearOutputStates,
  showAgreementModal,
} from './pending-paid.js';

window.PendingPaid = {
  extractThumb,
  saveSnapshot,
  renderPendingPaidHTML,
  renderPendingPaidInto,
  fetchBalance,
  isInsufficient,
  firePricingModal,
  checkAuthOrRedirect,
  clearOutputStates,
  showAgreementModal,
};
