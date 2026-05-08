(function initLineStylesConfig() {
  var styles = {
    "24": [
      "#ab5798",
      "#FFFFFF",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-24/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "63": [
      "#cdc74f",
      "#221f20",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-63/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "109": [
      "#cdc74f",
      "#221f20",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-109/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "112": [
      "#e69459",
      "#221f20",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-112/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "114": [
      "#8cc299",
      "#221f20",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-114/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "121": [
      "#d63e34",
      "#FFFFFF",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-121/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "124": [
      "#e6a4b2",
      "#221f20",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-124/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "210": [
      "#fecd08",
      "#221f20",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-210/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "221": [
      "#e7a5b3",
      "#221f20",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-221/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "303": [
      "#99974a",
      "#FFFFFF",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-303/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "325": [
      "#9ad1dc",
      "#221f20",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-325/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "351": [
      "#d7b152",
      "#221f20",
      "https://www.bonjour-ratp.fr/lignes-bus/ligne-351/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "TRANSDEV",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Transdev)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "FLIXBUS": [
      "#a7d245",
      "#FFFFFF",
      "https://www.flixbus.fr/",
      "9",
      false,                        // SON VALIDATION
      "",                           // SONS ARRET DEMANDE
      "FLIXBUS",                    // DOSSIER ANNONCES SONORES
      "",                           // VOIX ANNONCES SONORES AUTOMATIQUES
      [0, 0]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "N11": [
      "#e9682a",
      "#221f20",
      "https://www.ratp.fr/plans-lignes/noctilien/n11",
      "1,2",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "N23": [
      "#d09835",
      "#221f20",
      "https://www.ratp.fr/plans-lignes/noctilien/n23",
      "1,2",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "N33": [
      "#e9682a",
      "#221f20",
      "https://www.ratp.fr/plans-lignes/noctilien/n33",
      "1,2",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Titus 1": [
      "#e63b20",
      "#FFFFFF",
      "https://www.rosnysousbois.fr/mobilites/le-titus/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Titus 2": [
      "#49713e",
      "#FFFFFF",
      "https://www.rosnysousbois.fr/mobilites/le-titus/",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Fictives": [
      "#005e2c",
      "#FFFFFF",
      "",
      "0",
      false,                        // SON VALIDATION
      "",                           // SONS ARRET DEMANDE
      "",                           // DOSSIER ANNONCES SONORES
      "",                            // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Autocar": [
      "#005e2c",
      "#FFFFFF",
      "",
      "0",
      false,                        // SON VALIDATION
      "",                           // SONS ARRET DEMANDE
      "",                           // DOSSIER ANNONCES SONORES
      "",                            // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Scolaire": [
      "#f0c748",
      "#221f20",
      "",
      "0",
      false,                        // SON VALIDATION
      "",                           // SONS ARRET DEMANDE
      "",                           // DOSSIER ANNONCES SONORES
      "",                            // VOIX ANNONCES SONORES AUTOMATIQUES
      [0, 0]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Express": [
      "#6fb2e1",
      "#FFFFFF",
      "",
      "0",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Express 75": [
      "#6fb2e1",
      "#FFFFFF",
      "",
      "0",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Express 77": [
      "#6fb2e1",
      "#FFFFFF",
      "",
      "0",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Express 93": [
      "#6fb2e1",
      "#FFFFFF",
      "",
      "0",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "Express 94": [
      "#6fb2e1",
      "#FFFFFF",
      "",
      "0",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-2, 2]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "RER A": [
      "#e84528",
      "#FFFFFF",
      "",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-5, 5]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "RER E": [
      "#af4f8d",
      "#FFFFFF",
      "",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-5, 5]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ],
    "M\u00e9tro 1": [
      "#f3c043",
      "#221f20",
      "",
      "1",
      true,                         // SON VALIDATION
      "arret_demande_ratp",         // SONS ARRET DEMANDE
      "RATP",                       // DOSSIER ANNONCES SONORES
      "Voix de Synthèse (Anciennes)", // VOIX ANNONCES SONORES AUTOMATIQUES
      [-5, 5]                       // VARIATION LIMITES NOMBRE PASSAGERS
    ]
  };

  if (typeof window !== "undefined") {
    window.LINE_STYLES = styles;
  }
})();
