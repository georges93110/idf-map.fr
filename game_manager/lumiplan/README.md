# Lumiplan IDF-RP
Adaptation du projet lumiplan-ratp de Leon-ED, licence MIT conservée dans LICENSE.

- Sources : source/. Construction : npm ci puis npm run build.
- URL de rendu : /game_manager/lumiplan/source/dist/index.html.
- Publier le dossier avec le site. L'application, ses polices et ses images ne sont jamais embarquées dans la DLL.
- Le bridge injecte l'état local du SAEIV, sans service autonome, GPS externe ni messages Convoi.
- Moteur arrêté ou producteur périmé : noir. Pas de ligne : écran original « Informations sur le parcours du bus indisponibles ».
- Viewport et texture de rendu : 1918 × 538 pixels, à échelle CSS native. La hauteur du cadre peut être étendue sans agrandir ou compresser les textes, logos et éléments. Aucun transform: scale, ni zoom du contenu.

La DLL utilise une copie visuelle privée de l'accessoire, avec les UV d'origine et le matériau de son écran isolé. La texture commune reste noire : aucune ligne locale n'est affichée sur les bus distants.
Les profils géométriques sont générés depuis les modèles du mod par tools/lumiplan_assets.py dans les sources natives. Le catalogue actuel couvre bustec_long du Bluebus utilisant exactement /vehicle/truck/share/bus/lumiplan_screen.tobj. Ajouter un autre modèle nécessite de régénérer ce catalogue ; les géométries inconnues restent inchangées.
