// Données du jeu (unités, bâtiments, technologies, âges, difficulté)
export const RES = ['nourriture', 'bois', 'or', 'pierre'];
export const RES_LABEL = { nourriture: 'Nourriture', bois: 'Bois', or: 'Or', pierre: 'Pierre' };
export const RES_ICON = { nourriture: '🍖', bois: '🪵', or: '💰', pierre: '🪨' };

export const AGES = [
  { name: 'Âge sombre' },
  { name: 'Âge féodal', cost: { nourriture: 500 }, time: 35 },
  { name: 'Âge des châteaux', cost: { nourriture: 650, or: 200 }, time: 50 },
  { name: 'Âge impérial', cost: { nourriture: 900, or: 600, pierre: 100 }, time: 65 },
];

// cls : villager | inf | arch | cav | siege | hero  — am/ap : armure mêlée/perçante — bonus : dégâts en plus contre une classe
export const UNIT = {
  villageois: { label: 'Villageois', icon: '👷', cls: 'villager', hp: 25, atk: 3, range: 1.2, cd: 1.5, speed: 5.5, am: 0, ap: 0, cost: { nourriture: 50 }, time: 7, aggro: 0, b: 'hdv', age: 0 },
  epeiste: { label: 'Épéiste', icon: '🗡️', cls: 'inf', hp: 60, atk: 7, range: 1.3, cd: 1, speed: 5, am: 1, ap: 1, cost: { nourriture: 60, or: 20 }, time: 9, aggro: 11, b: 'caserne', age: 0, bonus: { building: 4, inf: 2 }, desc: 'Infanterie polyvalente, bonne contre les bâtiments' },
  lancier: { label: 'Lancier', icon: '🔱', cls: 'inf', hp: 50, atk: 4, range: 1.6, cd: 1, speed: 5.2, am: 0, ap: 0, cost: { nourriture: 35, bois: 25 }, time: 7, aggro: 11, b: 'caserne', age: 1, bonus: { cav: 10, hero: 6 }, desc: 'Anti-cavalerie' },
  archer: { label: 'Archer', icon: '🏹', cls: 'arch', hp: 35, atk: 5, range: 10, cd: 1.6, speed: 5.5, am: 0, ap: 0, cost: { bois: 25, or: 45 }, time: 8, aggro: 12, b: 'archerie', age: 1, bonus: { inf: 3 }, proj: 'arrow', desc: "Tir à distance, efficace contre l'infanterie (inefficace contre les bâtiments)" },
  cavalier: { label: 'Cavalier', icon: '🐎', cls: 'cav', hp: 110, atk: 9, range: 1.5, cd: 1.2, speed: 8, am: 2, ap: 2, cost: { nourriture: 70, or: 60 }, time: 11, aggro: 13, b: 'ecurie', age: 1, bonus: { arch: 7, siege: 10 }, radius: 0.75, desc: 'Rapide, écrase archers et engins de siège' },
  belier: { label: 'Bélier', icon: '🐏', cls: 'siege', hp: 180, atk: 2, range: 2, cd: 2.5, speed: 3.2, am: 0, ap: 25, cost: { bois: 160, or: 75 }, time: 16, aggro: 14, siegeOnly: true, b: 'atelier', age: 2, bonus: { building: 60 }, radius: 0.95, desc: 'Détruit les bâtiments, insensible aux flèches' },
  catapulte: { label: 'Catapulte', icon: '☄️', cls: 'siege', hp: 80, atk: 14, range: 15, cd: 3.2, speed: 3, am: 0, ap: 4, cost: { bois: 200, or: 150 }, time: 18, aggro: 16, b: 'atelier', age: 2, bonus: { building: 45 }, proj: 'stone', splash: 2.2, radius: 0.95, desc: 'Longue portée, dégâts de zone' },
  heros: { label: 'Héros (Roland)', icon: '👑', cls: 'hero', hp: 450, atk: 16, range: 1.6, cd: 1, speed: 6.5, am: 4, ap: 4, cost: { nourriture: 200, or: 200 }, time: 20, aggro: 13, b: 'hdv', age: 2, limit: 1, regen: 0.8, desc: 'Unique, se soigne hors combat' },
};

