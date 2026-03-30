(function initLineStylesConfig() {
  var styles = {
    "24":         ["#ab5798", "#FFFFFF", "https://www.bonjour-ratp.fr/lignes-bus/ligne-24/", "1"],
    "63":         ["#cdc74f", "#221f20", "https://www.bonjour-ratp.fr/lignes-bus/ligne-63/", "1"],
    "109":        ["#cdc74f", "#221f20", "https://www.bonjour-ratp.fr/lignes-bus/ligne-109/", "1"],
    "112":        ["#e69459", "#221f20", "https://www.bonjour-ratp.fr/lignes-bus/ligne-112/", "1"],
    "114":        ["#8cc299", "#221f20", "https://www.bonjour-ratp.fr/lignes-bus/ligne-114/", "1"],
    "121":        ["#d63e34", "#FFFFFF", "https://www.bonjour-ratp.fr/lignes-bus/ligne-121/", "1"],
    "124":        ["#e6a4b2", "#221f20", "https://www.bonjour-ratp.fr/lignes-bus/ligne-124/", "1"],
    "210":        ["#fecd08", "#221f20", "https://www.bonjour-ratp.fr/lignes-bus/ligne-210/", "1"],
    "221":        ["#e7a5b3", "#221f20", "https://www.bonjour-ratp.fr/lignes-bus/ligne-221/", "1"],
    "303":        ["#99974a", "#FFFFFF", "https://www.bonjour-ratp.fr/lignes-bus/ligne-303/", "1"],
    "325":        ["#9ad1dc", "#221f20", "https://www.bonjour-ratp.fr/lignes-bus/ligne-325/", "1"],
    "351":        ["#d7b152", "#221f20", "https://www.bonjour-ratp.fr/lignes-bus/ligne-351/", "1"],
    "FLIXBUS":    ["#a7d245", "#FFFFFF", "https://www.flixbus.fr/", "9"],
    "N11":        ["#e9682a", "#221f20", "https://www.ratp.fr/plans-lignes/noctilien/n11", "1,2"],
    "N23":        ["#d09835", "#221f20", "https://www.ratp.fr/plans-lignes/noctilien/n23", "1,2"],
    "N33":        ["#e9682a", "#221f20", "https://www.ratp.fr/plans-lignes/noctilien/n33", "1,2"],
    "Titus 1":    ["#e63b20", "#FFFFFF", "https://www.rosnysousbois.fr/mobilites/le-titus/", "1"],
    "Titus 2":    ["#49713e", "#FFFFFF", "https://www.rosnysousbois.fr/mobilites/le-titus/", "1"],
    "Fictives":   ["#005e2c", "#FFFFFF", "", "0"],
    "Autocar":    ["#005e2c", "#FFFFFF", "", "0"],
    "Scolaire":   ["#f0c748", "#221f20", "", "0"],
    "Express":    ["#6fb2e1", "#FFFFFF", "", "0"],
    "Express 75": ["#6fb2e1", "#FFFFFF", "", "0"],
    "Express 77": ["#6fb2e1", "#FFFFFF", "", "0"],
    "Express 93": ["#6fb2e1", "#FFFFFF", "", "0"],
    "Express 94": ["#6fb2e1", "#FFFFFF", "", "0"],
    "RER A":      ["#e84528", "#FFFFFF", "", "1"],
    "RER E":      ["#af4f8d", "#FFFFFF", "", "1"],
    "M\u00e9tro 1": ["#f3c043", "#221f20", "", "1"]
  };

  if (typeof window !== "undefined") {
    window.LINE_STYLES = styles;
  }
})();
