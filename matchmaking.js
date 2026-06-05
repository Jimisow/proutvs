// =================================================================
// MATCHMAKING - Recherche automatique d'adversaire via Firebase
// =================================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCBaXLYAW3jLwQeL1giuzB3aPlZCWqQNJk",
  authDomain: "proutvs-c593d.firebaseapp.com",
  databaseURL: "https://proutvs-c593d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "proutvs-c593d",
  storageBucket: "proutvs-c593d.firebasestorage.app",
  messagingSenderId: "755127343039",
  appId: "1:755127343039:web:e80292b6e2c2a12aa3b30a",
  measurementId: "G-981WV8XQP6"
};

let dbMatch = null; // Référence Firestore

/**
 * Initialise Firebase Firestore pour le matchmaking.
 */
function initialiserFirestore() {
  if (typeof firebase === 'undefined') {
    console.warn('[MATCHMAKING] Firebase non chargé (CDN peut-être bloqué)');
    etat.firestoreDispo = false;
    return;
  }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    dbMatch = firebase.firestore();
    // Permet les requêtes même sans connexion (cache local)
    dbMatch.settings({ merge: true });
    etat.firestoreDispo = true;
    log('✅ Firebase Firestore prêt pour le matchmaking');
  } catch (err) {
    logError('❌ Erreur init Firebase:', err);
    etat.firestoreDispo = false;
  }
}

// =================================================================
// VARIABLES MATCHMAKING
// =================================================================
let ecouteMatchmaking = null; // Fonction pour arrêter l'écoute Firestore

// =================================================================
// CHERCHER UN ADVERSAIRE
// =================================================================
function chercherAdversaire() {
  validerPseudo();
  
  if (!etat.firestoreDispo) {
    afficherStatus('⚠️ Service de recherche indisponible. Utilise "Créer" ou "Rejoindre".', 'erreur');
    return;
  }
  
  log('🔍 Recherche d\'un adversaire...');
  etat.mode = 'multi-matchmaking';
  etat.annulerMatchmaking = false;
  
  // Afficher l'overlay d'attente avec bouton d'annulation
  DOM.overlayChargement.querySelector('p').textContent = '🔍 Recherche d\'un adversaire...';
  DOM.overlayChargement.classList.remove('masquee');
  if (DOM.btnAnnulerRecherche) {
    DOM.btnAnnulerRecherche.classList.remove('masquee');
    DOM.btnAnnulerRecherche.addEventListener('click', () => {
      nettoyerMatchmaking();
      quitterPartie();
    }, { once: true });
  }
  
  const monPseudo = obtenirPseudo();
  const monId = 'joueur_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  
  // Étape 1 : initialiser PeerJS
  if (etat.peer) {
    try { etat.peer.destroy(); } catch(e) {}
    etat.peer = null;
  }
  
  const peerOptions = {
    debug: DEBUG ? 2 : 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
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
    log('✅ PeerJS ouvert pour matchmaking :', id);
    chercherOuCreerPartie(id, monPseudo);
  });
  
  peer.on('error', (err) => {
    logError('❌ Erreur PeerJS matchmaking:', err);
    DOM.overlayChargement.classList.add('masquee');
    afficherStatus('❌ Erreur de connexion au serveur de matchmaking.', 'erreur');
    if (etat.mode === 'multi-matchmaking') etat.mode = null;
  });
  
  // L'hôte écoute les connexions entrantes
  peer.on('connection', (conn) => {
    log('📞 Connexion entrante (matchmaking)');
    annulerDocMatchmaking();
    gererConnexion(conn);
  });
}

/**
 * Cherche une partie en attente ou en crée une nouvelle.
 */
