(function syncSiteNavFromConfig() {
  const links = window.SITE_LINKS && typeof window.SITE_LINKS === "object"
    ? window.SITE_LINKS
    : {};

  if (!Array.isArray(window.SITE_NAV_TREE) || !window.SITE_NAV_TREE.length) {
    window.SITE_NAV_TREE = [
      {
        labelKey: "nav_group_maps",
        items: [
          { href: "./", labelKey: "nav_accueil" },
          { href: "map.html", labelKey: "nav_carte_interactive" },
          { href: "faq.html", labelKey: "nav_faq" },
          { href: "mentions_legales.html", labelKey: "nav_mentions_legales", hidden: true },
          { labelKey: "", items: [] }
        ]
      }
    ];
  }

  if (!Array.isArray(window.SITE_HEADER_LINKS) || !window.SITE_HEADER_LINKS.length) {
    window.SITE_HEADER_LINKS = [
      {
        key: "discord",
        offsiteKey: "discord",
        labelKey: "discord_button",
        icon: "discord"
      }
    ];
  }

  if ((!window.SITE_OFFSITE_LINKS || typeof window.SITE_OFFSITE_LINKS !== "object")
    && links.offsite && typeof links.offsite === "object") {
    window.SITE_OFFSITE_LINKS = Object.assign({}, links.offsite);
  }
})();
