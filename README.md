# RTS Médiéval — v1.0.0
RTS 3D dans le navigateur (PC et mobile), inspiré d'Age of Empires / Empire Earth. Three.js r169 est inclus dans `vendor/` (aucun CDN, aucune requête externe), sons générés en WebAudio.

## Jouer
- En ligne : https://nicolasdabek.github.io/rts-medieval/
- En local (aucune installation) : `python3 -m http.server` à la racine, puis http://localhost:8000.
- Choisissez la difficulté dans le menu :
  - **Facile** : vagues petites et tardives (~10 min), IA moins rusée (contre une fois sur deux, vagues non groupées).
  - **Normal** (recommandé) : 1re vague vers 7 min, IA qui contre votre armée.
  - **Difficile** : IA plus rapide, avec un bonus de ressources.
- Un court tutoriel (passable) se lance à la première partie ; il se relance depuis l'aide « ? ».

**But** : détruire l'hôtel de ville ennemi, ou faire tenir une **Merveille** 5 minutes (âge impérial, 1000 de chaque ressource).

**Époques** : Âge sombre → féodal → châteaux → impérial (recherche à l'hôtel de ville), chacune débloque bâtiments, unités et technologies.
**Économie** : nourriture (baies, cerfs, fermes près d'un moulin), bois, or, pierre ; dépôts : hôtel de ville, moulin (nourriture), camp de bûcheron (bois), camp de mineur (or/pierre).
**Armée** (contres) : épéiste, lancier (anti-cavalerie), tirailleur (anti-archers), archer (anti-infanterie), cavalier (anti-archers/siège), bélier & catapulte (anti-bâtiments), héros unique (Roland, régénération).
**Défenses** : tours, palissades et murailles tracées, portes (laissent passer votre camp seulement).
**Technologies** : forge (attaque/armure), université (maçonnerie, balistique, chimie), moulin/camps (récolte), brouette, conscription.

## Commandes
**PC** : clic gauche / glisser = sélection (Maj = ajouter, double-clic = même type) · clic droit = ordre contextuel (déplacer / récolter / attaquer / construire / déposer ; avec un bâtiment sélectionné = point de ralliement) · F = attaque-déplacement · X = arrêter · R = pivoter le bâtiment · . ou I = villageois inactif · H = base · Ctrl+1..9 = créer un groupe, 1..9 = le sélectionner · WASD/ZQSD/flèches/bords = caméra · molette = zoom · Échap = annuler · ? ou F1 = aide. Murs : cliquer-glisser (ou 2 clics).

**Mobile** : toucher = sélection / ordre · appui long = sélectionner sans ordre · 1 doigt = caméra · pincer = zoom · minicarte = déplacer la vue · murs : toucher départ puis arrivée · boutons à gauche : cadre, attaque, armée, base, villageois inactif, désélection.

HUD : ? aide, 🔊 son, 💾 sauvegarder, 📂 charger (localStorage ; sauvegarde automatique toutes les 60 s).
Débogage : `?diff=normal`, `?speed=10`, `?nofog`.

## Structure du code (modules ES)
- `app.js` entrée · `main.js` boucle + API `window.__game` · `state.js` état mutable partagé
- `config.js` paramètres/équipes · `data.js` statistiques · `render.js` scène/caméra
- `world.js` entités + murs instanciés · `path.js` A* · `map.js` carte + brouillard
- `units.js` économie/commandes/combat · `ai.js` IA · `aipick.js` choix d'unités de l'IA · `wave.js` vagues groupées de l'IA · `ui.js` panneaux/HUD/minimap · `input.js` souris/tactile/clavier
- `save.js` sauvegarde · `audio.js` sons

## Équilibrage et tests
Prérequis : Node.js 18 ou plus récent (aucune dépendance à installer).
- `npm test` lance trois tests sans navigateur :
  - `test/duel.test.mjs` (duels à coût égal, 40 essais × 2 jeux de graines, budgets 300/600/1200, presets d'améliorations aucune / âge 3 / max) : moyenne de chaque unité 42–58 % (35–65 % à 300), ≤ 15/30 duels à 0/100 %, ≥ 2/15 paires serrées à 600 et ≥ 1 à 1200, contres voulus ≥ 85 %, chaque unité a un duel gagné ≥ 80 % et un perdu ≤ 20 %, écart ≤ 10 points entre 600 et 1200, héros + escorte 40–60 %, héros seul contre 600 de lanciers ≤ 15 %, descriptions « Bat / Craint » conformes à la matrice. Affiche aussi les paires serrées à 1200 et l'IC95 épéiste–tirailleur.
  - `test/ai.test.mjs` (80 graines à 600 et 1200) : miroir Normal 40–60 %, IA qui contre ≥ 90 % (chaque adversaire ≥ 50 %, tirailleurs ≥ 75 %), aussi avec un modèle honnête par bâtiment ; Facile ≤ 70 % et ≥ 25 points sous Normal ; doubles contres ≥ 65 % ; épéistes + cavaliers en vague groupée contre tirailleurs ≥ 50 %.
  - `test/version.test.mjs` : même version dans `package.json`, le menu et `CHANGELOG.md` ; aucune ressource externe dans la page.
- `node tools/duel.mjs [budget] [essais]` : matrice des duels à coût égal.
- `npm run ic95 -- [a] [b] [graines] [budgets] [décalages] [preset]` (`tools/ic95.mjs`) : mesure appariée (graines jouées des deux côtés) avec IC95, ex. `npm run ic95 -- epeiste tirailleur 400 600,1200 0`.
- `rules.js` : formule de dégâts, portée et recul (kiting) partagés par le jeu et l'outil de duel. `aipick.js` et `wave.js` : choix d'unités et vagues groupées de l'IA, partagés par le jeu et les tests.
- Contres voulus : lancier > cavalier, héros · cavalier > archer, tirailleur · archer > épéiste, lancier · tirailleur > archer, lancier · épéiste > lancier, cavalier · héros > épéiste, cavalier.

Historique des versions : [CHANGELOG.md](CHANGELOG.md).