async function chercherOuCreerPartie(monIdPeer, pseudo) {
  try {
    // Requête simplifiée sans where pour éviter l'index
const snapshot = await dbMatch.collection('proutvs_matchmaking')
  .orderBy('creeLe', 'asc')
  .limit(1)
  .get();
    
    if (etat.annulerMatchmaking) {
      nettoyerMatchmaking();
      return;
    }
    
    if (!snapshot.empty) {
      // 🎯 Une partie en attente existe ! On la rejoint
      const doc = snapshot.docs[0];
      const data = doc.data();
      
      log('🎯 Adversaire trouvé ! ID Peer:', data.peerId, 'Pseudo:', data.pseudo);
      
      // Mettre à jour le document
      await doc.ref.update({
        statut: 'rejoint',
        joueur2PeerId: monIdPeer,
        joueur2Pseudo: pseudo,
        rejointLe: firebase.firestore.FieldValue.serverTimestamp(),
      });
      
      // Nettoyer le document dans 5s
      setTimeout(() => {
        doc.ref.delete().catch(() => {});
      }, 5000);
      
      // Se connecter à l'hôte
      DOM.overlayChargement.querySelector('p').textContent = `🔄 Adversaire trouvé (${data.pseudo}) ! Connexion...`;
      
      const conn = etat.peer.connect(data.peerId, {
        reliable: true,
        serialization: 'json',
      });
      
      // Mode invité
      etat.mode = 'multi-invite';
      etat.codePartie = data.peerId;
      etat.pseudoAdverseNom = data.pseudo || 'INCONNU';
      gererConnexion(conn);
      
    } else {
      // Aucune partie en attente → on en crée une
      log('📋 Aucune partie trouvée, création d\'une salle d\'attente...');
      
      const docRef = await dbMatch.collection('proutvs_matchmaking').add({
        statut: 'attente',
        peerId: monIdPeer,
        pseudo: pseudo,
        creeLe: firebase.firestore.FieldValue.serverTimestamp(),
      });
      
      etat.docMatchmakingId = docRef.id;
      DOM.overlayChargement.querySelector('p').textContent = '⏳ En attente d\'un adversaire...';
      
      // Écouter les changements
      ecouteMatchmaking = docRef.onSnapshot((snap) => {
        if (!snap.exists) return;
        const data = snap.data();
        
        if (data.statut === 'rejoint' && data.joueur2PeerId) {
          log('🎯 Quelqu\'un a rejoint ! Pseudo:', data.joueur2Pseudo);
          
          // Arrêter l'écoute
          if (ecouteMatchmaking) {
            ecouteMatchmaking();
            ecouteMatchmaking = null;
          }
          
          // Mémoriser le pseudo adverse
          etat.pseudoAdverseNom = data.joueur2Pseudo || 'INCONNU';
          
          // Supprimer le document
          docRef.delete().catch(() => {});
          
          // Mode hôte
          DOM.overlayChargement.querySelector('p').textContent = `🔄 ${etat.pseudoAdverseNom} a rejoint ! Connexion...`;
          etat.mode = 'multi-hote';
          etat.codePartie = monIdPeer;
          
          // Timeout de sécurité
          setTimeout(() => {
            if (!etat.enLigne && (etat.mode === 'multi-hote' || etat.mode === 'multi-matchmaking')) {
              log('⏱️ Timeout connexion entrante (matchmaking)');
              afficherStatus('⏱️ La connexion a échoué. Réessaie.', 'erreur');
              DOM.overlayChargement.classList.add('masquee');
              quitterPartie();
            }
          }, 15000);
        }
      });
    }
  } catch (err) {
    logError('❌ Erreur Firestore matchmaking:', err);
    DOM.overlayChargement.classList.add('masquee');
    afficherStatus('❌ Erreur de recherche. Vérifie ta connexion internet.', 'erreur');
    nettoyerMatchmaking();
  }
}

/**
 * Supprime le document Firestore créé pour l'attente.
 */
function annulerDocMatchmaking() {
  if (ecouteMatchmaking) {
    ecouteMatchmaking();
    ecouteMatchmaking = null;
  }
  if (etat.docMatchmakingId) {
    dbMatch.collection('proutvs_matchmaking').doc(etat.docMatchmakingId).delete().catch(() => {});
    etat.docMatchmakingId = null;
  }
  etat.annulerMatchmaking = true;
}

/**
 * Nettoie tout le matchmaking (appelé en quittant).
 */
function nettoyerMatchmaking() {
  annulerDocMatchmaking();
  DOM.overlayChargement.querySelector('p').textContent = 'Connexion en cours...';
  if (DOM.btnAnnulerRecherche) {
    DOM.btnAnnulerRecherche.classList.add('masquee');
  }
}
