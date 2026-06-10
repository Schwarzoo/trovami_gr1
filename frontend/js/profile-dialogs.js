/**
   * Shows a reusable confirmation modal and resolves with the user's choice.
 * @param {Object} options - Confirmation dialog options.
 * @param {string} options.title - Confirmation dialog title.
 * @param {string} options.message - Confirmation dialog message.
 * @param {string} [options.confirmLabel='Conferma'] - Label for the confirmation button.
 * @param {boolean} [options.danger=true] - Whether to style the action as destructive.
 * @returns {Promise<boolean>} Promise resolving to true when the user confirms.
 */
function showProfileConfirm({ title, message, confirmLabel = 'Conferma', danger = true }) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('profile-confirm-overlay');
    const titleEl = document.getElementById('profile-confirm-title');
    const messageEl = document.getElementById('profile-confirm-message');
    const okButton = document.getElementById('profile-confirm-ok');
    const cancelButton = document.getElementById('profile-confirm-cancel');
    const closeButton = document.getElementById('profile-confirm-close');

    if (!overlay || !titleEl || !messageEl || !okButton || !cancelButton || !closeButton) {
      showSiteConfirm(message, { title, confirmLabel }).then(resolve);
      return;
    }

    /**
     * Hides the confirmation dialog and removes temporary event listeners.
     * @returns {void}
     */
    const cleanup = () => {
      overlay.style.display = 'none';
      overlay.removeEventListener('click', onOverlayClick);
      okButton.removeEventListener('click', onConfirm);
      cancelButton.removeEventListener('click', onCancel);
      closeButton.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onEscape);
    };

    /**
     * Resolves the confirmation dialog as accepted.
     * @returns {void}
     */
    const onConfirm = () => {
      cleanup();
      resolve(true);
    };

    /**
     * Resolves the confirmation dialog as cancelled.
     * @returns {void}
     */
    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    /**
     * Cancels the confirmation when the user clicks outside the dialog.
     * @param {Event} event - Browser event object.
     * @returns {void}
     */
    const onOverlayClick = (event) => {
      if (event.target === overlay) onCancel();
    };

    /**
     * Cancels the confirmation when Escape is pressed.
     * @param {Event} event - Browser event object.
     * @returns {void}
     */
    const onEscape = (event) => {
      if (event.key === 'Escape') onCancel();
    };

    titleEl.textContent = title || 'Conferma azione';
    messageEl.textContent = message || '';
    okButton.textContent = confirmLabel;
    okButton.classList.toggle('btn--danger', danger);
    okButton.classList.toggle('btn--primary', !danger);
    overlay.style.display = 'flex';
    overlay.addEventListener('click', onOverlayClick);
    okButton.addEventListener('click', onConfirm);
    cancelButton.addEventListener('click', onCancel);
    closeButton.addEventListener('click', onCancel);
    document.addEventListener('keydown', onEscape);
  });
}

/**
 * Initializes the authenticated profile page after the DOM is ready.
 * @returns {Promise<void>} Promise resolving when the profile UI and event handlers are initialized.
 */
