/* ================================================================ */
/* PROUT MANAGER - Cœur du jeu                                      */
/* Logique métier, PeerJS, synchronisation, interface                */
/* ================================================================ */

// =================================================================
// ATTENTION : Configuration
// =================================================================
// Mettre à true pour afficher les logs de debug dans la console
const DEBUG = true;

// Utilitaire de debug
function log(...args) {
  if (DEBUG) console.log('[PROUT]', ...args);
}

function logError(...args) {
  console.error('[ERREUR]', ...args);
}

// =================================================================
// ÉTAT GLOBAL DU JEU
// =================================================================
const etat = {
  // --- Connexion ---
  mode: null,           // 'multi-hote' | 'multi-invite' | null
  peer: null,           // Instance PeerJS
  connexion: null,      // Connexion PeerJS vers l'autre joueur
  codePartie: null,     // Code unique de la partie (6 chars)
  enLigne: false,       // Suis-je connecté à un adversaire ?
  
  // --- Joueur local ---
  jauge: 0,             // Jauge prout (0-100)
  conscience: 100,      // Conscience (0-100)
  jaugeInterval: null,  // Timer pour l'auto-incrément de la jauge
  
  // --- Adversaire ---
  jaugeAdverse: 0,
  conscienceAdverse: 100,
  
  // --- Pseudos ---
  pseudoLocal: '',      // Pseudo du joueur local
  pseudoAdverseNom: '', // Pseudo de l'adversaire (pour affichage)
  
  // --- Partie ---
  partieFinie: false,
  victoire: false,      // true si le joueur local a gagné
  enAttenteRematch: false, // true si on attend que l'adversaire accepte de rejouer
  partieLancee: false,  // Flag anti-double appel de demarrerPartieMulti()
};

// =================================================================
// RÉFÉRENCES DOM (mises en cache après chargement)
// =================================================================
const DOM = {};

function initialiserRefsDOM() {
  DOM.screenAccueil = document.getElementById('screen-accueil');
  DOM.screenJeu = document.getElementById('screen-jeu');
  DOM.zoneCode = document.getElementById('zone-code');
  DOM.codeLabel = document.getElementById('code-label');
  DOM.codeAffiche = document.getElementById('code-affiche');
  DOM.codeInputGroup = document.getElementById('code-input-group');
  DOM.codeInput = document.getElementById('code-input');
  DOM.btnValiderCode = document.getElementById('btn-valider-code');
  DOM.btnAnnulerCode = document.getElementById('btn-annuler-code');
  DOM.attenteMsg = document.getElementById('attente-msg');
  DOM.statusMsg = document.getElementById('status-msg');
  DOM.btnCreer = document.getElementById('btn-creer');
  DOM.btnRejoindre = document.getElementById('btn-rejoindre');
  DOM.btnQuitter = document.getElementById('btn-quitter');
  DOM.btnDebug = document.getElementById('btn-debug');
  DOM.btnProut = document.getElementById('btn-prout');
  DOM.btnRejouer = document.getElementById('btn-rejouer');
  DOM.btnMenu = document.getElementById('btn-menu');
  DOM.indicateurTour = document.getElementById('indicateur-tour');
  
  // Barres locales
  DOM.conscienceLocalBar = document.getElementById('conscience-local-bar');
  DOM.conscienceLocalText = document.getElementById('conscience-local-text');
  DOM.jaugeLocalBar = document.getElementById('jauge-local-bar');
  DOM.jaugeLocalText = document.getElementById('jauge-local-text');
  
  // Barres adverses
  DOM.conscienceAdverseBar = document.getElementById('conscience-adverse-bar');
  DOM.conscienceAdverseText = document.getElementById('conscience-adverse-text');
  DOM.jaugeAdverseBar = document.getElementById('jauge-adverse-bar');
  DOM.jaugeAdverseText = document.getElementById('jauge-adverse-text');
  
  // Bonus
  DOM.bonusBtns = {
    1: document.getElementById('bonus-1'),
    2: document.getElementById('bonus-2'),
    3: document.getElementById('bonus-3'),
  };
  
  // Fin de partie
  DOM.ecranFin = document.getElementById('ecran-fin');
  DOM.finTitre = document.getElementById('fin-titre');
  DOM.finSousTitre = document.getElementById('fin-sous-titre');
  
  // Notification
  DOM.notificationZone = document.getElementById('notification-zone');
  DOM.notificationTexte = document.getElementById('notification-texte');
  
  // +++ Personnages +++
  DOM.bulleLocal = document.getElementById('bulle-local');
  DOM.bulleAdverse = document.getElementById('bulle-adverse');
  
  // Overlay
  DOM.overlayChargement = document.getElementById('overlay-chargement');
  
  // Pseudo
  DOM.inputPseudo = document.getElementById('input-pseudo');
  DOM.btnValiderPseudo = document.getElementById('btn-valider-pseudo');
  DOM.pseudoAdverse = document.getElementById('pseudo-adverse');
  
  // Décompte
  DOM.decompteOverlay = document.getElementById('decompte-overlay');
}

// =================================================================
// GESTION DU PSEUDO
// =================================================================
function obtenirPseudo() {
  const pseudo = DOM.inputPseudo ? DOM.inputPseudo.value.trim() : '';
  return pseudo || 'PROUTEUR'; // Valeur par défaut
}

function sauvegarderPseudo() {
  const pseudo = obtenirPseudo();
  etat.pseudoLocal = pseudo;
  // Optionnel : sauvegarder dans localStorage pour le prochain chargement
  try {
    localStorage.setItem('prout_pseudo', pseudo);
  } catch(e) {}
}

function chargerPseudo() {
  try {
    const saved = localStorage.getItem('prout_pseudo');
    if (saved && DOM.inputPseudo) {
      DOM.inputPseudo.value = saved;
    }
  } catch(e) {}
}

/**
 * Valide le pseudo : le sauvegarde et donne un feedback visuel.
 */
function validerPseudo() {
  const pseudo = obtenirPseudo();
  sauvegarderPseudo();
  if (DOM.btnValiderPseudo) {
    DOM.btnValiderPseudo.classList.add('valide');
    DOM.btnValiderPseudo.textContent = '✅';
    setTimeout(() => {
      DOM.btnValiderPseudo.classList.remove('valide');
    }, 2000);
  }
  log('👤 Pseudo validé :', pseudo);
  return pseudo;
}

