(function initSiteConfig() {
  const links = {
    offsite: {
      download: "https://truckymods.io/euro-truck-simulator-2/maps/ile-de-france-map",
      download_home_fr: "",
      discord: "https://discord.gg/5xDM99G67s",
      discord_profile: "https://discord.com/users/@georges93",
      patreon: "https://www.patreon.com/",
      dbus_world: "https://dbusworld.com/",
      extension_install: "./map_files/idf_extension.zip",
      extension_keys: "chrome://extensions/shortcuts",
      legal_hosting: "https://pages.github.com",
      panel_admin: "https://panel.idf-map.fr/",
      youtube: "https://www.youtube.com/@idfmap93",
      convoy_status_api: "https://panel.idf-map.fr/idfmap/stats/statsDedicatedServer.php"
    },
    guide: {
      steam_dlc: "https://store.steampowered.com/dlc/227300/Euro_Truck_Simulator_2/",
      manual_video_embed: "https://www.youtube.com/embed/EBilEKEllIQ?enablejsapi=1"
    },
    legal: {
      email: "georges93110@gmail.com",
      discord_user_id: "998344148748873840"
    },
    credits: {
      sheet: {
        spreadsheet_id: "1BkLIcKqoZUfx3nQZj-O-gh-Dh7VrKeYBkAfUH2ACDvs",
        gid: "0",
        cache_ms: 180000,
        timeout_ms: 10000
      }
    },
    actualites: {
      sheet: {
        spreadsheet_id: "1BkLIcKqoZUfx3nQZj-O-gh-Dh7VrKeYBkAfUH2ACDvs",
        sheet_name: "actualites",
        cache_ms: 180000,
        timeout_ms: 10000
      }
    }
  };

  const navTree = [
    {
      labelKey: "nav_group_maps",
      items: [
        { href: "./", labelKey: "nav_accueil" },
       //  { href: "actualites", labelKey: "nav_actualites" },
        { href: "map", labelKey: "nav_carte_interactive" },
        { href: "faq", labelKey: "nav_faq" },
        { href: "credits", labelKey: "nav_credits" },
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