export const BUILD = {
  hdv: { label: 'Hôtel de ville', icon: '🏰', hp: 2000, radius: 4.2, pop: 5, atk: 5, range: 10, cd: 2, drop: ['nourriture', 'bois', 'or', 'pierre'], cost: { bois: 375, pierre: 200 }, time: 60, age: 2, bar: 8, proj: 'arrow' },
  maison: { label: 'Maison', icon: '🏠', hp: 300, radius: 2.2, pop: 5, cost: { bois: 30 }, time: 10, age: 0, bar: 4 },
  moulin: { label: 'Moulin', icon: '🌾', hp: 500, radius: 2.4, cost: { bois: 100 }, time: 14, age: 0, drop: ['nourriture'], bar: 6 },
  ferme: { label: 'Ferme', icon: '🟫', hp: 200, radius: 2.4, cost: { bois: 60 }, time: 8, age: 0, req: 'moulin', farm: 300, bar: 1.5 },
  camp_bois: { label: 'Camp de bûcheron', icon: '🪓', hp: 500, radius: 2.2, cost: { bois: 100 }, time: 12, age: 0, drop: ['bois'], bar: 4 },
  camp_mine: { label: 'Camp de mineur', icon: '⛏️', hp: 500, radius: 2.2, cost: { bois: 100 }, time: 12, age: 0, drop: ['or', 'pierre'], bar: 4 },
  caserne: { label: 'Caserne', icon: '⚔️', hp: 900, radius: 3.3, cost: { bois: 175 }, time: 20, age: 0, bar: 5.5 },
  palissade: { label: 'Palissade', icon: '🚧', hp: 250, radius: 0.6, cost: { bois: 2 }, time: 2, age: 0, wall: true, bar: 2.6 },
  archerie: { label: 'Camp de tir', icon: '🎯', hp: 900, radius: 3.3, cost: { bois: 175 }, time: 20, age: 1, bar: 5 },
  ecurie: { label: 'Écurie', icon: '🐴', hp: 900, radius: 3.3, cost: { bois: 175 }, time: 20, age: 1, bar: 4 },
  forge: { label: 'Forge', icon: '⚒️', hp: 900, radius: 3, cost: { bois: 150 }, time: 20, age: 1, bar: 5 },
  tour: { label: 'Tour de guet', icon: '🗼', hp: 700, radius: 1.6, cost: { bois: 50, pierre: 100 }, time: 18, age: 1, atk: 6, range: 11, cd: 2, bar: 9.5, proj: 'arrow' },
  muraille: { label: 'Muraille', icon: '🧱', hp: 1000, radius: 0.6, cost: { pierre: 8 }, time: 4, age: 1, wall: true, bar: 3.6 },
  porte: { label: 'Porte', icon: '🚪', hp: 1200, radius: 1.7, cost: { pierre: 30 }, time: 12, age: 1, gate: true, bar: 4.8 },
  universite: { label: 'Université', icon: '📜', hp: 1000, radius: 3.3, cost: { bois: 200 }, time: 25, age: 2, bar: 6 },
  atelier: { label: 'Atelier de siège', icon: '🛠️', hp: 900, radius: 3.3, cost: { bois: 200 }, time: 25, age: 2, bar: 5 },
};

export const TECHS = {
  brouette: { label: 'Brouette', icon: '🛒', b: 'hdv', age: 1, cost: { nourriture: 175, bois: 50 }, time: 20, desc: 'Villageois +15 % vitesse, +5 capacité' },
  hache: { label: 'Hache à double tranchant', icon: '🪓', b: 'camp_bois', age: 1, cost: { nourriture: 100, bois: 50 }, time: 15, desc: 'Récolte du bois +20 %' },
  pioche: { label: 'Pioche de mineur', icon: '⛏️', b: 'camp_mine', age: 1, cost: { nourriture: 100, bois: 75 }, time: 15, desc: 'Or et pierre +20 %' },
  collier: { label: 'Collier de cheval', icon: '🐂', b: 'moulin', age: 1, cost: { nourriture: 75, bois: 75 }, time: 15, desc: 'Nourriture +15 %, fermes +100' },
  charrue: { label: 'Charrue lourde', icon: '🌱', b: 'moulin', age: 2, req: 'collier', cost: { nourriture: 125, bois: 125 }, time: 20, desc: 'Nourriture +15 %, fermes +100' },
  forge1: { label: 'Forgeage', icon: '🔨', b: 'forge', age: 1, cost: { nourriture: 150 }, time: 20, desc: 'Attaque des soldats +1' },
  armure1: { label: 'Cotte de mailles', icon: '🛡️', b: 'forge', age: 1, cost: { nourriture: 100, or: 50 }, time: 20, desc: 'Armure des soldats +1' },
  forge2: { label: 'Fonte du fer', icon: '🔨', b: 'forge', age: 2, req: 'forge1', cost: { nourriture: 220, or: 120 }, time: 25, desc: 'Attaque des soldats +1' },
  armure2: { label: 'Armure de plaques', icon: '🛡️', b: 'forge', age: 2, req: 'armure1', cost: { nourriture: 200, or: 150 }, time: 25, desc: 'Armure des soldats +1' },
  forge3: { label: 'Haut fourneau', icon: '🔥', b: 'forge', age: 3, req: 'forge2', cost: { nourriture: 300, or: 220 }, time: 30, desc: 'Attaque des soldats +2' },
  armure3: { label: 'Armure complète', icon: '🛡️', b: 'forge', age: 3, req: 'armure2', cost: { nourriture: 300, or: 250 }, time: 30, desc: 'Armure des soldats +2' },
  maconnerie: { label: 'Maçonnerie', icon: '🧱', b: 'universite', age: 2, cost: { bois: 175, pierre: 150 }, time: 25, desc: 'Bâtiments +20 % PV' },
  balistique: { label: 'Balistique', icon: '🎯', b: 'universite', age: 2, cost: { bois: 300, or: 175 }, time: 30, desc: 'Archers et tours : portée +2' },
  chimie: { label: 'Chimie', icon: '⚗️', b: 'universite', age: 3, cost: { nourriture: 300, or: 200 }, time: 30, desc: 'Projectiles : attaque +1' },
  conscription: { label: 'Conscription', icon: '📯', b: 'caserne', age: 3, cost: { nourriture: 400, or: 200 }, time: 30, desc: 'Formation des soldats 25 % plus rapide' },
};

export const DIFFS = {
  facile: { label: 'Facile', bonus: [0, 0, 0, 0], first: 600, base: 2, grow: 1, interval: 240, vills: 14, barracks: 1, gather: 0.8, ageK: 1.3, ageT: [0, 330, 720, 1140] },
  normal: { label: 'Normal', bonus: [0, 0, 0, 0], first: 420, base: 3, grow: 2, interval: 180, vills: 20, barracks: 1, gather: 1, ageK: 1, ageT: [0, 250, 560, 900] },
  difficile: { label: 'Difficile', bonus: [0.25, 0.2, 0.15, 0.05], first: 330, base: 4, grow: 3, interval: 140, vills: 26, barracks: 2, gather: 1.1, ageK: 0.85, ageT: [0, 190, 430, 720] },
};