// =================================================================
// GÉNÉRATION DE CODE UNIQUE (6 caractères)
// =================================================================
function genererCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sans I,O,0,1 pour éviter confusions
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// =================================================================
// GESTION DES ÉCRANS
// =================================================================
function afficherEcran(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const ecran = document.getElementById(id);
  if (ecran) ecran.classList.add('active');
}

// =================================================================
// GESTION DU STATUS MESSAGE
// =================================================================
let statusTimer = null;

function afficherStatus(texte, type = 'info') {
  if (statusTimer) clearTimeout(statusTimer);
  DOM.statusMsg.textContent = texte;
  DOM.statusMsg.className = 'status-msg ' + type;
  DOM.statusMsg.classList.remove('masquee');
  
  statusTimer = setTimeout(() => {
    DOM.statusMsg.classList.add('masquee');
  }, 5000);
}

// =================================================================
// NOTIFICATIONS D'ATTAQUE (animation à l'écran)
// =================================================================
function afficherNotification(texte, duree = 2000) {
  DOM.notificationTexte.textContent = texte;
  DOM.notificationZone.classList.remove('masquee');
  
  setTimeout(() => {
    DOM.notificationZone.classList.add('masquee');
  }, duree);
}

// =================================================================
// +++ GESTION DES EXPRESSIONS FACIALES +++
// =================================================================

/**
 * Chemins des images des personnages (anciens SVG conservés)
 */
// +++ NOUVELLES IMAGES PNG +++
const IMAGES_PNG = {
  idle:   'images/character_idle.png',
  prepare:'images/character_prepare.png',
  basic:  'images/character_basic_fart.png',
  after:  'images/character_after_fart.png',
  skill1: 'images/character_skill_medium.png',
  skill2: 'images/character_skill_super.png',
  skill3: 'images/character_skill_mega.png',
};

// +++ GESTION AUDIO +++
const AUDIO = {
  base: [],    // base1.mp3 à base4.mp3
  comp: [],    // comp1.mp3 à comp3.mp3
};

// Précharger tous les sons
function prechargerSons() {
  for (let i = 1; i <= 4; i++) {
    const audio = new Audio(`sounds/base${i}.mp3`);
    audio.load();
    AUDIO.base.push(audio);
  }
  for (let i = 1; i <= 3; i++) {
    const audio = new Audio(`sounds/comp${i}.mp3`);
    audio.load();
    AUDIO.comp.push(audio);
  }
  log('🔊 Sons préchargés :', AUDIO.base.length + ' base, ' + AUDIO.comp.length + ' compétences');
}

/**
 * Joue un son de pet aléatoire parmi base1-4.
 */
function jouerSonBase() {
  const index = Math.floor(Math.random() * AUDIO.base.length);
  const son = AUDIO.base[index];
  if (son) {
    son.currentTime = 0;
    son.play().catch(() => {}); // ignorer les erreurs (autoplay bloqué)
  }
}

/**
 * Joue le son d'une compétence (1, 2 ou 3).
 */
function jouerSonCompetence(niveau) {
  if (niveau < 1 || niveau > 3) return;
  const son = AUDIO.comp[niveau - 1];
  if (son) {
    son.currentTime = 0;
    son.play().catch(() => {});
  }
}

/**
 * Durée de l'expression "spéciale" (en ms)
 */

/**
 * Secoue le personnage d'un côté (quand il subit des dégâts).
 * @param {'local'|'adverse'} cote 
 */
function secouerPersonnage(cote) {
  // Secouer le PNG principal (characterImg)
  const img = document.getElementById('characterImg');
  if (!img) return;
  
  img.classList.remove('shake');
  void img.offsetWidth; // Forcer le reflow
  img.classList.add('shake');
  
  // Nettoyer après l'animation
  setTimeout(() => {
    img.classList.remove('shake');
  }, 500);
}

/**
 * Anime le personnage qui attaque (se jette en avant).
 * @param {'local'|'adverse'} cote 
 */
function animerAttaque(cote) {
  const img = cote === 'local' ? DOM.personnageLocal : DOM.personnageAdverse;
  if (!img) return;
  
  img.classList.remove('attaque');
  void img.offsetWidth;
  img.classList.add('attaque');
  
  setTimeout(() => {
    img.classList.remove('attaque');
  }, 600);
}

/**
 * Affiche une bulle de parole temporaire au-dessus du personnage.
 * @param {'local'|'adverse'} cote
 * @param {string} texte - Le texte/emoji à afficher
 * @param {number} duree - Durée en ms
 */
function afficherBulle(cote, texte, duree = 1500) {
  const bulle = cote === 'local' ? DOM.bulleLocal : DOM.bulleAdverse;
  if (!bulle) return;
  
  bulle.textContent = texte;
  bulle.classList.remove('masquee');
  
  setTimeout(() => {
    bulle.classList.add('masquee');
  }, duree);
}

/**
 * Ajoute une icône d'événement dans la pile (max 3).
 * @param {string} emoji - L'emoji à afficher
 * @param {number} duree - Durée d'affichage en ms
 */
function ajouterIconeEvenement(emoji, duree = 2500) {
  const pile = document.getElementById('pile-icones');
  if (!pile) return;
  
  // Créer l'icône
  const icone = document.createElement('div');
  icone.className = 'icone-evenement';
  icone.textContent = emoji;
  
  // Si déjà 3 icônes, supprimer la plus ancienne (dernière) sans attendre
  if (pile.children.length >= 3) {
    const dernier = pile.lastChild;
    if (dernier) dernier.remove();
  }
  
  // Ajouter en premier
  pile.insertBefore(icone, pile.firstChild);
  
  // Programmer la suppression
  setTimeout(() => {
    if (icone.parentNode) {
      icone.classList.add('sortie');
      setTimeout(() => {
        if (icone.parentNode) icone.remove();
      }, 300);
    }
  }, duree);
}

// =================================================================
// +++ FONCTIONS D'ANIMATION AVEC LES NOUVELLES IMAGES PNG +++
// =================================================================

/**
 * Change l'image du personnage principal selon l'état.
 * @param {'idle'|'prepare'|'basic'|'after'|'skill1'|'skill2'|'skill3'} state
 */
