# Cadence des HTML en jeu

Modifier `html-fps.json` sur le site. Le bridge le lit une fois au lancement
en HTTPS, avec délai de 8 secondes et réponse limitée à 64 Kio. Une politique
absente/invalide conserve les valeurs intégrées. Relancer le jeu après publication.
Aucun HTML n'est installé sur le site par la DLL.

`low`, `medium`, `high` correspondent à **Qualité des textures** : basse,
moyenne, élevée. La DLL lit `r_texture_detail` dans les CVar validées du jeu
(`2`, `1`, `0`) ; un changement en jeu est appliqué à chaud. Une lecture
indisponible conserve le niveau élevé. Les nombres sont des plafonds de 1 à
60 images/s, dans l'ordre croissant. Un écran immobile ne génère pas de nouvelles
captures inutiles. La cadence réelle dépend aussi du jeu et de la machine.

Identifiants : `lumiplan`, `lumiplanConvoy`, `saeiv`, `saeivAgora`,
`girouette`, `girouetteConvoy`. Le Lumiplan local garde 60 images/s en élevé.
Les écrans Convoy utilisent des pages indépendantes dans un navigateur partagé.
