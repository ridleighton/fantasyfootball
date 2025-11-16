/**
 * Modal Component
 *
 * Reusable modal dialog component
 */

const Modal = {
  /**
   * Create and show a modal
   * @param {Object} options - Modal configuration
   * @param {String} options.title - Modal title
   * @param {String} options.content - Modal HTML content
   * @param {Array} options.buttons - Array of button objects
   * @param {Boolean} options.closeable - Whether modal can be closed (default: true)
   * @param {Function} options.onClose - Callback when modal closes
   */
  create(options = {}) {
    const {
      title = '',
      content = '',
      buttons = [],
      closeable = true,
      onClose = null
    } = options;

    const container = document.getElementById('modal-container');
    if (!container) {
      console.error('Modal container not found');
      return;
    }

    // Generate button HTML
    const buttonHTML = buttons.map((btn, index) => `
      <button class="btn ${btn.className || 'btn-primary'}"
              data-modal-btn="${index}">
        ${btn.text}
      </button>
    `).join('');

    // Create modal HTML
    container.innerHTML = `
      <div class="modal-overlay" data-closeable="${closeable}">
        <div class="modal">
          <div class="modal-header">
            <h2 class="modal-title">${title}</h2>
            ${closeable ? '<button class="modal-close" aria-label="Close">&times;</button>' : ''}
          </div>
          <div class="modal-content">
            ${content}
          </div>
          ${buttons.length > 0 ? `
            <div class="modal-footer">
              ${buttonHTML}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Show modal with animation
    setTimeout(() => {
      container.querySelector('.modal-overlay').classList.add('active');
    }, 10);

    // Attach event listeners
    this.attachEventListeners(container, buttons, closeable, onClose);

    return container;
  },

  /**
   * Attach event listeners to modal
   */
  attachEventListeners(container, buttons, closeable, onClose) {
    // Close button
    if (closeable) {
      const closeBtn = container.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          this.close();
          if (onClose) onClose();
        });
      }

      // Click outside to close
      const overlay = container.querySelector('.modal-overlay');
      if (overlay) {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            this.close();
            if (onClose) onClose();
          }
        });
      }

      // ESC key to close
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          this.close();
          if (onClose) onClose();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    }

    // Button clicks
    const modalButtons = container.querySelectorAll('[data-modal-btn]');
    modalButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const index = parseInt(btn.dataset.modalBtn);
        const buttonConfig = buttons[index];

        if (buttonConfig.onClick) {
          const result = await buttonConfig.onClick();
          // If onClick returns false, don't close modal
          if (result !== false) {
            this.close();
          }
        } else {
          this.close();
        }
      });
    });
  },

  /**
   * Close the modal
   */
  close() {
    const container = document.getElementById('modal-container');
    if (!container) return;

    const overlay = container.querySelector('.modal-overlay');
    if (overlay) {
      overlay.classList.remove('active');

      // Remove from DOM after animation
      setTimeout(() => {
        container.innerHTML = '';
      }, 300);
    }
  },

  /**
   * Show a simple alert modal
   */
  alert(message, title = 'Alert') {
    return this.create({
      title,
      content: `<p>${message}</p>`,
      buttons: [
        {
          text: 'OK',
          className: 'btn-primary'
        }
      ]
    });
  },

  /**
   * Show a confirmation modal
   */
  confirm(message, title = 'Confirm', onConfirm, onCancel) {
    return this.create({
      title,
      content: `<p>${message}</p>`,
      buttons: [
        {
          text: 'Cancel',
          className: 'btn-text',
          onClick: () => {
            if (onCancel) onCancel();
          }
        },
        {
          text: 'Confirm',
          className: 'btn-primary',
          onClick: () => {
            if (onConfirm) onConfirm();
          }
        }
      ]
    });
  }
};

// Make globally available
window.Modal = Modal;
