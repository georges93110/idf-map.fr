# Lumiplan IDF-RP
Adaptation du projet lumiplan-ratp de Leon-ED, licence MIT conservée dans LICENSE.

- Sources : source/. Construction : npm ci puis npm run build.
- URL de rendu : /game_manager/lumiplan/source/dist/index.html.
- Publier le dossier avec le site. L'application, ses polices et ses images ne sont jamais embarquées dans la DLL.
- Le bridge injecte l'état local du SAEIV, sans service autonome, GPS externe ni messages Convoi.
- Moteur arrêté ou producteur périmé : noir. Pas de ligne : écran original « Informations sur le parcours du bus indisponibles ».
- Texture complète : 2048 × 1024 pixels, comme le DDS d’origine. Zone utile : 2048 × 578 pixels à partir de (0, 0), coin supérieur gauche. Le reste reste noir. Le cadre utilise les pixels CSS natifs : aucun transform: scale ni zoom du contenu ; les UV du modèle restent inchangés.

La DLL utilise une copie visuelle privée de l'accessoire, avec les UV d'origine et le matériau de son écran isolé. La texture commune reste noire : aucune ligne locale n'est affichée sur les bus distants.
Les profils géométriques sont générés depuis les modèles du mod par tools/lumiplan_assets.py dans les sources natives. Le catalogue actuel couvre bustec_long du Bluebus utilisant exactement /vehicle/truck/share/bus/lumiplan_screen.tobj. Ajouter un autre modèle nécessite de régénérer ce catalogue ; les géométries inconnues restent inchangées.