function setCharacterImage(state) {
  const img = document.getElementById('characterImg');
  if (!img) return;
  const src = IMAGES_PNG[state];
  if (!src) {
    log(`⚠️ Image PNG inconnue: ${state}`);
    return;
  }
  
  // Petite animation de fondu entre les images
  img.classList.remove('fade-change');
  void img.offsetWidth;
  img.classList.add('fade-change');
  
  img.src = src;
  img.alt = state;
  log(`🖼️ Character PNG → ${state}`);
}

/**
 * Animation du pet classique : 'basic' puis retour 'idle' après 300ms.
 */
function animateBasicFart() {
  setCharacterImage('basic');
  setTimeout(() => {
    setCharacterImage('idle');
  }, 300);
}

/**
 * Animation d'une compétence : séquence complète prepare → action → after → idle.
 * @param {number} skillLevel - Niveau de compétence (1, 2 ou 3)
 */
function animateSkill(skillLevel) {
  const skillKey = 'skill' + skillLevel;
  
  // Étape 1 : préparation (400ms)
  setCharacterImage('prepare');
  
  setTimeout(() => {
    // Étape 2 : action (500ms)
    setCharacterImage(skillKey);
  }, 400);
  
  setTimeout(() => {
    // Étape 3 : soulagé (400ms)
    setCharacterImage('after');
  }, 400 + 500);
  
  setTimeout(() => {
    // Étape 4 : retour au calme
    setCharacterImage('idle');
  }, 400 + 500 + 400);
}

/**
 * Déclenche un flash de couleur sur l'écran de jeu.
 * @param {string} couleur - Classe CSS (flash-vert, flash-rouge, etc.)
 * @param {number} duree - Durée avant retrait (ms)
 */
function flasherEcran(couleur = 'flash-vert', duree = 1000) {
  const ecran = document.getElementById('screen-jeu');
  if (!ecran) return;
  ecran.classList.remove('flash-vert', 'flash-rouge');
  void ecran.offsetWidth;
  ecran.classList.add(couleur);
  setTimeout(() => {
    ecran.classList.remove(couleur);
  }, duree);
}

/**
 * Déclenche un tremblement d'écran proportionnel à l'intensité.
 * @param {number} intensite - 1 (faible), 2 (moyen), 3 (fort)
 */
function tremblerEcran(intensite = 1) {
  const ecran = document.getElementById('screen-jeu');
  if (!ecran) return;
  
  let classe = 'shake-ecran-faible';
  let duree = 800;
  
  if (intensite === 2) {
    classe = 'shake-ecran-moyen';
    duree = 1000;
  } else if (intensite >= 3) {
    classe = 'shake-ecran-fort';
    duree = 1200;
  }
  
  ecran.classList.remove('shake-ecran-faible', 'shake-ecran-moyen', 'shake-ecran-fort');
  void ecran.offsetWidth;
  ecran.classList.add(classe);
  
  setTimeout(() => {
    ecran.classList.remove(classe);
  }, duree);
}

/**
 * Met le personnage en état "mort" (définitif).
 * @param {'local'|'adverse'} cote 
 */
function mettrePersonnageMort(cote) {
  const img = document.getElementById('characterImg');
  if (img) {
    img.classList.add('dead');
    setCharacterImage('idle');
  }
}

// =================================================================
// MISE À JOUR VISUELLE DES BARRES
// =================================================================
function mettreAJourBarres() {
  // --- Joueur local ---
  // Conscience
  const conPct = etat.conscience;
  DOM.conscienceLocalBar.style.width = conPct + '%';
  DOM.conscienceLocalText.textContent = Math.round(conPct) + '%';
  // Couleur dynamique : vert > 60%, orange 30-60%, rouge < 30%
  if (conPct > 60) {
    DOM.conscienceLocalBar.style.background = '#2E7D32';
  } else if (conPct > 30) {
    DOM.conscienceLocalBar.style.background = '#EF6C00';
  } else {
    DOM.conscienceLocalBar.style.background = '#C62828';
  }
  
  // Jauge
  const jauPct = etat.jauge;
  DOM.jaugeLocalBar.style.width = jauPct + '%';
  DOM.jaugeLocalText.textContent = Math.round(jauPct) + '%';
  
  // Effet bouillon si jauge non vide (animation de fumée renforcée)
  if (jauPct > 0) {
    DOM.jaugeLocalBar.classList.add('active');
  } else {
    DOM.jaugeLocalBar.classList.remove('active');
  }
  
  // --- Adversaire ---
  // Conscience adverse
  const conAdvPct = etat.conscienceAdverse;
  DOM.conscienceAdverseBar.style.width = conAdvPct + '%';
  DOM.conscienceAdverseText.textContent = Math.round(conAdvPct) + '%';
  if (conAdvPct > 60) {
    DOM.conscienceAdverseBar.style.background = '#2E7D32';
  } else if (conAdvPct > 30) {
    DOM.conscienceAdverseBar.style.background = '#EF6C00';
  } else {
    DOM.conscienceAdverseBar.style.background = '#C62828';
  }
  
  // Jauge adverse
  DOM.jaugeAdverseBar.style.width = etat.jaugeAdverse + '%';
  DOM.jaugeAdverseText.textContent = Math.round(etat.jaugeAdverse) + '%';
  
  // +++ Mise à jour des expressions faciales +++
  
  // --- Mise à jour des bonus ---
  mettreAJourBonus();
}

// =================================================================
// GESTION DES BONUS (activation/désactivation visuelle)
// =================================================================
const BONUS_CONFIG = [
  { id: 1, cout: 25, degats: 5 },
  { id: 2, cout: 50, degats: 12 },
  { id: 3, cout: 75, degats: 25 },
];

function mettreAJourBonus() {
  if (etat.partieFinie) {
    Object.values(DOM.bonusBtns).forEach(btn => btn.disabled = true);
    return;
  }
  
  BONUS_CONFIG.forEach(config => {
    const btn = DOM.bonusBtns[config.id];
    if (!btn) return;
    const actif = etat.jauge >= config.cout;
    btn.disabled = !actif;
  });
}

