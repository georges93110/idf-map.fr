# Relais Convoi IDF-RP

Sources locales uniquement : aucun déploiement ni push n'est effectué par les outils de compilation de la DLL.

## Installation sur le serveur existant

1. Arrêter proprement l'ancien service Node et sauvegarder son dossier `data` (SQLite, WAL et SHM éventuels).
2. Copier le **contenu de ce dossier** à la racine de l'application Node de l'hébergeur : `server.js`, `server.cjs`, `admin-overview.cjs`, `store.cjs`, `package.json` et le dossier `convoy`. Installer leurs dépendances avec Node.js 20 ou ultérieur : `npm install`.
3. Conserver `data/player_stats.sqlite`, ou définir `DB_PATH` vers la base existante. La migration conserve les tables et les données de télémétrie et de lignes.
4. Configurer le fichier de démarrage de l'hébergeur sur **`server.js`**, puis démarrer avec `npm start` ou `node server.js`. `WS_PORT` (ou `PORT`) vaut 9377 par défaut. L'écoute utilise `0.0.0.0` pour les hébergements en conteneur ; `WS_HOST=127.0.0.1` permet une écoute locale si le proxy est sur le même hôte.
5. Le proxy de `panel.idf-map.fr` doit transmettre l'upgrade WebSocket de `/idfmap/ws/native/` au serveur. Le chemin intégral et `/` après suppression du préfixe sont acceptés.
6. Déployer aussi les fichiers modifiés du site, dont `game_manager/js/runtime/game2-main.js` et les parties de son runtime. La DLL ne publie pas le site.

Les messages historiques de télémétrie, PCC et widgets restent relayés. Les messages `convoy.*` ne passent jamais dans ce relais global : ils sont filtrés par session, liste native des participants, compatibilité des ressources et distance.

## Annonces audio (convoy.4)

Mettre à jour le site (runtime et `01c-convoy-audio-catalog.js`), le relais (`convoy/protocol.cjs`) et la DLL/runtime chez les joueurs. Aucun déploiement automatique n'est effectué ici. L'ancien relais ignore les nouveaux événements d'annonces.

Les annonces de destination, d'arrêts, les annonces manuelles et les sons de validation/arrêt demandé sont émis au démarrage réel du son local. Les aperçus des paramètres, le bip de prise de service et les communications PCC restent privés. Les clips sont identifiés par un catalogue d'ID stables : aucun fichier ni URL arbitraire n'est reçu d'un joueur. La lecture tient compte de la distance (60 m maximum), de l'ouverture de la porte avant, du volume natif et de la pause ; une interruption ou une déconnexion arrête le son. Les événements anciens ne sont pas rejoués lors d'une reconnexion.

Le catalogue se régénère avec `telemetry/tools/convoy_audio_catalog.cjs` à chaque compilation ; publier aussi sa version du site après ajout de sons. Le catalogue contient actuellement 177 fichiers approuvés.

`data/player_stats.sqlite` a été remis à zéro localement, avec sauvegarde séparée. Il contient le schéma complet et aucune statistique. Pour remplacer une base de production, arrêter le service puis sauvegarder l'ancienne base avec ses éventuels fichiers WAL/SHM avant installation ; ne pas écraser une base active.

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

## Carte admin : sessions et état des bus

Déployer ensemble `game_manager/html_divers/admin_map.html` et son nouveau fichier
`adminConvoy.js` sur le site, puis `server.cjs` et `admin-overview.cjs` sur le relais.
Redémarrer le service Node après sa mise à jour. La compilation de la DLL ne
déploie aucun de ces fichiers.

La carte s'abonne avec `admin.subscribe` (version 1). Le relais produit au plus un
résumé `admin.convoys` par seconde, uniquement lorsqu'un observateur est abonné.
Les filtres séparent le solo, les sessions identifiées et les Convois non identifiés.
Une session est distinguée par son identifiant natif et son époque ; son nom
commercial n'est pas fourni par le protocole actuel. Les identités ambiguës ne
sont jamais attribuées arbitrairement à un serveur.

Le résumé contient les lignes/services, girouettes, portes, moteur, occupation,
phases de montée/descente et dernier événement sonore. Il ne transmet ni données
audio jouables, ni identifiants/positions individuels des passagers, ni jetons.
Les données périmées après sept secondes sont marquées indisponibles. La
télémétrie historique reste exploitable avec un relais plus ancien. Ce canal
conserve le modèle d'accès du relais existant ; il n'ajoute pas d'authentification.

Tests : `telemetry/tests/admin_convoy.test.cjs` couvre l'isolation, les abonnements,
la cadence, les données périmées et les déconnexions avec des WebSockets réels.
