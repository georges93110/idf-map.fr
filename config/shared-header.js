// Shared header: injects markup, ensures CSS is loaded, and handles nav + language UI.
(function bootstrapSharedHeader() {
  const DEFAULT_LANG_OPTIONS = [
    { code: "fr", flagSrc: "https://flagcdn.com/w40/fr.png" },
    { code: "en", flagSrc: "https://flagcdn.com/w40/gb.png" },
    { code: "es", flagSrc: "https://flagcdn.com/w40/es.png" },
    { code: "de", flagSrc: "https://flagcdn.com/w40/de.png" },
    { code: "pl", flagSrc: "https://flagcdn.com/w40/pl.png" },
    { code: "pt", flagSrc: "https://flagcdn.com/w40/pt.png" },
    { code: "nl", flagSrc: "https://flagcdn.com/w40/nl.png" },
    { code: "it", flagSrc: "https://flagcdn.com/w40/it.png" },
    { code: "ru", flagSrc: "https://flagcdn.com/w40/ru.png" },
    { code: "zh", flagSrc: "https://flagcdn.com/w40/cn.png" },
    { code: "ko", flagSrc: "https://flagcdn.com/w40/kr.png" },
    { code: "ja", flagSrc: "https://flagcdn.com/w40/jp.png" }
  ];
  const NATIVE_LANG_LABELS = {
    fr: "Fran\u00E7ais",
    en: "English",
    es: "Espa\u00F1ol",
    de: "Deutsch",
    pl: "Polski",
    pt: "Portugu\u00EAs",
    nl: "Nederlands",
    it: "Italiano",
    ru: "\u0420\u0443\u0441\u0441\u043A\u0438\u0439",
    zh: "\u4E2D\u6587",
    ko: "\uD55C\uAD6D\uC5B4",
    ja: "\u65E5\u672C\u8A9E"
  };
  const DEFAULT_LANG_META = Object.fromEntries(DEFAULT_LANG_OPTIONS.map((entry) => [entry.code, entry]));
  const DEFAULT_SUPPORTED = new Set(DEFAULT_LANG_OPTIONS.map((entry) => entry.code));
  const DEFAULT_HEADER_LINKS = [
    {
      key: "discord",
      offsiteKey: "discord",
      labelKey: "discord_button",
      icon: "discord",
      disabled: false
    }
  ];
  const DEFAULT_OFFSITE_LINKS = {};
  function nativeLangLabel(code) {
    const normalized = String(code || "").toLowerCase();
    return NATIVE_LANG_LABELS[normalized] || normalized.toUpperCase();
  }

  function detectDefaultLang() {
    const qs = new URLSearchParams(location.search);
    const fromURL = String(qs.get("lang") || "").toLowerCase();
    if (DEFAULT_SUPPORTED.has(fromURL)) return fromURL;
    const stored = String(localStorage.getItem("idf_lang") || "").toLowerCase();
    if (DEFAULT_SUPPORTED.has(stored)) return stored;
    const nav = String((navigator.language || "fr").slice(0, 2)).toLowerCase();
    if (DEFAULT_SUPPORTED.has(nav)) return nav;
    return "fr";
  }

  const LOADER_FLAG_KEY = "idf_page_loader_pending";
  const LOADER_MAX_BLOCK_MS = 2000;
  const LOADER_MIN_DURATION_MS = 260;
  const LOADER_IMAGE_WAIT_TIMEOUT_MS = LOADER_MAX_BLOCK_MS;
  const LOADER_WINDOW_WAIT_TIMEOUT_MS = LOADER_MAX_BLOCK_MS;
  const LOADER_TRANSITION_FAILSAFE_MS = LOADER_MAX_BLOCK_MS;
  const LOADER_SETTLE_FRAMES = 2;
  const loaderState = {
    startedAt: 0,
    persist: false,
    hideTimer: null,
    transitionFailSafeTimer: null
  };

  function clearPendingLoaderFlag() {
    try { sessionStorage.removeItem(LOADER_FLAG_KEY); } catch {}
  }
  function clearTransitionFailSafe() {
    if (!loaderState.transitionFailSafeTimer) return;
    clearTimeout(loaderState.transitionFailSafeTimer);
    loaderState.transitionFailSafeTimer = null;
  }
  function waitForWindowLoad(timeoutMs = LOADER_WINDOW_WAIT_TIMEOUT_MS) {
    if (document.readyState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("load", done);
        resolve();
      };
      window.addEventListener("load", done, { once: true });
      const safeTimeout = Math.max(1, Number(timeoutMs) || LOADER_WINDOW_WAIT_TIMEOUT_MS);
      setTimeout(done, safeTimeout);
    });
  }
  function waitForNextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  async function waitForAllDocumentImages(timeoutMs = LOADER_IMAGE_WAIT_TIMEOUT_MS) {
    const deadline = Date.now() + Math.max(1, Number(timeoutMs) || LOADER_IMAGE_WAIT_TIMEOUT_MS);
    while (Date.now() < deadline) {
      const pending = [];
      Array.from(document.images || []).forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        if (img.complete) return;
        // Force lazy images to start while loader is visible.
        if (img.loading === "lazy") img.loading = "eager";
        pending.push(new Promise((resolve) => {
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }));
      });
      if (!pending.length) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return;
      await Promise.race([
        Promise.allSettled(pending),
        new Promise((resolve) => setTimeout(resolve, remaining))
      ]);
    }
  }
  async function waitForRealPageLoad(maxMs = LOADER_MAX_BLOCK_MS) {
    const safeMax = Math.max(1, Number(maxMs) || LOADER_MAX_BLOCK_MS);
    await Promise.race([
      (async () => {
        await waitForWindowLoad(safeMax);
        await waitForAllDocumentImages(safeMax);
        for (let i = 0; i < LOADER_SETTLE_FRAMES; i += 1) {
          await waitForNextFrame();
        }
      })(),
      new Promise((resolve) => setTimeout(resolve, safeMax))
    ]);
  }

  const scriptEl = document.currentScript;
  if (scriptEl) {
    try {
      const cssUrl = new URL("./header.css", scriptEl.src).toString();
      const hasHeaderCss = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((link) => {
        const href = link.getAttribute("href") || "";
        if (!href) return false;
        try { return new URL(href, location.href).toString() === cssUrl; } catch { return href.includes("header.css"); }
      });
      if (!hasHeaderCss) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = cssUrl;
        link.setAttribute("data-shared-header-css", "1");
        document.head.appendChild(link);
      }
    } catch {}
  }

  function ensureLoaderOverlay() {
    if (!document.body) return null;
    let overlay = document.getElementById("sharedPageLoader");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "sharedPageLoader";
    overlay.className = "page-loader-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="page-loader-card" role="status" aria-live="polite">
        <span class="page-loader-spinner" aria-hidden="true"></span>
        <span class="page-loader-label" id="sharedPageLoaderLabel"></span>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }
  function loadingLabelText() {
    const translated = t("loading");
    if (translated && translated !== "loading") return translated;
    return "Loading...";
  }
  function setLoaderLabel(text) {
    const label = document.getElementById("sharedPageLoaderLabel");
    if (!label) return;
    label.textContent = String(text || "").trim() || loadingLabelText();
  }
  function showPageLoader(options = {}) {
    const overlay = ensureLoaderOverlay();
    if (!overlay) return;
    if (loaderState.hideTimer) {
      clearTimeout(loaderState.hideTimer);
      loaderState.hideTimer = null;
    }
    loaderState.startedAt = Date.now();
    loaderState.persist = !!options.persist;
    setLoaderLabel(options.text);
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("page-loading");
    if (loaderState.persist) {
      try { sessionStorage.setItem(LOADER_FLAG_KEY, "1"); } catch {}
    }
  }
  function hidePageLoader(options = {}) {
    if (loaderState.persist && !options.force) return;
    const overlay = ensureLoaderOverlay();
    if (!overlay) return;
    clearTransitionFailSafe();
    const elapsed = Date.now() - loaderState.startedAt;
    const wait = options.force ? 0 : Math.max(0, LOADER_MIN_DURATION_MS - elapsed);
    if (loaderState.hideTimer) clearTimeout(loaderState.hideTimer);
    loaderState.hideTimer = setTimeout(() => {
      overlay.classList.remove("is-visible");
      overlay.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("page-loading");
      loaderState.persist = false;
      loaderState.hideTimer = null;
      clearPendingLoaderFlag();
    }, wait);
  }
  function startPageTransition(options = {}) {
    showPageLoader({ persist: true, text: options.text || loadingLabelText() });
    clearTransitionFailSafe();
    loaderState.transitionFailSafeTimer = setTimeout(() => {
      if (loaderState.persist) {
        // Hide only if navigation did not occur.
        if (document.visibilityState === "visible") {
          loaderState.persist = false;
          hidePageLoader({ force: true });
        }
      }
    }, LOADER_TRANSITION_FAILSAFE_MS);
  }

  function ensureMount() {
    let mount = document.getElementById("sharedHeaderMount");
    if (mount) return mount;
    if (!document.body) return null;
    mount = document.createElement("div");
    mount.id = "sharedHeaderMount";
    document.body.prepend(mount);
    return mount;
  }

  const mount = ensureMount();
  if (mount) {
    mount.innerHTML = `
      <div class="site-topbar" id="siteTopBar">
        <div class="site-topbar-row">
          <div class="site-topbar-left">
            <a class="site-logo-link" href="./" aria-label="Home">
              <img id="siteTopbarLogo" class="site-logo" src="" alt="Site logo">
            </a>
            <nav class="site-nav" id="siteNavLinks" aria-label="Site pages"></nav>
          </div>
          <div class="site-topbar-right">
            <nav class="site-quick-links" id="siteQuickLinks" aria-label="Quick links"></nav>
            <div class="lang-switch">
              <button id="btnLang" class="btn lang-btn" type="button" aria-expanded="false" aria-label="Language" title="Language">
                <img id="langBtnFlag" class="lang-flag" src="https://flagcdn.com/w40/fr.png" alt="" loading="lazy" aria-hidden="true"/>
              </button>
              <div id="langMenu" class="lang-menu" role="listbox" aria-label="Language" aria-hidden="true"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    const logoEl = document.getElementById("siteTopbarLogo");
    if (logoEl && !logoEl.getAttribute("src")) {
      try {
        logoEl.src = scriptEl ? new URL("../images/idf_logo.png", scriptEl.src).toString() : "images/idf_logo.png";
      } catch {
        logoEl.src = "images/idf_logo.png";
      }
    }
  }

  const state = {
    __lang: detectDefaultLang(),
    t: (key) => {
      const lang = state.__lang;
      const i18n = window.I18N || {};
      return (i18n[lang] && i18n[lang][key]) || (i18n.fr && i18n.fr[key]) || key;
    },
    getLang: () => state.__lang,
    setLang: (nextLang) => {
      const lang = DEFAULT_SUPPORTED.has(nextLang) ? nextLang : "fr";
      state.__lang = lang;
      localStorage.setItem("idf_lang", lang);
      document.documentElement.setAttribute("lang", lang);
    },
    langOptions: DEFAULT_LANG_OPTIONS,
    langMeta: DEFAULT_LANG_META,
    langLabel: (code) => nativeLangLabel(code),
    navTree: null,
    headerLinks: null
  };
  let eventsBound = false;

  function getLang() {
    try { return state.getLang(); } catch { return state.__lang || "fr"; }
  }
  function t(key) {
    try { return state.t(key); } catch { return key; }
  }
  function getNavTree() {
    if (Array.isArray(state.navTree) && state.navTree.length) return state.navTree;
    return Array.isArray(window.SITE_NAV_TREE) ? window.SITE_NAV_TREE : [];
  }
  function getHeaderLinks() {
    if (Array.isArray(state.headerLinks) && state.headerLinks.length) return state.headerLinks;
    if (Array.isArray(window.SITE_HEADER_LINKS) && window.SITE_HEADER_LINKS.length) return window.SITE_HEADER_LINKS;
    return DEFAULT_HEADER_LINKS;
  }
  function getSiteLinks() {
    const links = window.SITE_LINKS;
    if (links && typeof links === "object") return links;
    return {};
  }
  function getOffsiteLinks() {
    const fromConfig = getSiteLinks().offsite;
    if (fromConfig && typeof fromConfig === "object") return fromConfig;
    const map = window.SITE_OFFSITE_LINKS;
    if (map && typeof map === "object") return map;
    return DEFAULT_OFFSITE_LINKS;
  }
  function resolveOffsiteHref(item) {
    const direct = String(item?.href || "").trim();
    if (direct) return direct;
    const offsiteKey = String(item?.offsiteKey || item?.key || "").trim();
    if (!offsiteKey) return "";
    const offsite = getOffsiteLinks();
    return String(offsite[offsiteKey] || "").trim();
  }
  function isHiddenEntry(entry) {
    return !!(entry && typeof entry === "object" && entry.hidden === true);
  }
  function isDisabledEntry(entry) {
    return !!(entry && typeof entry === "object" && entry.disabled === true);
  }
  function navLabel(item) {
    const key = String(item?.labelKey || "").trim();
    if (key) return t(key);
    const href = String(item?.href || "").trim();
    if (href) return href;
    return "";
  }
  function normalizeHrefToPageName(href) {
    const raw = String(href || "").trim();
    if (!raw) return "";
    try {
      return normalizePath(new URL(raw, location.href).pathname);
    } catch {
      const pathOnly = raw.split("#")[0].split("?")[0];
      return normalizePath(pathOnly);
    }
  }
  function collectNavEntries(items, bucket) {
    const list = Array.isArray(items) ? items : [];
    list.forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      if (String(entry.href || "").trim()) bucket.push(entry);
      if (Array.isArray(entry.items) && entry.items.length) collectNavEntries(entry.items, bucket);
    });
  }
  function getCurrentPageNavEntry() {
    const currentPage = canonicalPageName(location.pathname);
    const entries = [];
    getNavTree().forEach((group) => {
      if (group && typeof group === "object") collectNavEntries(group.items, entries);
    });
    for (const entry of entries) {
      const page = normalizeHrefToPageName(entry.href);
      if (page && canonicalPageName(page) === currentPage) return entry;
    }
    return null;
  }
  function updateDocumentTitleFromNav() {
    const entry = getCurrentPageNavEntry();
    if (!entry) return;
    const key = String(entry.labelKey || "").trim();
    if (!key) return;
    const translated = t(key);
    if (!translated || translated === key) return;
    document.title = `IDF Map | ${translated}`;
  }
  function quickLinkLabel(item) {
    const key = String(item?.labelKey || "").trim();
    if (key) {
      const translated = t(key);
      if (translated && translated !== key) return translated;
    }
    const label = String(item?.label || "").trim();
    if (label) return label;
    const fallbackKey = String(item?.key || "").trim().toLowerCase();
    if (fallbackKey === "patreon") return "Patreon";
    const fallback = t("quick_link_fallback");
    return fallback && fallback !== "quick_link_fallback" ? fallback : "Link";
  }
  function quickLinkIconMarkup(icon) {
    const key = String(icon || "").trim().toLowerCase();
    if (key === "discord") {
      return `<svg class="site-icon-discord" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M18.59 5.88997C17.36 5.31997 16.05 4.89997 14.67 4.65997C14.5 4.95997 14.3 5.36997 14.17 5.69997C12.71 5.47997 11.26 5.47997 9.83001 5.69997C9.69001 5.36997 9.49001 4.95997 9.32001 4.65997C7.94001 4.89997 6.63001 5.31997 5.40001 5.88997C2.92001 9.62997 2.25001 13.28 2.58001 16.87C4.23001 18.1 5.82001 18.84 7.39001 19.33C7.78001 18.8 8.12001 18.23 8.42001 17.64C7.85001 17.43 7.31001 17.16 6.80001 16.85C6.94001 16.75 7.07001 16.64 7.20001 16.54C10.33 18 13.72 18 16.81 16.54C16.94 16.65 17.07 16.75 17.21 16.85C16.7 17.16 16.15 17.42 15.59 17.64C15.89 18.23 16.23 18.8 16.62 19.33C18.19 18.84 19.79 18.1 21.43 16.87C21.82 12.7 20.76 9.08997 18.61 5.88997H18.59ZM8.84001 14.67C7.90001 14.67 7.13001 13.8 7.13001 12.73C7.13001 11.66 7.88001 10.79 8.84001 10.79C9.80001 10.79 10.56 11.66 10.55 12.73C10.55 13.79 9.80001 14.67 8.84001 14.67ZM15.15 14.67C14.21 14.67 13.44 13.8 13.44 12.73C13.44 11.66 14.19 10.79 15.15 10.79C16.11 10.79 16.87 11.66 16.86 12.73C16.86 13.79 16.11 14.67 15.15 14.67Z" fill="#000000"></path>
      </svg>`;
    }
    if (key === "patreon") {
      return `<svg class="site-icon-patreon" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
          <g transform="translate(-180.000000, -7559.000000)" fill="#000000">
            <g transform="translate(56.000000, 160.000000)">
              <path d="M124,7408.70915 C124,7400.62942 134.319362,7395.52381 140.916036,7401.81847 C144.447791,7405.17795 145.058576,7410.71985 142.163596,7414.7692 C138.572862,7419.68812 133.881516,7418.96231 129.403095,7418.96231 L129.403095,7409.37406 C129.44508,7407.25654 130.150832,7405.43054 132.727923,7404.55797 C134.973131,7403.89406 137.591208,7405.13902 138.38093,7407.50513 C139.212637,7410.03797 138.007062,7411.73918 136.59356,7412.77747 C135.181058,7413.81577 132.977835,7413.81577 131.523348,7412.8194 L131.523348,7416.09802 C134.662241,7417.59756 139.62949,7415.79452 141.207933,7411.69825 C142.288552,7408.83395 141.539816,7405.5134 139.295607,7403.43781 C136.59456,7401.23743 133.6426,7400.69831 130.484714,7402.23379 C128.281491,7403.35495 126.744033,7405.6382 126.369165,7408.12811 L126.369165,7418.96231 L124.041985,7418.96231 L124,7408.70915 Z"></path>
            </g>
          </g>
        </g>
      </svg>`;
    }
    return `<svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <path d="M7 10l5 5 5-5"></path>
      <path d="M12 15V3"></path>
    </svg>`;
  }
  function getLangOptions() {
    if (Array.isArray(state.langOptions) && state.langOptions.length) return state.langOptions;
    return DEFAULT_LANG_OPTIONS;
  }
  function normalizePath(pathname) {
    let path = String(pathname || "").toLowerCase();
    if (!path) return "index.html";
    if (path.endsWith("/")) path += "index.html";
    if (path.startsWith("/")) path = path.slice(1);
    return path || "index.html";
  }
  function canonicalPageName(value) {
    let page = normalizePath(value);
    if (page.endsWith(".html")) page = page.slice(0, -5);
    return page || "index";
  }
  function getCurrentPageName() {
    return normalizePath(location.pathname);
  }
  function shouldShowSharedBackground() {
    return canonicalPageName(location.pathname) !== "map";
  }
  function readOpacityValue(raw, fallback) {
    const n = Number.parseFloat(String(raw ?? "").trim());
    if (!Number.isFinite(n)) return fallback;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }
  function applySharedBackgroundOptions() {
    const root = document.documentElement;
    const body = document.body;
    const visible = shouldShowSharedBackground();
    root.classList.toggle("has-shared-page-bg", visible);
    if (!visible) return;

    const fromBody = body ? body.dataset : null;
    const fromRoot = root.dataset || null;
    const bgOpacity = readOpacityValue(fromBody?.bgOpacity ?? fromRoot?.bgOpacity, null);
    const overlayTop = readOpacityValue(fromBody?.bgOverlayTop ?? fromRoot?.bgOverlayTop, null);
    const overlayBottom = readOpacityValue(fromBody?.bgOverlayBottom ?? fromRoot?.bgOverlayBottom, null);
    const bgImage = String(fromBody?.bgImage ?? fromRoot?.bgImage ?? "").trim();

    if (bgOpacity !== null) root.style.setProperty("--shared-page-bg-opacity", String(bgOpacity));
    if (overlayTop !== null) root.style.setProperty("--shared-page-overlay-top", `rgba(8,8,8,${overlayTop})`);
    if (overlayBottom !== null) root.style.setProperty("--shared-page-overlay-bottom", `rgba(8,8,8,${overlayBottom})`);
    if (bgImage) {
      const normalized = /^url\(/i.test(bgImage) ? bgImage : `url("${bgImage}")`;
      root.style.setProperty("--shared-page-bg-image", normalized);
    }
  }
  function shouldShowSharedFooter() {
    return canonicalPageName(location.pathname) !== "map";
  }
  function ensureSharedFooter() {
    if (!document.body) return null;
    let footer = document.getElementById("sharedSiteFooter");
    if (footer) return footer;
    footer = document.createElement("footer");
    footer.id = "sharedSiteFooter";
    footer.className = "shared-site-footer";
    footer.innerHTML = `
      <div class="shared-site-footer-inner">
        <span class="shared-site-footer-copy" id="sharedSiteFooterCopy"></span>
        <span class="shared-site-footer-sep" aria-hidden="true">&bull;</span>
        <a class="shared-site-footer-link" id="sharedSiteFooterLink" href="#"></a>
      </div>
      <a class="shared-site-footer-panel" id="sharedSiteFooterPanel" href="#">Panel Admin</a>
    `;
    document.body.appendChild(footer);
    return footer;
  }
  function renderSharedFooter() {
    const footer = ensureSharedFooter();
    if (!footer) return;
    const visible = shouldShowSharedFooter();
    footer.hidden = !visible;
    if (!visible) {
      document.documentElement.classList.remove("has-shared-footer");
      return;
    }
    document.documentElement.classList.add("has-shared-footer");
    const year = new Date().getFullYear();
    const offsite = getOffsiteLinks();
    const copy = document.getElementById("sharedSiteFooterCopy");
    const link = document.getElementById("sharedSiteFooterLink");
    const panelLink = document.getElementById("sharedSiteFooterPanel");
    if (copy) {
      const copyLabel = t("footer_copyright");
      const base = copyLabel && copyLabel !== "footer_copyright" ? copyLabel : "Copyright";
      copy.textContent = `${year} ${base}`;
    }
    if (link) {
      const label = t("footer_legal_notice");
      link.href = "mentions_legales.html";
      link.textContent = label && label !== "footer_legal_notice" ? label : "Mentions legales";
      link.setAttribute("aria-label", link.textContent);
      link.title = link.textContent;
    }
    if (panelLink) {
      const panelHref = String(offsite.panel_admin || "https://panel.idf-map.fr/").trim();
      const panelLabel = t("footer_admin_panel");
      const panelText = panelLabel && panelLabel !== "footer_admin_panel" ? panelLabel : "Panel Admin";
      panelLink.textContent = panelText;
      panelLink.href = panelHref || "https://panel.idf-map.fr/";
      panelLink.setAttribute("aria-label", panelText);
      panelLink.title = panelText;
    }
  }
  function closeSiteNavMenus() {
    document.querySelectorAll("#siteNavLinks .site-nav-group.is-open").forEach((group) => {
      group.classList.remove("is-open");
      const trigger = group.querySelector(".site-nav-group-trigger");
      if (trigger) trigger.setAttribute("aria-expanded", "false");
    });
  }
  function buildSubLink(item, currentPage) {
    const href = String(item?.href || "").trim();
    if (!href) return null;
    const disabled = isDisabledEntry(item);
    let normalized = href.toLowerCase();
    try {
      normalized = normalizePath(new URL(href, location.href).pathname);
    } catch {}
    const link = document.createElement(disabled ? "span" : "a");
    link.className = "site-nav-link site-nav-sublink";
    if (disabled) {
      link.classList.add("is-disabled");
      link.setAttribute("aria-disabled", "true");
    } else {
      link.href = href;
      link.dataset.page = normalized;
    }
    link.setAttribute("role", "menuitem");
    link.textContent = navLabel(item);
    const active = !disabled && canonicalPageName(normalized) === canonicalPageName(currentPage);
    if (active) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
    return { link, active, disabled };
  }
  function renderSiteNav() {
    const nav = document.getElementById("siteNavLinks");
    if (!nav) return;
    const currentPage = canonicalPageName(location.pathname);
    nav.innerHTML = "";
    nav.setAttribute("aria-label", t("nav_label"));
    const topEntries = [];
    getNavTree().forEach((group) => {
      const items = Array.isArray(group?.items) ? group.items : [];
      items.forEach((item) => {
        if (!isHiddenEntry(item)) topEntries.push(item);
      });
    });
    let submenuIndex = 0;
    topEntries.forEach((entry) => {
      const nestedItems = Array.isArray(entry?.items) ? entry.items : [];
      if (nestedItems.length && !entry.href) {
        const groupWrap = document.createElement("div");
        groupWrap.className = "site-nav-group";
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "site-nav-link site-nav-group-trigger";
        const entryLabel = navLabel(entry);
        trigger.textContent = entryLabel;
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-label", entryLabel);
        const submenu = document.createElement("div");
        submenu.className = "site-nav-submenu";
        submenu.setAttribute("role", "menu");
        submenu.id = `siteNavSubmenu${submenuIndex++}`;
        trigger.setAttribute("aria-controls", submenu.id);
        let hasActive = false;
        nestedItems.forEach((child) => {
          if (isHiddenEntry(child)) return;
          const built = buildSubLink(child, currentPage);
          if (!built) return;
          if (built.active) hasActive = true;
          submenu.appendChild(built.link);
        });
        if (!submenu.childElementCount) return;
        if (hasActive) trigger.classList.add("is-active");
        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const willOpen = !groupWrap.classList.contains("is-open");
          closeSiteNavMenus();
          groupWrap.classList.toggle("is-open", willOpen);
          trigger.setAttribute("aria-expanded", willOpen ? "true" : "false");
        });
        groupWrap.appendChild(trigger);
        groupWrap.appendChild(submenu);
        nav.appendChild(groupWrap);
        return;
      }
      const built = buildSubLink(entry, currentPage);
      if (!built) return;
      built.link.classList.remove("site-nav-sublink");
      built.link.removeAttribute("role");
      nav.appendChild(built.link);
    });
  }
  function isLangMenuOpen() {
    const menu = document.getElementById("langMenu");
    return !!menu && menu.getAttribute("aria-hidden") === "false";
  }
  function setLangMenuOpen(open) {
    const menu = document.getElementById("langMenu");
    if (!menu) return;
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    const btn = document.getElementById("btnLang");
    if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  function openLangMenu() {
    setLangMenuOpen(true);
    if (typeof window.updateUiOverlays === "function") window.updateUiOverlays();
  }
  function closeLangMenu() {
    setLangMenuOpen(false);
    if (typeof window.updateUiOverlays === "function") window.updateUiOverlays();
  }
  function toggleLangMenu() {
    if (isLangMenuOpen()) closeLangMenu();
    else openLangMenu();
  }
  function langLabel(code) {
    if (typeof state.langLabel === "function") {
      const custom = String(state.langLabel(code) || "").trim();
      if (custom) return custom;
    }
    return nativeLangLabel(code);
  }
  function buildLangMenu() {
    const menu = document.getElementById("langMenu");
    if (!menu) return;
    const currentLang = getLang();
    menu.innerHTML = "";
    const optionsGrid = document.createElement("div");
    optionsGrid.className = "lang-options-grid";
    menu.appendChild(optionsGrid);
    getLangOptions().forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "lang-option";
      btn.setAttribute("role", "option");
      btn.dataset.lang = option.code;
      btn.setAttribute("aria-selected", option.code === currentLang ? "true" : "false");
      const img = document.createElement("img");
      img.className = "lang-flag";
      img.src = option.flagSrc;
      img.alt = "";
      img.loading = "lazy";
      img.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "lang-name";
      name.textContent = langLabel(option.code);
      btn.appendChild(img);
      btn.appendChild(name);
      btn.addEventListener("click", () => {
        showPageLoader({ text: loadingLabelText() });
        requestAnimationFrame(() => {
          try {
            if (typeof state.setLang === "function") state.setLang(option.code);
            refresh();
            closeLangMenu();
          } finally {
            hidePageLoader();
          }
        });
      });
      optionsGrid.appendChild(btn);
    });
  }
  function updateLangButtonUI() {
    const currentLang = getLang();
    const btn = document.getElementById("btnLang");
    const flag = document.getElementById("langBtnFlag");
    const options = getLangOptions();
    const meta = state.langMeta?.[currentLang] || state.langMeta?.fr || options[0];
    if (flag && meta) {
      flag.src = meta.flagSrc;
      flag.alt = langLabel(meta.code || currentLang);
    }
    if (btn) {
      const title = `${t("language_label")} - ${langLabel(currentLang)}`;
      btn.setAttribute("aria-label", title);
      btn.title = title;
      btn.setAttribute("aria-expanded", isLangMenuOpen() ? "true" : "false");
    }
    const menu = document.getElementById("langMenu");
    if (menu) {
      menu.setAttribute("aria-label", t("language_label"));
      menu.querySelectorAll(".lang-option").forEach((option) => {
        const isActive = option.dataset.lang === currentLang;
        option.setAttribute("aria-selected", isActive ? "true" : "false");
        const name = option.querySelector(".lang-name");
        if (name) name.textContent = langLabel(option.dataset.lang);
      });
    }
  }
  function renderQuickLinks() {
    const host = document.getElementById("siteQuickLinks");
    if (!host) return;
    host.innerHTML = "";
    getHeaderLinks().forEach((item) => {
      if (!item || typeof item !== "object") return;
      const href = resolveOffsiteHref(item);
      const disabled = isDisabledEntry(item);
      const label = quickLinkLabel(item);
      const icon = quickLinkIconMarkup(item.icon || item.key);
      const el = document.createElement(disabled ? "span" : "a");
      el.className = "site-icon-link";
      if (disabled) {
        el.classList.add("is-disabled");
        el.setAttribute("aria-disabled", "true");
      } else if (href) {
        el.href = href;
        el.target = "_blank";
        el.rel = "noopener noreferrer";
      } else {
        return;
      }
      el.title = label;
      el.setAttribute("aria-label", label);
      el.innerHTML = icon;
      host.appendChild(el);
    });
  }
  function refresh() {
    applySharedBackgroundOptions();
    renderSiteNav();
    renderQuickLinks();
    updateDocumentTitleFromNav();
    buildLangMenu();
    updateLangButtonUI();
    setLoaderLabel(loadingLabelText());
    const logoLink = document.querySelector(".site-logo-link");
    if (logoLink) {
      logoLink.href = "./";
      const logoLabel = t("site_logo_label");
      logoLink.setAttribute("aria-label", logoLabel && logoLabel !== "site_logo_label" ? logoLabel : "Home");
    }
    const logo = document.getElementById("siteTopbarLogo");
    if (logo) {
      const alt = t("site_logo_alt");
      logo.alt = alt && alt !== "site_logo_alt" ? alt : "Site logo";
    }
    const nav = document.getElementById("siteNavLinks");
    if (nav) {
      const navLabel = t("site_pages_label");
      nav.setAttribute("aria-label", navLabel && navLabel !== "site_pages_label" ? navLabel : t("nav_label"));
    }
    const quickLinks = document.getElementById("siteQuickLinks");
    if (quickLinks) {
      const quickLabel = t("quick_links_label");
      quickLinks.setAttribute("aria-label", quickLabel && quickLabel !== "quick_links_label" ? quickLabel : "Quick links");
    }
    renderSharedFooter();
  }
  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    document.getElementById("btnLang")?.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleLangMenu();
    });
    document.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (!link) return;
      if (link.hasAttribute("download")) return;
      if (link.getAttribute("data-no-loader") === "1") return;
      const targetAttr = String(link.getAttribute("target") || "").toLowerCase();
      if (targetAttr && targetAttr !== "_self") return;
      const hrefAttr = String(link.getAttribute("href") || "").trim();
      if (!hrefAttr || hrefAttr.startsWith("#") || hrefAttr.startsWith("javascript:")) return;
      let url;
      try { url = new URL(link.href, location.href); } catch { return; }
      if (url.origin !== location.origin) return;
      const samePath = normalizePath(url.pathname) === normalizePath(location.pathname);
      const sameCanonicalPath = canonicalPageName(url.pathname) === canonicalPageName(location.pathname);
      const sameSearch = url.search === location.search;
      if ((samePath || sameCanonicalPath) && sameSearch) return;
      startPageTransition();
    }, true);
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("#siteNavLinks .site-nav-group")) closeSiteNavMenus();
      if (!target.closest(".lang-switch")) closeLangMenu();
    });
    window.addEventListener("beforeunload", () => {
      startPageTransition();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSiteNavMenus();
        closeLangMenu();
      }
    });
  }
  function init(config = {}) {
    Object.assign(state, config || {});
    const lang = getLang() || state.__lang || "fr";
    state.__lang = lang;
    document.documentElement.setAttribute("lang", lang);
    bindEvents();
    refresh();
    const hasPendingLoader = (() => {
      try { return sessionStorage.getItem(LOADER_FLAG_KEY) === "1"; } catch { return false; }
    })();
    const shouldBlockInitialLoad = document.readyState !== "complete";
    if (hasPendingLoader || shouldBlockInitialLoad) {
      showPageLoader({ text: loadingLabelText() });
      waitForRealPageLoad()
        .catch(() => {})
        .finally(() => hidePageLoader({ force: true }));
    } else {
      clearPendingLoaderFlag();
    }
  }

  window.sharedHeader = {
    init,
    refresh,
    closeSiteNavMenus,
    renderSiteNav,
    buildLangMenu,
    updateLangButtonUI,
    setLangMenuOpen,
    isLangMenuOpen,
    openLangMenu,
    closeLangMenu,
    toggleLangMenu,
    showPageLoader,
    hidePageLoader,
    startPageTransition
  };
  init();
})();