// =================================================================
// ACTION : CLIC SUR PROUT
// =================================================================
function clicProut() {
  if (etat.partieFinie) return;
  
  if (etat.jauge < 100) {
    const gain = Math.min(5, 100 - etat.jauge);
    etat.jauge += gain;
    log('💨 Clic PROUT ! Jauge: +5% →', etat.jauge + '%');
    
    // +++ Animation : pet classique PNG +++
    animateBasicFart();
    ajouterIconeEvenement('💨', 1200);
    jouerSonBase(); // 🔊 Son aléatoire base1-4
    
    // Envoyer l'animation du pet à l'adversaire
    if (etat.enLigne && etat.connexion) {
      envoyerMessage({ type: 'ANIMATE_BASIC' });
    }
    
    mettreAJourBarres();
    
    // Envoyer synchro si en ligne
    if (etat.enLigne && etat.connexion) {
      envoyerMessage({ type: 'SYNC_JAUGE', jauge: etat.jauge });
    }
  }
}

// =================================================================
// ACTION : LANCER UN BONUS
// =================================================================
function lancerBonus(idBonus) {
  if (etat.partieFinie) return;
  
  const config = BONUS_CONFIG.find(b => b.id === idBonus);
  if (!config) return;
  
  if (etat.jauge < config.cout) {
    log(`❌ Bonus ${idBonus} : pas assez de jauge (${etat.jauge}% < ${config.cout}%)`);
    return;
  }
  
  // Consommer la jauge
  etat.jauge -= config.cout;
  log(`🎯 Lance bonus ${idBonus} : coût ${config.cout}%, dégâts ${config.degats}%`);
  
  // +++ Animation PNG : compétence selon le niveau +++
  const skillLevel = idBonus; // bonus 1 → skill1, bonus 2 → skill2, bonus 3 → skill3
  animateSkill(skillLevel);
  jouerSonCompetence(skillLevel); // 🔊 Son comp1/2/3 selon niveau
  
  // +++ Animation SVG : personnage local attaque +++
  animerAttaque('local');
  ajouterIconeEvenement('💨💥', 2000); // reste affiché durant toute l'animation + un peu
  
  // +++ Tremblement d'écran selon la puissance +++
  tremblerEcran(skillLevel);
  
  // Envoyer l'animation de compétence à l'adversaire
  if (etat.enLigne && etat.connexion) {
    envoyerMessage({ type: 'ANIMATE_SKILL', level: skillLevel });
  }
  
  // Infliger les dégâts
  const degatsReels = infligerDegatsAdverse(config.degats);
  
  // +++ Animation : le personnage adverse subit +++
  secouerPersonnage('adverse');
  
  // Changer expression adverse selon les dégâts reçus
  if (etat.conscienceAdverse <= 0) {
    mettrePersonnageMort('adverse');
  }
  afficherBulle('adverse', '💢', 1200);
  
  // Notification visuelle
  const nomBonus = config.id === 1 ? 'Pet léger' : config.id === 2 ? 'Pet toxique' : 'Mégapet nucléaire';
  afficherNotification(`💨 ${nomBonus} ! -${degatsReels}% 💨`);
  
  // Effet sur le bouton
  const btn = DOM.bonusBtns[idBonus];
  if (btn) {
    btn.style.transform = 'scale(0.9)';
    setTimeout(() => { if (btn) btn.style.transform = ''; }, 200);
  }
  
  // Envoyer l'attaque si en ligne
  if (etat.enLigne && etat.connexion) {
    envoyerMessage({
      type: 'ATTAQUE',
      cout: config.cout,
      degats: degatsReels,
      jaugeApres: etat.jauge,
    });
  }
  
  mettreAJourBarres();
  
  // Vérifier victoire
  verifierVictoire();
}

/**
 * Inflige des dégâts à l'adversaire.
 * @param {number} degats 
 * @returns {number} Dégâts réellement infligés
 */
function infligerDegatsAdverse(degats) {
  const avant = etat.conscienceAdverse;
  etat.conscienceAdverse = Math.max(0, etat.conscienceAdverse - degats);
  const degatsReels = avant - etat.conscienceAdverse;
  log(`💥 Dégâts adverses : -${degatsReels}% (conscience: ${etat.conscienceAdverse}%)`);
  return degatsReels;
}

// =================================================================
// VÉRIFICATION VICTOIRE / PERDUE
// =================================================================
function verifierVictoire() {
  // Victoire locale ?
  if (etat.conscienceAdverse <= 0 && !etat.partieFinie) {
    etat.partieFinie = true;
    etat.victoire = true;
    log('🎉 VICTOIRE !');
    arreterCyclesJauge();
    
    // +++ Animation de fin +++
    mettrePersonnageMort('adverse');
    afficherBulle('local', '🏆', 3000);
    afficherBulle('adverse', '💀', 3000);
    
    afficherFin('🎉 VICTOIRE ! 🎉', 'Tu as explosé la conscience de ton adversaire ! 💨');
    
    if (etat.enLigne && etat.connexion) {
      envoyerMessage({ type: 'VICTOIRE' });
    }
    return;
  }
  
  // Défaite locale ?
  if (etat.conscience <= 0 && !etat.partieFinie) {
    etat.partieFinie = true;
    etat.victoire = false;
    log('💀 DÉFAITE...');
    arreterCyclesJauge();
    
    // +++ Animation de fin +++
    mettrePersonnageMort('local');
    afficherBulle('local', '💀', 3000);
    afficherBulle('adverse', '🏆', 3000);
    
    afficherFin('💀 PERDU... 💀', 'Ta conscience a été réduite à néant ! 🧻');
    
    if (etat.enLigne && etat.connexion) {
      envoyerMessage({ type: 'DEFAITE' });
    }
    return;
  }
}

/**
 * Affiche l'écran de fin de partie.
 */
function afficherFin(titre, sousTitre) {
  DOM.finTitre.textContent = titre;
  DOM.finSousTitre.textContent = sousTitre;
  
  // Ajouter la couleur selon victoire/défaite
  DOM.finTitre.classList.remove('victoire', 'defaite');
  if (etat.victoire) {
    DOM.finTitre.classList.add('victoire');
  } else {
    DOM.finTitre.classList.add('defaite');
  }
  
  DOM.ecranFin.classList.remove('masquee');
}

