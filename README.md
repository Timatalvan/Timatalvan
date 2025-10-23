# Tímatalvan

**Tímatalvu forrit til webuntis tímatalvuna hjá Vinnuháskúlanum.**

Google drive leinki við forritinum og vegleiðing: [Tímatalvan](https://drive.google.com/drive/folders/1woR5El6N9R-dJjr69zTJUhJhPGfaQ-sg?usp=drive_link)

<p align="center">
  <img src="tt.png" alt="Mynd av tímatalvuni" width="100%"/>
</p>

---

**Tímatalvan** er eitt lítið forrit, ment við Electron, ið vísir tímatalvuna frá [WebUntis](https://webuntis.com/). Forritið er gjørt til næmingar og lærarar á vinnuháskúlanum.

Endamálið við verkætlanini er at gera tað lættari og skjótari at síggja tímatalvuna, við hentum hentleikum sum:


-  **Minnir teg á tímar:** Fá boð 5 minuttir áðrenn ein tími byrjar.
-  **Egin tímatalva:** tekur tú fak saman við fleiri flokkum? Tú kanst velja hvørji fak verða víst.
-  **Føroyskt mál og snið:** Bygt við føroyskum brúkarum í huga.


<p align="right">
  <img src="tt2.png" alt="Mynd av stillingum" width="45%"/>
</p>


## 📦 Hentleikar

-   **Skjótt:** Forritið goymir tímatalvuna lokalt (*caching*), so tað er skjótt at brúka, sjálvt um servarin hjá Untis er seinur.
-   **Fleiri í senn:** Vís tímatalvur fyri fleiri flokkar á eini tímatalvu.
-   **Reint snið:** Ein einkul brúkaraflata, ið leggur dent á tað, ið hevur týdning: tína tímatalvu.
-   **System Tray:** Forritið liggur stillisliga í tínum *system tray* og er altíð klárt við einum klikki.
-   **Boð:** Fá áminningar um komandi tímar og steðgir.
-   **Byrjar við innritan:** Tímatalvan kann byrja av sær sjálvari tá  ið tú ritar inn.


---

### Kravdur útbúnaður
- [Node.js](https://nodejs.org/)
- npm

### Installatión
```bash
# Klona hetta repository'ið
git clone https://github.com/Timatalvan/Timatalvan.git

# Far inn í mappuna
cd Timatalvan

# Installera allar pakkarnar
npm install

# Koyr forritið
npm start
```

---

## 🛠 Menning

Høvuðslogikkurin liggur í hesum forritinum:
- `src/main.js` - Handfer vindeygað, logikk fyri tekn, boð og goymslu.
- `src/untis.js`- Tekur sær av sambandinum millum tímatalvuna og webuntis heimasíðuna.
- `src/renderer.js` - Handfer brúkaraflatuna.
- `src/preload.cjs` - Brúgv millum Electron og brúkaraflatuna á ein tryggan hátt.

Ynskir tú at byggja forritið til ein installeringsfíl (`.exe`), kanst tú brúka hesa kommandoina:
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
- Nýtir ikki nakað slag av analysu ella sporing.
- Fær ikki atgongd til staðseting, mikrofon ella kamera.

Allir upplýsingar um flokksval verða goymdir lokalt á tínari teldu.

---

## 💡 Vilt tú hjálpa?
Tú ert vælkomin at senda *pull requests* við betringum og nýggjum hentleikum.

---

### Eystein 2025
