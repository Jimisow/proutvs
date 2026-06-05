/* ================================================================ */
/* PROUT MANAGER - Bot IA (mode solo)                                */
/* IA simple qui fonctionne vraiment !                               */
/* ================================================================ */

class BotIA {
  constructor(options = {}) {
    this.onJaugeChange = options.onJaugeChange || ((v) => console.log('[BOT] jauge →', v));
    this.onAttaque = options.onAttaque || ((c, d) => console.log('[BOT] attaque ! coût', c, 'dégâts', d));

    this.jauge = 0;
    this.conscience = 100;
    this.actif = false;
    this.partieFinie = false;
    this._timerJauge = null;
    this._timerAction = null;
  }

  demarrer() {
    console.log('[BOT] === DEMARRAGE ===');
    this.arreter();
    this.actif = true;
    this.partieFinie = false;
    this.jauge = 0;
    this.conscience = 100;
    
    // Timer jauge : +1% toutes les 3s
    this._timerJauge = setInterval(() => {
      if (!this.actif || this.partieFinie) return;
      if (this.jauge < 100) {
        this.jauge++;
        console.log('[BOT] Jauge IA →', this.jauge + '%');
        this.onJaugeChange(this.jauge);
      }
    }, 3000);
    
    // Première action après 2s
    this._timerAction = setTimeout(() => this._boucleAction(), 2000);
  }

  arreter() {
    this.actif = false;
    if (this._timerJauge) { clearInterval(this._timerJauge); this._timerJauge = null; }
    if (this._timerAction) { clearTimeout(this._timerAction); this._timerAction = null; }
    console.log('[BOT] Arrêté');
  }

  subirDegats(degats) {
    if (this.partieFinie) return;
    this.conscience = Math.max(0, this.conscience - degats);
    console.log('[BOT] Dégâts subis : -' + degats + '%, reste ' + this.conscience + '%');
    if (this.conscience <= 0) {
      this.partieFinie = true;
      this.arreter();
    }
  }

  _boucleAction() {
    if (!this.actif || this.partieFinie) return;
    
    this._effectuerAction();
    
    // Prochaine action dans 2 à 4 secondes
    const delai = 2000 + Math.random() * 2000;
    this._timerAction = setTimeout(() => this._boucleAction(), delai);
  }

  _effectuerAction() {
    if (!this.actif || this.partieFinie) return;
    
    console.log('[BOT] Action ! jauge=' + this.jauge + '%');
    
    // 50% de chance de ne rien faire
    if (Math.random() < 0.5) {
      console.log('[BOT] → ne fait rien');
      return;
    }
    
    // Peut-elle lancer un bonus ?
    if (this.jauge >= 25) {
      // Prend le plus petit bonus possible (25% si dispo, sinon 50%, sinon 75%)
      let cout, degats;
      if (this.jauge >= 25) { cout = 25; degats = 5; }
      if (this.jauge >= 50 && Math.random() < 0.3) { cout = 50; degats = 12; }
      if (this.jauge >= 75 && Math.random() < 0.1) { cout = 75; degats = 25; }
      
      this.jauge -= cout;
      console.log('[BOT] → ATTAQUE ! -' + degats + '% (coût ' + cout + '%)');
      this.onJaugeChange(this.jauge);
      this.onAttaque(cout, degats);
      
      if (this.conscience <= 0) {
        this.partieFinie = true;
        this.arreter();
      }
    } else {
      // Cliquer sur PROUT
      const gain = Math.min(5, 100 - this.jauge);
      this.jauge += gain;
      console.log('[BOT] → Clic PROUT (+' + gain + '%) jauge=' + this.jauge + '%');
      this.onJaugeChange(this.jauge);
    }
  }
}
