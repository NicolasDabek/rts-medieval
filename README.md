# RTS Médiéval
RTS 3D dans le navigateur (PC et mobile), inspiré d'Age of Empires / Empire Earth. Three.js est vendored dans `vendor/` (aucun CDN), sons générés en WebAudio.
Jouer : https://nicolasdabek.github.io/rts-medieval/ — en local : `python3 -m http.server` puis http://localhost:8000.

**But** : détruire l'hôtel de ville ennemi. Difficulté au démarrage (Facile / Normal / Difficile).

**Époques** : Âge sombre → féodal → châteaux → impérial (recherche à l'hôtel de ville), chacune débloque bâtiments, unités et technologies.
**Économie** : nourriture (baies, cerfs, fermes près d'un moulin), bois, or, pierre ; dépôts : hôtel de ville, moulin (nourriture), camp de bûcheron (bois), camp de mineur (or/pierre).
**Armée** (contres) : épéiste, lancier (anti-cavalerie), archer (anti-infanterie), cavalier (anti-archers/siège), bélier & catapulte (anti-bâtiments), héros unique (Roland, régénération).
**Défenses** : tours, palissades et murailles tracées, portes (laissent passer votre camp seulement).
**Technologies** : forge (attaque/armure), université (maçonnerie, balistique, chimie), moulin/camps (récolte), brouette, conscription.

**PC** : clic gauche / glisser = sélection (Maj = ajouter, double-clic = même type) · clic droit = ordre contextuel (déplacer / récolter / attaquer / construire / déposer ; avec un bâtiment sélectionné = point de ralliement) · F = attaque-déplacement · X = arrêter · R = pivoter le bâtiment · . ou I = villageois inactif · H = base · WASD/ZQSD/flèches/bords = caméra · molette = zoom · Échap = annuler. Murs : cliquer-glisser (ou 2 clics).

**Mobile** : toucher = sélection / ordre · appui long = sélectionner · 1 doigt = caméra · pincer = zoom · murs : toucher départ puis arrivée · boutons à gauche : cadre, attaque, armée, base, villageois inactif, désélection.

HUD : 🔊 son, 💾 sauvegarder, 📂 charger (localStorage).
Debug : `?diff=normal`, `?speed=10`, `?nofog`.
