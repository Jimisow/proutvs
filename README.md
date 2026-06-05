# 🚽 PROUT MANAGER 💨

**Le combat ultime de pets en temps réel !**

Un jeu multijoueur (2 joueurs) ou solo (contre IA) où deux adversaires s'affrontent en accumulant une jauge de prout pour lancer des attaques dévastatrices sur la conscience de l'autre.

---

## 🎮 Comment jouer

### Mode solo (contre l'IA)
1. Ouvre `index.html` dans ton navigateur
2. Clique sur **"Jouer contre l'IA"**
3. Le jeu commence immédiatement
4. Clique sur **"💨 PROUT 💨"** pour augmenter ta jauge
5. Débloque des bonus et lance-les sur l'IA

### Mode multijoueur (2 joueurs)
1. Les deux joueurs ouvrent `index.html` dans leurs navigateurs
2. **Joueur 1** : clique sur **"Créer une partie"** → un code à 6 lettres apparaît
3. **Joueur 2** : clique sur **"Rejoindre une partie"** → entre le code
4. La connexion PeerJS s'établit automatiquement
5. Le jeu commence dès que les deux sont connectés

### Règles
- Ta **jauge prout** monte automatiquement de 1% toutes les 2 secondes
- Clique sur le bouton PROUT pour gagner +5% instantanément
- Quand ta jauge atteint 25%, 50% ou 75%, les **bonus d'attaque** se débloquent
- Lance un bonus pour consommer ta jauge et infliger des dégâts à l'adversaire
- **Premier à 0% de conscience = perdu**

### Les bonus
| Bonus | Coût | Dégâts |
|-------|------|--------|
| 💨 Pet léger | 25% jauge | -5% conscience |
| 💨🌪️ Pet toxique | 50% jauge | -12% conscience |
| 💣💨 Mégapet nucléaire | 75% jauge | -25% conscience |

---

## 🛠️ Stack technique

| Technologie | Usage |
|-------------|-------|
| **HTML5 / CSS3** | Interface utilisateur responsive |
| **JavaScript ES2022** | Logique métier, DOM, animations |
| **PeerJS** (WebRTC) | Connexion pair-à-pair (aucun serveur central) |
| **Google Fonts** | Police 'Press Start 2P' pour le style rétro |

### Dépendances (via CDN)
- [PeerJS](https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js) — Connexion WebRTC
- [Google Fonts](https://fonts.googleapis.com/css2?family=Press+Start+2P) — Police rétro

---

## 📁 Structure des fichiers

```
prout-manager/
├── index.html              # Structure principale (HTML)
├── style.css               # Tous les styles (CSS)
├── game.js                 # Cœur du jeu (JS + PeerJS)
├── bot.js                  # IA du mode solo
├── README.md               # Documentation
├── IMAGES_PROMPTS.md       # Prompts pour générer tes images
└── img/                    # Dossier des personnages
    ├── personnage-normal.svg   # Expression neutre
    ├── personnage-content.svg  # Content (quand il prout)
    ├── personnage-degats.svg   # Surprise / petits dégâts
    ├── personnage-grave.svg    # Douleur / dégâts sérieux
    ├── personnage-mort.svg     # Mort / défaite
    └── personnage-attaque.svg  # Concentration / attaque
```

---

## 🚀 Déploiement

### Option 1 : GitHub Pages
```bash
git init
git add .
git commit -m "Initial commit - PROUT MANAGER"
# Crée un repo sur GitHub, puis :
git remote add origin https://github.com/toncompte/prout-manager.git
git branch -M main
git push -u origin main
# Active GitHub Pages dans Settings > Pages > branch: main, folder: / (root)
```

### Option 2 : Netlify (glisser-déposer)
1. Va sur [netlify.com](https://netlify.com)
2. Glisse le dossier `prout-manager/` dans la zone de drop
3. C'est en ligne !

### Option 3 : Vercel
```bash
npx vercel --prod
```

### Option 4 : Local (sans déploiement)
Ouvre simplement `index.html` dans ton navigateur (double-clic).

> ⚠️ **Important** : Le mode multijoueur nécessite que les deux joueurs aient accès au fichier (via un serveur ou hébergement). Pour tester en local, les deux joueurs doivent être sur le même réseau ou utiliser un service comme ngrok.

---

## 🎨 Design

- **Thème** : Toilettes humoristique avec émoticônes 🚽 💨 💩 🧻
- **Palette** : Marrons, verts kaki, beige, doré (style Game Boy)
- **Police** : Press Start 2P (rétro jeu vidéo)
- **Responsive** : Mobile-first, fonctionne sur tous les écrans
- **Orientation** : Portrait recommandé

---

## 🧪 Mode DEBUG

Les logs sont activés par défaut dans la console du navigateur (F12 > Console).
Tu peux aussi cliquer sur le bouton **🐛** en haut à droite pour afficher l'état complet du jeu dans la console.

---

## 📝 Licence

MIT — Fait avec 💨 et beaucoup d'humour.

---

*"Quand la vie te donne des gaz, fais-en un jeu vidéo."* 🤣
