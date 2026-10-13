# Workflow permanent IDFRP (instruction utilisateur du 13 octobre 2026)

- Site et HTML : modifier directement `C:/Users/antho/Documents/GitHub/idf-map.fr`.
- DLL, bridge embarque, ressources natives et outils : modifier directement `C:/Users/antho/Desktop/projet idfrp/source/telemetry`.
- Le dossier `C:/Users/antho/Desktop/projet idfrp/source` est la source permanente. Les anciens dossiers telemetry et sources-COACH* sont historiques.
- Ne plus creer de ZIP de livraison ni de nouvelle copie complete des sources a chaque changement.
- Le compilateur gere les sauvegardes horodatees, la compilation et l installation de plugins/idfrp.dll ; il attend la fermeture normale du jeu et de ses composants.
- Terminer les modifications et les controles utiles avant de lancer `C:/Users/antho/Desktop/Compilateur.bat` dans une fenetre independante visible.
- Une fois ce batch lance, repondre brievement puis arreter le tour : ne pas attendre la compilation, surveiller ses logs, installer manuellement ou demander a l utilisateur de fermer le jeu.
- Ne pas annoncer que compilation/installation ont reussi simplement parce que le batch a demarre. La fenetre affiche le resultat.
- Garder les verifications ciblees et la communication concise pour economiser les credits. Aucun travail multi-agent sans demande.
- Le lien source/site pointe sur le depot du site. La jonction source/telemetry/.toolchain reutilise les outils existants ; ne pas supprimer leur cible.
