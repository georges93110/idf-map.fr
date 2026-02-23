(function initSiteConfig() {
  const links = {
    offsite: {
      download: "https://truckymods.io/euro-truck-simulator-2/maps/ile-de-france-map",
      discord: "https://discord.gg/5xDM99G67s",
      patreon: "https://www.patreon.com/",
      dbus_world: "https://dbusworld.com/",
      extension_install: "./map_files/idf_extension.zip",
      extension_keys: "chrome://extensions/shortcuts",
      legal_hosting: "https://pages.github.com",
      panel_admin: "https://panel.idf-map.fr/",
      youtube: "https://www.youtube.com/@idfmap93"
    },
    guide: {
      steam_dlc: "https://store.steampowered.com/dlc/227300/Euro_Truck_Simulator_2/",
      manual_video_embed: "https://www.youtube.com/embed/EBilEKEllIQ?enablejsapi=1"
    },
    legal: {
      email: "georges93110@gmail.com"
    }
  };

  const navTree = [
    {
      labelKey: "nav_group_maps",
      items: [
        { href: "./", labelKey: "nav_accueil" },
        { href: "map", labelKey: "nav_carte_interactive" },
        { href: "faq", labelKey: "nav_faq" },
        { href: "mentions_legales", labelKey: "nav_mentions_legales", hidden: true },
        { labelKey: "", items: [] }
      ]
    }
  ];

  const headerLinks = [
    {
      key: "discord",
      offsiteKey: "discord",
      labelKey: "discord_button",
      icon: "discord"
    }
  ];

  window.SITE_LINKS = links;
  window.SITE_OFFSITE_LINKS = Object.assign({}, links.offsite);
  window.SITE_NAV_TREE = navTree;
  window.SITE_HEADER_LINKS = headerLinks;
})();
