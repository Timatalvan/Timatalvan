# Tímatalvan: Tímatalvu-app til WebUntis

*Tímatalvu-app til Vinnuháskúlan og aðrar skúlar, ið nýta WebUntis.*

<p align="center">
  <img src="tt.png" alt="Mynd av tímatalvuni" width="45%"/>
</p>

---

**Tímatalvan** er eitt lætt forrit, ment við Electron, vísir tímatalvurnar frá [WebUntis](https://webuntis.com/). Forritið er gjørt til næmingar og lærarar á vinnuháskúlanum.

Endamálið við verkætlanini er at gera tað lættari og skjótari at hyggja at tímatalvuni, við hentum hentleikum sum:


-  **Minnir teg á tímar:** Fá boð 5 minuttir áðrenn ein tími byrjar.
-  **Sløkk boðini:** Tú kanst lættliga sløkkja fyri boðunum, um tú ikki ynskir tey.
-  **Verjir títt privatlív:** Ongar sporingarfunktiónir eru í forritinum.
-  **Føroyskt mál og snið:** Bygt við føroyskum brúkarum í huga.

---

## 📦 Hentleikar

-   **Skjót og móttakilig:** Forritið goymir tímatalvuna lokalt (*caching*), so tað er skjótt at brúka, sjálvt um servarin hjá Untis er seinur.
-   **Fleiri í senn:** Vís tímatalvur fyri fleiri flokkar ella lærarar í somu mynd.
-   **Reint snið:** Ein einkul brúkaraflata, ið leggur dent á tað, ið hevur týdning: tína tímatalvu.
-   **System Tray:** Forritið liggur stillisliga í tínum *system tray* og er altíð klárt við einum klikki.
-   **Boð:** Fá sjálvvirkandi áminningar um komandi tímar og fríkorter.
-   **Dagfør við einum klikki:** Trýst á ikonið fyri at dagføra tímatalvuna.


---

### Kravdur útbúnaður
- [Node.js](https://nodejs.org/)
- npm

### Installatión
```bash
# Klona hetta repository
git clone https://github.com/Timatalvan/Timatalvan.git

# Far inn í mappuna
cd Timatalvan

# Installera allar kravdar pakkarnar
npm install

# Koyr forritið
npm start
```

---

## 🛠 Menning

Høvuðslogikkurin liggur í hesum fílum:
- `src/main.js` - Handfer vindeygað, logikk fyri tekn, boð og goymslu.
- `src/renderer.js` - Handfer brúkaraflatuna.
- `src/preload.cjs` - Brúgv millum Electron og brúkaraflatuna á ein tryggan hátt.

Ynskir tú at byggja forritið til ein installeringsfíl (`.exe`), kanst tú koyra hesa kommandoina:
```bash
npm run build
```
Installeringsfílurin verður stovnaður í `dist` mappuni.

---

## 🧾 Lisens

Verkætlanin er útgivin undir **MIT Lisensinum**. Sí `LICENSE` fyri meira kunning.

---

## 🤝 Takk til

- WebUntis fyri at veita backend-tænastuna.
- Github fyri hjálp við menningini.
- Næmingar og starvsfelagar fyri royndarkoyring og afturmelding.

---

## 🔐 Privatlivsfrágreiðing

Henda appin:
- Savnar ella sendir ikki brúkaradáta.
- Nýtir ikki nakra slag av analýsu ella sporing.
- Fær ikki atgongd til staðseting, mikrofon ella kamera.

Allar upplýsingar verða goymdar lokalt á tínari teldu.

---

## 💡 Vilt tú hjálpa?
Tú ert vælkomin at senda *pull requests* við betringum og nýggjum hentleikum.

---

### Eystein 2025
