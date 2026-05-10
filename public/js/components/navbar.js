/**
 * Navbar — down bad redesign
 * Desktop sticky top bar + mobile floating tab bar
 */

const Navbar = {
  state: {
    activePage: 'home',
  },

  init() {
    const navContainer = document.getElementById('navigation');
    if (!navContainer) return;

    const user = Auth.currentUser;
    const isAdmin = Auth.isAdmin();
    const displayName = user.displayName || user.display_name || 'you';
    const initial = displayName.charAt(0).toUpperCase();

    const links = [
      { id: 'home',          label: 'Home',       href: '#' },
      { id: 'picks',         label: "Pick'ems",   href: '#picks' },
      { id: 'compare-picks', label: 'Compare',    href: '#compare-picks' },
    ];

    if (isAdmin) {
      links.push({ id: 'admin', label: 'Admin', href: '#admin' });
    }

    const navLinks = links.map(l => `
      <a class="db-nav-link" data-page="${l.id}" href="${l.href}">${l.label}</a>
    `).join('');

    const mobileTabIcons = {
      home:          `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
      picks:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>`,
      'compare-picks': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
      profile:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    };

    const mobileTabs = [
      { id: 'home',          label: 'Home' },
      { id: 'picks',         label: 'Picks' },
      { id: 'compare-picks', label: 'Compare' },
      { id: 'profile',       label: 'Profile' },
    ].map(t => `
      <button class="db-mobile-tab" data-page="${t.id}">
        ${mobileTabIcons[t.id] || ''}
        <span>${t.label}</span>
      </button>
    `).join('');

    navContainer.innerHTML = `
      <!-- Desktop nav -->
      <nav class="navbar">
        <div class="db-brand" data-page="home">
          <span class="db-brand-mark">👻</span>
          <span>down bad</span>
        </div>
        ${navLinks}
        <div class="db-nav-spacer"></div>
        <div class="db-nav-right">
          <button class="db-theme-btn" id="db-theme-toggle" title="Toggle light/dark">☀</button>
          <a href="#profile" class="db-nav-user" data-page="profile">
            <span class="db-avatar" id="db-nav-avatar">${initial}</span>
            <span id="db-nav-name">${displayName}</span>
          </a>
          <button class="db-btn" id="db-logout-btn" style="height:32px;padding:0 12px;font-size:12px;">Sign out</button>
        </div>
      </nav>

      <!-- Mobile tab bar -->
      <div class="db-mobile-nav" id="db-mobile-nav">
        ${mobileTabs}
      </div>
    `;

    this._attachListeners(user);
    this.setActive(this.state.activePage);
    this._applyUserColor(user);
  },

  _attachListeners(user) {
    // Logout
    const logoutBtn = document.getElementById('db-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Auth.logout();
        window.location.href = '/';
      });
    }

    // Theme toggle
    const themeBtn = document.getElementById('db-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const html = document.documentElement;
        const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('db-theme', next);
        themeBtn.textContent = next === 'dark' ? '☀' : '🌙';
      });
      // Set initial icon
      const current = document.documentElement.getAttribute('data-theme');
      themeBtn.textContent = current === 'dark' ? '☀' : '🌙';
    }

    // Brand / desktop nav clicks
    document.querySelectorAll('[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        const page = el.dataset.page;
        if (page === 'home') {
          e.preventDefault();
          this.setActive('home');
          window.Router && Router.navigate('home');
        }
      });
    });

    // Mobile tabs
    document.querySelectorAll('.db-mobile-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.dataset.page;
        this.setActive(page);
        window.Router && Router.navigate(page);
      });
    });
  },

  _applyUserColor(user) {
    const color = user.primaryColor || user.primary_color;
    if (!color) return;
    const avatar = document.getElementById('db-nav-avatar');
    if (avatar) {
      avatar.style.background = color;
      avatar.style.color = window.Colors ? Colors.getContrastColor(color) : '#fff';
    }
  },

  setActive(pageName) {
    this.state.activePage = pageName;

    document.querySelectorAll('.db-nav-link, .db-mobile-tab').forEach(el => {
      el.classList.toggle('active', el.dataset.page === pageName);
    });
  }
};

window.Navbar = Navbar;