// =================================================================
// CYCLES DE JEU (jauge auto)
// =================================================================
function demarrerCycleJauge() {
  arreterCyclesJauge(); // Nettoyage préventif
  etat.jaugeInterval = setInterval(() => {
    if (etat.partieFinie) return;
    
    if (etat.jauge < 100) {
      etat.jauge = Math.min(100, etat.jauge + 1);
      log('⏰ Jauge auto: +1% →', etat.jauge + '%');
      mettreAJourBarres();
      
      // Synchro si en ligne
      if (etat.enLigne && etat.connexion) {
        envoyerMessage({ type: 'SYNC_JAUGE', jauge: etat.jauge });
      }
    }
  }, 2000); // +1% toutes les 2 secondes
}

function arreterCyclesJauge() {
  if (etat.jaugeInterval) {
    clearInterval(etat.jaugeInterval);
    etat.jaugeInterval = null;
  }
}

// =================================================================
// PEERJS - GESTION DE LA CONNEXION
// =================================================================
/**
 * Crée une partie (hôte).
 * Génère un code, initialise PeerJS, attend la connexion.
 */
async function creerPartie() {
  log('🎮 Création d\'une partie...');
  etat.mode = 'multi-hote';
  
  const code = genererCode();
  etat.codePartie = code;
  log('Code généré:', code);
  
  // Afficher le code
  DOM.codeAffiche.textContent = code;
  DOM.codeAffiche.style.display = ''; // réafficher le grand code
  DOM.codeLabel.textContent = '🔑 Code de la partie :';
  DOM.codeInputGroup.classList.add('masquee');
  DOM.attenteMsg.classList.remove('masquee');
  DOM.zoneCode.classList.remove('masquee');
  
  afficherStatus('En attente d\'un adversaire...', 'info');
  
  // Cacher les boutons du menu
  const accueilBoutons = document.getElementById('accueil-boutons');
  if (accueilBoutons) accueilBoutons.style.display = 'none';
  
  // Initialiser PeerJS
  try {
    initialiserPeer(code);
  } catch (err) {
    logError('Erreur création PeerJS:', err);
    afficherStatus('Erreur de connexion. Vérifie ta connexion internet.', 'erreur');
  }
}

/**
 * Rejoint une partie existante.
 */
async function rejoindrePartie(code) {
  if (!code || code.length !== 6) {
    afficherStatus('Le code doit faire 6 caractères.', 'erreur');
    return;
  }
  
  log('🔗 Rejoint partie:', code);
  etat.mode = 'multi-invite';
  etat.codePartie = code;
  
  DOM.overlayChargement.classList.remove('masquee');
  
  try {
    // L'invité crée un Peer avec un ID aléatoire
    const monId = 'joueur_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    initialiserPeer(monId, code);
  } catch (err) {
    logError('Erreur création PeerJS:', err);
    afficherStatus('Erreur de connexion. Vérifie ta connexion internet.', 'erreur');
    DOM.overlayChargement.classList.add('masquee');
  }
}

/**
 * Initialise la connexion PeerJS.
 * @param {string} monId - L'ID de ce pair
 * @param {string|null} codeAdverse - Si on rejoint, le code de l'autre
 */
