async function loadPartials() {
  const targets = Array.from(document.querySelectorAll('[data-include]'));
  if (targets.length === 0) return;

  await Promise.all(
    targets.map(async (target) => {
      const name = target.getAttribute('data-include');
      if (!name) return;

      try {
        const res = await fetch(`/partials/${name}.html`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        target.innerHTML = await res.text();
      } catch (err) {
        console.warn(`Include fallito per ${name}`, err);
      }
    })
  );

  setActiveNav();
}

function setActiveNav() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const links = Array.from(document.querySelectorAll('[data-nav]'));

  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;

    const target = href.replace(/\/+$/, '') || '/';
    const isHome = path === '/' && (target === '/' || target.endsWith('/index.html'));

    if (path === target || isHome) {
      link.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', loadPartials);
