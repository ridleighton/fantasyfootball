/**
 * Navbar Component
 *
 * Top navigation bar (desktop) and bottom navigation (mobile)
 */

const Navbar = {
  state: {
    activePage: 'home'
  },

  /**
   * Initialize the navbar
   */
  init() {
    const navContainer = document.getElementById('navigation');
    if (!navContainer) return;

    const user = Auth.currentUser;
    const isAdmin = Auth.isAdmin();

    navContainer.innerHTML = `
      <!-- Desktop Navbar -->
      <nav class="navbar">
        <div class="navbar-content">
          <div class="navbar-logo">
            🏈 NFL Pick'ems
          </div>
          <div class="navbar-links">
            <a href="#" class="navbar-link" data-page="home">Home</a>
            <a href="#picks" class="navbar-link" data-page="picks">Picks</a>
            <a href="#history" class="navbar-link" data-page="history">History</a>
            <a href="#comparison" class="navbar-link" data-page="comparison">Compare</a>
            ${isAdmin ? '<a href="#admin" class="navbar-link" data-page="admin">Admin</a>' : ''}
          </div>
          <div class="navbar-actions">
            <a href="#profile" class="navbar-link">
              <div class="user-avatar-small" style="${Colors.getAvatarStyle(user.primary_color)}">
                ${user.display_name.charAt(0).toUpperCase()}
              </div>
            </a>
            <button class="btn btn-text" id="logout-btn">Logout</button>
          </div>
        </div>
      </nav>

      <!-- Mobile Bottom Nav -->
      <nav class="bottom-nav">
        <a href="#" class="bottom-nav-item" data-page="home">
          <span class="bottom-nav-icon">🏠</span>
          <span class="bottom-nav-label">Home</span>
        </a>
        <a href="#picks" class="bottom-nav-item" data-page="picks">
          <span class="bottom-nav-icon">✅</span>
          <span class="bottom-nav-label">Picks</span>
        </a>
        <a href="#history" class="bottom-nav-item" data-page="history">
          <span class="bottom-nav-icon">📊</span>
          <span class="bottom-nav-label">History</span>
        </a>
        <a href="#comparison" class="bottom-nav-item" data-page="comparison">
          <span class="bottom-nav-icon">🔍</span>
          <span class="bottom-nav-label">Compare</span>
        </a>
        ${isAdmin ? `
          <a href="#admin" class="bottom-nav-item" data-page="admin">
            <span class="bottom-nav-icon">⚙️</span>
            <span class="bottom-nav-label">Admin</span>
          </a>
        ` : `
          <a href="#profile" class="bottom-nav-item" data-page="profile">
            <span class="bottom-nav-icon">👤</span>
            <span class="bottom-nav-label">Profile</span>
          </a>
        `}
      </nav>
    `;

    // Attach event listeners
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Auth.logout();
        window.location.href = '/';
      });
    }

    // Set active page
    this.setActive(this.state.activePage);
  },

  /**
   * Set active page indicator
   */
  setActive(pageName) {
    this.state.activePage = pageName;

    // Update navbar links
    document.querySelectorAll('.navbar-link').forEach(link => {
      if (link.dataset.page === pageName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update bottom nav links
    document.querySelectorAll('.bottom-nav-item').forEach(link => {
      if (link.dataset.page === pageName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
};

// Make globally available
window.Navbar = Navbar;
