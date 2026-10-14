# Relais Convoi IDF-RP

Sources locales uniquement : aucun déploiement ni push n'est effectué par les outils de compilation de la DLL.

## Installation sur le serveur existant

1. Arrêter proprement l'ancien service Node et sauvegarder son dossier `data` (SQLite, WAL et SHM éventuels).
2. Copier le **contenu de ce dossier** à la racine de l'application Node de l'hébergeur : `server.js`, `server.cjs`, `store.cjs`, `package.json` et le dossier `convoy`. Installer leurs dépendances avec Node.js 20 ou ultérieur : `npm install`.
3. Conserver `data/player_stats.sqlite`, ou définir `DB_PATH` vers la base existante. La migration conserve les tables et les données de télémétrie et de lignes.
4. Configurer le fichier de démarrage de l'hébergeur sur **`server.js`**, puis démarrer avec `npm start` ou `node server.js`. `WS_PORT` (ou `PORT`) vaut 9377 par défaut. L'écoute utilise `0.0.0.0` pour les hébergements en conteneur ; `WS_HOST=127.0.0.1` permet une écoute locale si le proxy est sur le même hôte.
5. Le proxy de `panel.idf-map.fr` doit transmettre l'upgrade WebSocket de `/idfmap/ws/native/` au serveur. Le chemin intégral et `/` après suppression du préfixe sont acceptés.
6. Déployer aussi les fichiers modifiés du site, dont `game_manager/js/runtime/game2-main.js` et les parties de son runtime. La DLL ne publie pas le site.

Les messages historiques de télémétrie, PCC et widgets restent relayés. Les messages `convoy.*` ne passent jamais dans ce relais global : ils sont filtrés par session, liste native des participants, compatibilité des ressources et distance.

## Ce que la version intègre

- Identification du lobby ETS2 et du client natif ; reconnexions du même joueur sans doublon.
- Passagers appartenant à chaque véhicule, avec positions et animations. Leur placement suit le véhicule interpolé par ETS2 ; aucun second camion n'est créé.
- Girouettes privées par joueur, véhicule et session. Les mêmes modèles de bus peuvent afficher des destinations différentes.
- Sons pneumatiques communs d'ouverture/fermeture, spatialisés jusqu'à 60 m, sans rejouer les événements historiques. Ce ne sont pas les échantillons audio spécifiques des banques de chaque véhicule. Les animations natives de portes ne sont pas remplacées.
- Hystérésis de visibilité : apparition à 200 m, retrait au-delà de 230 m ; passagers détaillés à 80 m. Nettoyage des états après six secondes sans données.
- Un joueur en camion peut observer les bus équipés : le mode Bus n'est pas requis pour recevoir les états distants. Tous les observateurs doivent avoir la nouvelle DLL.

## Limites explicites

L'identité Steam est déclarée par le client, comme sur l'ancien serveur de statistiques. Le croisement des listes natives et du lobby limite les mélanges accidentels, mais **ne constitue pas une authentification Steam cryptographique**. Le point `authorizeConvoy` permet de raccorder une authentification serveur existante.

Le module `convoy/stops.cjs` teste des réservations exclusives pour une future population commune aux arrêts. Il n'est pas encore raccordé à la simulation locale : actuellement, chaque bus garde ses propres passagers. Ne pas présenter ce module serveur comme un partage opérationnel des personnes attendant à l'arrêt.

## Vérification à deux joueurs

Après installation du relais, du site et de la nouvelle DLL chez les deux joueurs, rejoindre le même Convoi sur `idf.mbd`. Un seul joueur peut prendre un bus pris en charge ; l'autre peut rester en camion. Contrôler de son côté la destination, les passagers et les sons de portes. Vérifier ensuite l'éloignement, le retour à proximité, puis une reconnexion du même joueur.

Les tests locaux couvrent les paquets, WebSockets réels, l'isolation des lobbies, la distance, les reconnexions, SQLite et les mises à jour signées. Ils ne remplacent pas cette validation visuelle dans ETS2.
