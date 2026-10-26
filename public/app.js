(() => {
  const labels = {
    admin: 'Admin',
    cart: 'My Cart',
    checkout: 'Checkout',
    'edit-profile': 'Edit profile',
    'forgot-password': 'Password reset',
    login: 'Login',
    orders: 'Orders',
    'order-success': 'Order confirmed',
    products: 'Products',
    profile: 'Profile',
    register: 'Register',
    settings: 'Settings',
    users: 'Users',
    wishlist: 'Wishlist',
    'product-details': 'Product details',
    new: 'New product'
  };
  if (!document.querySelector('nav[aria-label="Breadcrumb"]')) {
    const segments = window.location.pathname.split('/').filter(Boolean);
    const breadcrumb = document.createElement('nav');
    breadcrumb.className = 'breadcrumb';
    breadcrumb.setAttribute('aria-label', 'Breadcrumb');
    breadcrumb.innerHTML = '<a href="/">VaBuy</a><span aria-hidden="true">/</span>';

    if (segments.length === 0) {
      breadcrumb.innerHTML += '<span aria-current="page">Home</span>';
    } else {
      const visibleSegments = segments.filter((segment) => !/^(\d+|SHP-\d+)$/i.test(segment));
      visibleSegments.forEach((segment, index) => {
        const label = labels[segment] || segment.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
        const isCurrent = index === visibleSegments.length - 1;
        const segmentIndex = segments.indexOf(segment);
        const href = `/${segments.slice(0, segmentIndex + 1).join('/')}`;
        breadcrumb.innerHTML += isCurrent
          ? `<span aria-current="page">${label}</span>`
          : `<a href="${href}">${label}</a><span aria-hidden="true">/</span>`;
      });
    }

    const siteHeader = document.querySelector('.site-header');
    if (siteHeader) siteHeader.insertAdjacentElement('afterend', breadcrumb);
    else document.body.prepend(breadcrumb);
  }

  const showStoreNotice = () => {
    const notice = new URLSearchParams(window.location.search).get('notice');
    if (!notice) return;
    const target = document.querySelector('.store-notice') || document.createElement('p');
    target.className = 'store-notice notice';
    target.setAttribute('role', 'status');
    target.textContent = notice;
    if (!target.isConnected) document.querySelector('main')?.prepend(target);
    target.hidden = false;
  };
  showStoreNotice();

  if (!window.location.pathname.startsWith('/admin')) {
    fetch('/api/categories')
      .then((response) => response.ok ? response.json() : [])
      .then((categories) => {
      if (!Array.isArray(categories) || !categories.length) return;
      let nav = document.querySelector('header nav[aria-label="Main navigation"], header .site-nav');
      if (!nav) {
        let header = document.querySelector('header');
        if (!header) {
          header = document.createElement('header');
          header.className = 'site-header';
          header.innerHTML = '<div class="site-header-inner"><a class="site-brand" href="/">VaBuy</a></div>';
          document.body.prepend(header);
        }
        nav = document.createElement('nav');
        nav.className = 'site-nav category-nav';
        nav.setAttribute('aria-label', 'Shop categories');
        header.querySelector('.site-header-inner')?.append(nav);
        if (!nav.isConnected) header.append(nav);
      }
      if (nav.querySelector('[data-category-navigation]')) return;
      categories.forEach((category) => {
        const link = document.createElement('a');
        link.href = `/categories/${encodeURIComponent(category.slug)}`;
        link.textContent = category.name;
        link.dataset.categoryNavigation = 'true';
        nav.append(link);
      });
      })
      .catch(() => {});
  }

  const loader = document.createElement('div');
  loader.id = 'page-loader';
  loader.innerHTML = '<span class="loading-spinner" aria-label="Loading"></span>';
  document.body.appendChild(loader);

  const welcomePopup = document.querySelector('.welcome-popup');
  if (welcomePopup) {
    const dismiss = () => {
      welcomePopup.classList.add('is-dismissed');
      window.setTimeout(() => welcomePopup.remove(), 250);
    };
    welcomePopup.querySelector('button')?.addEventListener('click', dismiss);
    window.setTimeout(dismiss, 4500);
  }

  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', () => {
      form.setAttribute('aria-busy', 'true');
      const button = form.querySelector('button[type="submit"], button:not([type])');
      if (button) {
        button.dataset.originalText = button.textContent;
        button.innerHTML = '<span class="loading-spinner"></span>Processing...';
      }
    });
  });

  document.querySelectorAll('a:not([target]):not([href^="#"])').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = new URL(link.href, window.location.href);
      if (
        destination.origin === window.location.origin &&
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search &&
        destination.hash
      ) return;
      loader.classList.add('is-visible');
    });
  });
})();