function initialiserPeer(monId, codeAdverse = null) {
  // Nettoyer l'ancien peer
  if (etat.peer) {
    etat.peer.destroy();
    etat.peer = null;
  }
  
  // Options PeerJS avec serveurs STUN/TURN pour traverser les NAT
  const peerOptions = {
    debug: DEBUG ? 2 : 0,
    config: {
      iceServers: [
        // Serveurs STUN Google
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Serveur TURN public (pour traverser les NAT stricts en 4G)
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
        {
          urls: 'turns:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    },
  };
  
  const peer = new Peer(monId, peerOptions);
  etat.peer = peer;
  
  peer.on('open', (id) => {
    log('✅ PeerJS ouvert avec ID:', id);
    
    if (codeAdverse) {
      // Mode invité : se connecter à l'hôte
      log('🔌 Connexion au pair:', codeAdverse);
      
      // Afficher le statut
      afficherStatus('🔄 Connexion à l\'adversaire...', 'info');
      
      const conn = peer.connect(codeAdverse, {
        reliable: true,
        serialization: 'json',
      });
      gererConnexion(conn);
      
      // +++ Timeout : si pas connecté après 12 secondes, annuler +++
      setTimeout(() => {
        if (!etat.enLigne) {
          logError('⏱️ Timeout connexion PeerJS');
          DOM.overlayChargement.classList.add('masquee');
          afficherStatus('⏱️ Connexion impossible. Vérifie le code ou que l\'autre joueur est bien en ligne.', 'erreur');
          if (conn && conn.open === false) {
            try { conn.close(); } catch(e) {}
          }
          etat.mode = null;
        }
      }, 12000);
    }
  });
  
  // L'hôte écoute les connexions entrantes
  peer.on('connection', (conn) => {
    log('📞 Connexion entrante détectée !');
    gererConnexion(conn);
  });
  
  peer.on('error', (err) => {
    logError('Erreur PeerJS:', err);
    if (!etat.enLigne && etat.mode === 'multi-invite') {
      DOM.overlayChargement.classList.add('masquee');
      afficherStatus('Erreur : ' + err.message, 'erreur');
    }
  });
  
  peer.on('disconnected', () => {
    log('⚠️ PeerJS déconnecté');
    if (etat.enLigne && !etat.partieFinie) {
      afficherStatus('Connexion perdue avec l\'adversaire.', 'erreur');
    }
  });
}

/**
 * Configure une connexion PeerJS.
 */
function gererConnexion(conn) {
  etat.connexion = conn;
  
  conn.on('open', () => {
    log('🔗 Connexion établie !');
    etat.enLigne = true;
    DOM.overlayChargement.classList.add('masquee');
    
    // L'invité envoie un BONJOUR avec son état initial + pseudo
    if (etat.mode === 'multi-invite') {
      const monPseudo = obtenirPseudo();
      envoyerMessage({
        type: 'BONJOUR',
        jauge: etat.jauge,
        conscience: etat.conscience,
        pseudo: monPseudo,
      });
    }
    
    // Les deux joueurs démarrent la partie dès que la connexion est ouverte
    demarrerPartieMulti();
  });
  
  conn.on('data', (data) => {
    recevoirMessage(data);
  });
  
  conn.on('close', () => {
    log('🔌 Connexion fermée');
    etat.enLigne = false;
    if (!etat.partieFinie) {
      afficherNotification('🚪 L\'adversaire a quitté la partie !', 3000);
      arreterCyclesJauge();
      etat.partieFinie = true;
      // Ne pas afficher victoire/défaite, juste un message
      afficherFin('🚪 Partie terminée', 'L\'adversaire s\'est déconnecté.');
    }
  });
  
  conn.on('error', (err) => {
    logError('Erreur connexion:', err);
    afficherStatus('Erreur de connexion avec l\'adversaire.', 'erreur');
  });
}

// =================================================================
// ENVOI / RÉCEPTION DE MESSAGES
// =================================================================
function envoyerMessage(data) {
  if (etat.connexion && etat.connexion.open) {
    try {
      etat.connexion.send(data);
    } catch (err) {
      logError('Erreur envoi message:', err);
    }
  }
}

function recevoirMessage(data) {
  log('📩 Message reçu:', data);
  
  switch (data.type) {
    case 'BONJOUR':
      // L'invité envoie son état initial + pseudo
      etat.jaugeAdverse = data.jauge || 0;
      etat.conscienceAdverse = data.conscience || 100;
      etat.pseudoAdverseNom = data.pseudo || 'INVITÉ';
      log('👋 Adversaire connecté :', etat.pseudoAdverseNom);
      afficherStatus(`✅ ${etat.pseudoAdverseNom} est connecté !`, 'succes');
      mettreAJourPseudos();
      // L'hôte reçoit BONJOUR → démarre la partie (si pas déjà fait via conn.on('open'))
      if (etat.mode === 'multi-hote') {
        demarrerPartieMulti();
      }
      break;
      
    case 'PRET':
      log('📩 Adversaire PRÊT ! Pseudo:', data.pseudo);
      if (data.pseudo) {
        etat.pseudoAdverseNom = data.pseudo;
        mettreAJourPseudos();
      }
      // L'adversaire est prêt → on lance le décompte
      lancerDecompte();
      break;
      
    case 'SYNC_JAUGE':
      etat.jaugeAdverse = data.jauge;
      mettreAJourBarres();
      break;
      
        case 'ANIMATE_BASIC':
    // L'adversaire a fait un pet classique → rien côté local (son + anim côté lanceur uniquement)
    break;
      
    case 'ANIMATE_SKILL':
    // L'adversaire lance une compétence → rien côté local
    break;
      
    case 'ATTAQUE':
    // L'adversaire nous attaque
    etat.conscience -= data.degats;
      etat.conscience = Math.max(0, etat.conscience);
      // Mettre à jour sa jauge post-attaque
      etat.jaugeAdverse = data.jaugeApres || (etat.jaugeAdverse - data.cout);
      log(`💥 Attaque subie : -${data.degats}% conscience`);
      
      // +++ Animation : personnage adverse attaque (vu de notre côté) +++
      animerAttaque('adverse');
      ajouterIconeEvenement('💨💥', 2000);
      flasherEcran('flash-vert', 800); // ✨ Flash vert : on subit une attaque
      
      // Animation PNG : nous subissons → after (soulagé/surprise)
      setCharacterImage('after');
      setTimeout(() => { setCharacterImage('idle'); }, 600);
      
      // Animation SVG : nous subissons
      secouerPersonnage('local');
      
      // +++ Tremblement d'écran selon les dégâts +++
      const intShake = data.degats === 5 ? 1 : data.degats === 12 ? 2 : 3;
      tremblerEcran(intShake);
      
      if (etat.conscience <= 0) {
        mettrePersonnageMort('local');
      }
      afficherBulle('local', '💢', 1200);
      
      mettreAJourBarres();
      
      // Notification
      const nomAttaque = data.degats === 5 ? 'Pet léger' : data.degats === 12 ? 'Pet toxique' : 'Mégapet nucléaire';
      afficherNotification(`💨 ${nomAttaque} adverse ! -${data.degats}% 💨`);
      
      verifierVictoire();
      break;
      
    case 'VICTOIRE':
      // L'adversaire annonce sa victoire → nous avons perdu
      if (!etat.partieFinie) {
        etat.partieFinie = true;
        etat.victoire = false;
        arreterCyclesJauge();
        afficherFin('💀 PERDU... 💀', 'Ton adversaire a gagné !');
      }
      break;
      
    case 'DEFAITE':
      // L'adversaire annonce sa défaite → nous avons gagné
      if (!etat.partieFinie) {
        etat.partieFinie = true;
        etat.victoire = true;
        arreterCyclesJauge();
        afficherFin('🎉 VICTOIRE ! 🎉', 'Tu as explosé la conscience de ton adversaire ! 💨');
      }
      break;
      
    case 'REMATCH':
      // L'adversaire veut rejouer
      log('🔄 Adversaire demande un rematch');
      
      // Si on attendait aussi un rematch → go !
      if (etat.enAttenteRematch) {
        etat.enAttenteRematch = false;
        etat.partieLancee = false; // Permettre le redémarrage
        DOM.overlayChargement.querySelector('p').textContent = 'Connexion en cours...';
        DOM.overlayChargement.classList.add('masquee');
        DOM.ecranFin.classList.add('masquee');
        demarrerPartieMulti();
        break;
      }
      
      // Sinon, on est encore sur l'écran de fin : on lance direct
      if (etat.partieFinie) {
        etat.partieLancee = false; // Permettre le redémarrage
        DOM.ecranFin.classList.add('masquee');
        demarrerPartieMulti();
      }
      break;
      
    default:
      log('⚠️ Type de message inconnu:', data.type);
  }
}

// =================================================================
// DÉMARRER LA PARTIE (multi)
// =================================================================
function demarrerPartieMulti() {
  if (etat.partieLancee) return;
  etat.partieLancee = true;
  
  log('🚀 Démarrage partie multijoueur...');
  
  // Nettoyer tout
  arreterCyclesJauge();
  const pile = document.getElementById('pile-icones');
  if (pile) pile.innerHTML = '';
  
  // Réinitialiser l'état
  etat.jauge = 0;
  etat.conscience = 100;
  etat.jaugeAdverse = 0;
  etat.conscienceAdverse = 100;
  etat.partieFinie = false;
  etat.victoire = false;
  etat.enAttenteRematch = false;
  
  log('=== NOUVELLE PARTIE MULTI ===');
  
  // Barres DOM à 0
  if (DOM.jaugeLocalBar) DOM.jaugeLocalBar.style.width = '0%';
  if (DOM.jaugeLocalText) DOM.jaugeLocalText.textContent = '0%';
  if (DOM.conscienceLocalBar) DOM.conscienceLocalBar.style.width = '100%';
  if (DOM.conscienceLocalText) DOM.conscienceLocalText.textContent = '100%';
  if (DOM.jaugeAdverseBar) DOM.jaugeAdverseBar.style.width = '0%';
  if (DOM.jaugeAdverseText) DOM.jaugeAdverseText.textContent = '0%';
  if (DOM.conscienceAdverseBar) DOM.conscienceAdverseBar.style.width = '100%';
  if (DOM.conscienceAdverseText) DOM.conscienceAdverseText.textContent = '100%';
  
  // Cacher écrans (sécurisé)
  if (DOM.ecranFin) DOM.ecranFin.classList.add('masquee');
  if (DOM.zoneCode) DOM.zoneCode.classList.add('masquee');
  
  // Afficher jeu
  afficherEcran('screen-jeu');
  if (DOM.indicateurTour) DOM.indicateurTour.classList.add('masquee');
  
  // Barres
  mettreAJourBarres();
  setCharacterImage('idle');
  
  // Pseudos
  mettreAJourPseudos();
  
  // Désactiver les boutons de jeu
  if (DOM.btnProut) DOM.btnProut.disabled = true;
  Object.values(DOM.bonusBtns).forEach(btn => { if (btn) btn.disabled = true; });
  
  // === ÉCRAN "PRÊT" AVANT LE DÉCOMPTE ===
  // Afficher un message "En attente..." dans le décompte overlay
  const decoEl = DOM.decompteOverlay;
  if (decoEl) {
    decoEl.classList.remove('masquee');
    decoEl.innerHTML = '<div class="decompte-texte">👀 EN ATTENTE DE L\'ADVERSAIRE...</div>';
  }
  
  // Notre joueur est prêt : envoyer PRET à l'adversaire
  if (etat.connexion) {
    log('📤 Envoi PRET à l\'adversaire');
    envoyerMessage({ type: 'PRET', pseudo: etat.pseudoLocal });
  }
  
  // Si l'adversaire est déjà prêt (on a reçu BONJOUR avant d'appeler demarrerPartieMulti)
  // ça ne devrait pas arriver mais on sécurise
  if (etat.jaugeAdverse > 0 && etat.conscienceAdverse < 100) {
    // On a déjà reçu BONJOUR, l'adversaire est connecté
    log('📩 Adversaire déjà connecté, on attend son PRET...');
  }
}

/**
 * Met à jour l'affichage des pseudos dans le jeu.
 */
function mettreAJourPseudos() {
  const local = etat.pseudoLocal || 'TOI';
  const adverse = etat.pseudoAdverseNom || 'ADVERSAIRE';
  DOM.pseudoAdverse.textContent = `👤 ${adverse}`;
}

/**
 * Lance le décompte de 5 secondes avant le début de la partie.
 * Appelé quand les deux joueurs sont prêts.
 */
function lancerDecompte() {
  console.log('%c⏳ DÉCOMPTE 5 secondes !', 'font-size:24px; color:gold;');
  
  const decoEl = DOM.decompteOverlay;
  if (!decoEl) {
    console.error('❌ decompteOverlay introuvable dans DOM');
    setTimeout(() => {
      if (DOM.btnProut) DOM.btnProut.disabled = false;
      mettreAJourBonus();
      demarrerCycleJauge();
    }, 1000);
    return;
  }
  
  // Vider l'overlay et l'afficher
  decoEl.innerHTML = '';
  decoEl.classList.remove('masquee');
  
  let compteur = 5;
  let chiffreEl = null;
  
  function tickDecompte() {
    if (compteur > 0) {
      // Couleur : vert → jaune → orange → rouge
      let couleur;
      if (compteur === 5) couleur = '#4CAF50';      // vert
      else if (compteur === 4) couleur = '#8BC34A';  // vert clair
      else if (compteur === 3) couleur = '#FFEB3B';  // jaune
      else if (compteur === 2) couleur = '#FF9800';  // orange
      else couleur = '#F44336';                       // rouge
      
      // Créer l'élément chiffre au premier tick
      if (!chiffreEl) {
        chiffreEl = document.createElement('div');
        chiffreEl.className = 'decompte-chiffre';
        decoEl.appendChild(chiffreEl);
      }
      
      // Forcer la réanimation à chaque tick
      chiffreEl.style.color = couleur;
      chiffreEl.style.textShadow = `0 0 60px ${couleur}, 0 0 120px ${couleur}`;
      chiffreEl.textContent = String(compteur);
      
      // Reset animation
      chiffreEl.style.animation = 'none';
      void chiffreEl.offsetWidth;
      chiffreEl.style.animation = 'decompte-pop 0.6s ease-out';
      
      console.log('⏳ decompte:', compteur);
      compteur--;
      setTimeout(tickDecompte, 1000);
      
    } else {
      // Afficher "LA PARTIE COMMENCE !"
      decoEl.innerHTML = '';
      const texteEl = document.createElement('div');
      texteEl.className = 'decompte-texte';
      texteEl.textContent = '💨 LA PARTIE COMMENCE ! 💨';
      decoEl.appendChild(texteEl);
      console.log('%c⏳ LA PARTIE COMMENCE !', 'font-size:20px; color:lime;');
      
      setTimeout(() => {
        decoEl.innerHTML = '';
        decoEl.classList.add('masquee');
        if (DOM.btnProut) DOM.btnProut.disabled = false;
        mettreAJourBonus();
        demarrerCycleJauge();
        console.log('%c🎮 Partie commencée !', 'font-size:18px; color:cyan;');
      }, 1500);
    }
  }
  
  tickDecompte();
}

// =================================================================
// GESTION DU REMATCH (multi)
// =================================================================
function demanderRematch() {
  if (!etat.enLigne || !etat.connexion) return;
  etat.partieLancee = false; // Permettre un nouveau démarrage
  envoyerMessage({ type: 'REMATCH' });
  DOM.overlayChargement.querySelector('p').textContent = '🔄 En attente de l\'adversaire...';
  DOM.overlayChargement.classList.remove('masquee');
  etat.enAttenteRematch = true;
}

// =================================================================
// QUITTER LA PARTIE
// =================================================================
function quitterPartie() {
  log('🚪 Quitter la partie...');
  
  // Arrêter tout
  arreterCyclesJauge();
  
  // Fermer connexion PeerJS
  if (etat.connexion) {
    try { etat.connexion.close(); } catch(e) {}
    etat.connexion = null;
  }
  if (etat.peer) {
    try { etat.peer.destroy(); } catch(e) {}
    etat.peer = null;
  }
  
  // Réinitialiser l'état
  etat.enLigne = false;
  etat.mode = null;
  etat.codePartie = null;
  etat.jauge = 0;
  etat.conscience = 100;
  etat.jaugeAdverse = 0;
  etat.conscienceAdverse = 100;
  etat.partieFinie = false;
  etat.victoire = false;
  etat.enAttenteRematch = false;
  etat.partieLancee = false;
  
  // Cacher fin et notifications
  DOM.ecranFin.classList.add('masquee');
  DOM.notificationZone.classList.add('masquee');
  DOM.zoneCode.classList.add('masquee');
  DOM.codeAffiche.style.display = '';
  DOM.statusMsg.classList.add('masquee');
  
  // Réafficher les boutons du menu
  const accueilBoutons = document.getElementById('accueil-boutons');
  if (accueilBoutons) accueilBoutons.style.display = '';
  
  // Remettre le texte de l'overlay par défaut
  DOM.overlayChargement.querySelector('p').textContent = 'Connexion en cours...';
  DOM.overlayChargement.classList.add('masquee');
  
  // Retour à l'accueil
  afficherEcran('screen-accueil');
  log('✅ Retour à l\'accueil.');
}

// =================================================================
// BASCULE MODE DEBUG
// =================================================================
function basculerDebug() {
  // Simple : on affiche l'état dans la console
  console.log('=== 🐛 ÉTAT DEBUG ===');
  console.log('Mode:', etat.mode);
  console.log('En ligne:', etat.enLigne);
  console.log('Jauge locale:', etat.jauge + '%');
  console.log('Conscience locale:', etat.conscience + '%');
  console.log('Jauge adverse:', etat.jaugeAdverse + '%');
  console.log('Conscience adverse:', etat.conscienceAdverse + '%');
  console.log('Partie finie:', etat.partieFinie);
  console.log('Victoire:', etat.victoire);
  console.log('Code partie:', etat.codePartie);
  console.log('PeerJS connecté:', !!etat.connexion);
  console.log('=====================');
}

// =================================================================
// INITIALISATION ET ÉCOUTEURS D'ÉVÉNEMENTS
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
  initialiserRefsDOM();
  
  // ---- Écran accueil ----
  // Valider le pseudo
  DOM.btnValiderPseudo.addEventListener('click', validerPseudo);
  
  // Valider le pseudo en appuyant sur Entrée dans le champ
  DOM.inputPseudo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      validerPseudo();
    }
  });
  
  // Créer une partie
  DOM.btnCreer.addEventListener('click', () => {
    validerPseudo(); // Sauvegarder le pseudo avant
    creerPartie();
  });
  
  // Rejoindre une partie
  DOM.btnRejoindre.addEventListener('click', () => {
    validerPseudo(); // Sauvegarder le pseudo avant
    etat.mode = 'multi-invite';
    DOM.codeLabel.textContent = '🔑 Entrer le code :';
    DOM.codeAffiche.textContent = '';
    DOM.codeAffiche.style.display = 'none'; // cacher l'affichage du grand code
    DOM.codeInputGroup.classList.remove('masquee');
    DOM.attenteMsg.classList.add('masquee');
    DOM.zoneCode.classList.remove('masquee');
    DOM.codeInput.value = '';
    DOM.codeInput.focus();
    // Cacher les boutons du menu
    const accueilBoutons = document.getElementById('accueil-boutons');
    if (accueilBoutons) accueilBoutons.style.display = 'none';
  });
  
  // Valider le code de partie
  DOM.btnValiderCode.addEventListener('click', () => {
    const code = DOM.codeInput.value.trim().toUpperCase();
    rejoindrePartie(code);
  });
  
  // Entrée dans le champ code
  DOM.codeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const code = DOM.codeInput.value.trim().toUpperCase();
      rejoindrePartie(code);
    }
  });
  
  // Forcer majuscules dans le champ code
  DOM.codeInput.addEventListener('input', () => {
    DOM.codeInput.value = DOM.codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });
  
  // Annuler la zone code
  DOM.btnAnnulerCode.addEventListener('click', () => {
    DOM.zoneCode.classList.add('masquee');
    DOM.statusMsg.classList.add('masquee');
    DOM.codeAffiche.style.display = ''; // reset
    // Réafficher les boutons du menu
    const accueilBoutons = document.getElementById('accueil-boutons');
    if (accueilBoutons) accueilBoutons.style.display = '';
    etat.mode = null;
  });
  
  // ---- Écran de jeu ----
  // Bouton PROUT
  DOM.btnProut.addEventListener('click', clicProut);
  
  // Boutons bonus
  DOM.bonusBtns[1].addEventListener('click', () => lancerBonus(1));
  DOM.bonusBtns[2].addEventListener('click', () => lancerBonus(2));
  DOM.bonusBtns[3].addEventListener('click', () => lancerBonus(3));
  
  // Quitter
  DOM.btnQuitter.addEventListener('click', quitterPartie);
  
  // Debug
  DOM.btnDebug.addEventListener('click', basculerDebug);
  
  // Fin de partie : menu principal
  DOM.btnMenu.addEventListener('click', quitterPartie);
  
  // Charger le pseudo sauvegardé
  chargerPseudo();
  
  log('✅ PROUT MANAGER initialisé !');
  log('💡 Mode debug:', DEBUG ? 'ACTIVÉ' : 'DÉSACTIVÉ');
  log('🎮 Prêt à jouer !');
  
  // Précharger les sons (ignoré silencieusement si autoplay bloqué)
  prechargerSons();
});
