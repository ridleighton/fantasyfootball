/**
 * Profile Page
 *
 * User profile and settings
 */

const ProfilePage = {
  state: {
    user: null,
    editing: false
  },

  /**
   * Render the profile page
   */
  async render(container) {
    if (!container) {
      console.error('Container not found');
      return;
    }

    try {
      // Get user profile
      const response = await API.users.getProfile();
      this.state.user = response.data;

      container.innerHTML = `
        <div class="profile-page">
          ${this.renderHeader()}
          ${this.renderProfileForm()}
          ${this.renderPasswordChange()}
        </div>
      `;

      this.attachEventListeners(container);

    } catch (error) {
      console.error('Error loading profile:', error);
      container.innerHTML = `
        <div class="profile-page">
          <div class="error-message card">
            <h2>Error Loading Profile</h2>
            <p>${error.message || 'Failed to load profile'}</p>
          </div>
        </div>
      `;
    }
  },

  /**
   * Render header
   */
  renderHeader() {
    return `
      <div class="profile-header">
        <h1>Profile Settings</h1>
        <p class="profile-subtitle">Manage your account and preferences</p>
      </div>
    `;
  },

  /**
   * Render profile form
   */
  renderProfileForm() {
    return `
      <div class="profile-form card">
        <h2>Personal Information</h2>
        <form id="profile-form">
          <div class="form-group">
            <label class="form-label">Username</label>
            <input type="text" class="form-input" value="${this.state.user.username}" disabled>
            <small class="form-hint">Username cannot be changed</small>
          </div>

          <div class="form-group">
            <label class="form-label" for="display-name">Display Name</label>
            <input type="text" id="display-name" class="form-input"
                   value="${this.state.user.displayName}" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="primary-color">Primary Color</label>
            <div class="color-input-group">
              <input type="color" id="primary-color" class="color-input"
                     value="${this.state.user.primaryColor || '#8AB4F8'}">
              <input type="text" id="primary-color-text" class="form-input"
                     value="${this.state.user.primaryColor || '#8AB4F8'}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="timezone">Timezone</label>
            <select id="timezone" class="form-input">
              <option value="America/New_York" ${this.state.user.timezone === 'America/New_York' ? 'selected' : ''}>Eastern</option>
              <option value="America/Chicago" ${this.state.user.timezone === 'America/Chicago' ? 'selected' : ''}>Central</option>
              <option value="America/Denver" ${this.state.user.timezone === 'America/Denver' ? 'selected' : ''}>Mountain</option>
              <option value="America/Los_Angeles" ${this.state.user.timezone === 'America/Los_Angeles' ? 'selected' : ''}>Pacific</option>
            </select>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    `;
  },

  /**
   * Render password change section
   */
  renderPasswordChange() {
    return `
      <div class="password-change card">
        <h2>Change Password</h2>
        <form id="password-form">
          <div class="form-group">
            <label class="form-label" for="current-password">Current Password</label>
            <input type="password" id="current-password" class="form-input" required>
          </div>

          <div class="form-group">
            <label class="form-label" for="new-password">New Password</label>
            <input type="password" id="new-password" class="form-input" required minlength="8">
          </div>

          <div class="form-group">
            <label class="form-label" for="confirm-password">Confirm New Password</label>
            <input type="password" id="confirm-password" class="form-input" required>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary">
              Update Password
            </button>
          </div>
        </form>
      </div>
    `;
  },

  /**
   * Attach event listeners
   */
  attachEventListeners(container) {
    // Profile form
    const profileForm = container.querySelector('#profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveProfile(container);
      });
    }

    // Color picker sync
    const colorInput = container.querySelector('#primary-color');
    const colorText = container.querySelector('#primary-color-text');
    if (colorInput && colorText) {
      colorInput.addEventListener('input', (e) => {
        colorText.value = e.target.value;
      });
      colorText.addEventListener('input', (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
          colorInput.value = e.target.value;
        }
      });
    }

    // Password form
    const passwordForm = container.querySelector('#password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.changePassword(container);
      });
    }
  },

  /**
   * Save profile
   */
  async saveProfile(container) {
    const displayName = container.querySelector('#display-name').value;
    const primaryColor = container.querySelector('#primary-color').value;
    const timezone = container.querySelector('#timezone').value;

    try {
      UI.showLoading();
      await API.users.updateProfile({
        displayName,
        primaryColor,
        timezone
      });

      // Update current user
      Auth.updateCurrentUser({
        display_name: displayName,
        primary_color: primaryColor,
        timezone
      });

      // Apply colors
      Colors.applyUserColors(primaryColor);

      UI.showToast('Profile updated successfully!', 'success');
      UI.hideLoading();
    } catch (error) {
      console.error('Error saving profile:', error);
      UI.showToast(error.message || 'Failed to save profile', 'error');
      UI.hideLoading();
    }
  },

  /**
   * Change password
   */
  async changePassword(container) {
    const currentPassword = container.querySelector('#current-password').value;
    const newPassword = container.querySelector('#new-password').value;
    const confirmPassword = container.querySelector('#confirm-password').value;

    if (newPassword !== confirmPassword) {
      UI.showToast('Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 8) {
      UI.showToast('Password must be at least 8 characters', 'error');
      return;
    }

    try {
      UI.showLoading();
      await API.auth.changePassword(currentPassword, newPassword);

      // Reset form
      container.querySelector('#password-form').reset();

      UI.showToast('Password changed successfully!', 'success');
      UI.hideLoading();
    } catch (error) {
      console.error('Error changing password:', error);
      UI.showToast(error.message || 'Failed to change password', 'error');
      UI.hideLoading();
    }
  }
};

// Make globally available
window.ProfilePage = ProfilePage;
