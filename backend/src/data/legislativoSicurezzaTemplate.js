/**
 * Registro obblighi legali sicurezza — seed checklist custom
 * Fonte: app/src/data/checklistTemplates.js (ISO_45001_LEGISLATIVO_TEMPLATE)
 * Rigenerare: node backend/scripts/buildLegislativoSicurezzaTemplate.js
 */

const TEMPLATE_MARKER = "[SGQ_TEMPLATE:LEG_SICUREZZA_81]";

const LEGISLATIVO_SICUREZZA_TEMPLATE = {
  "name": "Conformità legislativa sicurezza (D.Lgs. 81/08)",
  "description": "[SGQ_TEMPLATE:LEG_SICUREZZA_81] Registro degli obblighi legali per salute e sicurezza sul lavoro. Non è audit ISO 45001 SGSSL.",
  "hasOutcomeButtons": true,
  "sections": [
    {
      "code": "leg_sic_01",
      "title": "1. DATORE DI LAVORO, DELEGA DI FUNZIONI, DIRIGENTI E PREPOSTI",
      "displayOrder": 1,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Articolo 16 (Delega di funzioni)\nD.Lgs. 81/2008 e s.m.i. - Articolo 17 (Obblighi del datore di lavoro non delegabili)\nD.Lgs. 81/2008 e s.m.i. - Articolo 18 (Obblighi del datore di lavoro e dei dirigenti)\nD.Lgs. 81/2008 e s.m.i. - Articolo 19 (Obblighi del preposto)",
      "linkedLegislation": "D.Lgs. 81/2008 art.16; art.17; art.18; art.19",
      "items": []
    },
    {
      "code": "leg_sic_02",
      "title": "2. SERVIZIO PREVENZIONE E PROTEZIONE (RSPP, ASPP) E RLS",
      "displayOrder": 2,
      "referenceText": "Accordo 7 luglio 2016 sui percorsi formativi per RSPP\nD.Lgs. 81/2008 e s.m.i. - Sezione III, Servizio di prevenzione e protezione (articoli 31-35)\nD.Lgs. 81/2008 e s.m.i. - Articolo 17, lettera b)\nD.Lgs. 81/2008 e s.m.i. - Allegato II\nD.Lgs. 81/2008 e s.m.i. - Articolo 29, comma 1\nD.Lgs. 81/2008 e s.m.i. - Articoli 31, comma 2, e 32\nD.Lgs. 81/2008 e s.m.i. - Articolo 35\nD.Lgs. 81/2008 e s.m.i. - Sezione VII, consultazione e partecipazione dei rappresentanti dei lavoratori\nD.Lgs. 81/2008 e s.m.i. - Articoli 47, 48, 49 e 50",
      "linkedLegislation": "D.Lgs. 81/2008 art.17; art.29; art.31; art.32; art.35; art.47; art.48; art.49; art.50",
      "items": []
    },
    {
      "code": "leg_sic_03",
      "title": "3. LAVORATORI",
      "displayOrder": 3,
      "referenceText": null,
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_04",
      "title": "4. MEDICO COMPETENTE E SORVEGLIANZA SANITARIA",
      "displayOrder": 4,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Articolo 18, comma 1 (nomina)\nD.Lgs. 81/2008 e s.m.i. - Sezione V, sorveglianza sanitaria (articoli 38-42)\nD.Lgs. 81/2008 e s.m.i. - Articolo 45 (primo soccorso)\nLegge 5 marzo 1963, n. 292 - Vaccinazione antitetanica obbligatoria\nDecreto Ministeriale 30 luglio 2008\nD.Lgs. 81/2008 e s.m.i. - Articolo 41, comma 4\nProvvedimento 18 settembre 2008 (G.U. n. 236 dell'8 ottobre 2008)",
      "linkedLegislation": "D.Lgs. 81/2008 art.18; art.38; art.39; art.40; art.41; art.42; art.45",
      "items": []
    },
    {
      "code": "leg_sic_05",
      "title": "5. FORMAZIONE, INFORMAZIONE E ADDESTRAMENTO DEI LAVORATORI",
      "displayOrder": 5,
      "referenceText": "Accordo Stato-Regioni del 17 aprile 2025 (Rep. Atti n. 59/CSR)\nD.Lgs. 81/2008 e s.m.i. - Titolo I, Capo III, Sezione IV\nD.Lgs. 81/2008 e s.m.i. - Articolo 36 (informazione ai lavoratori)\nD.Lgs. 81/2008 e s.m.i. - Articolo 37 (formazione dei lavoratori e dei loro rappresentanti)\nD.Lgs. 10 settembre 2003, n. 276 - Articolo 2, comma 1, lettera i)\nD.Lgs. 81/2008 e s.m.i. - Articolo 15, comma 1, lettere n), o), p)\nD.Lgs. 81/2008 e s.m.i. - Articoli 32, 33, 37 e 77\nCEI 11-27/1:2025 e CEI EN 50110-1 (CEI 11-48:2005)\nD.Lgs. 81/2008 e s.m.i. - Allegati XIV e XXI\nD.Lgs. 81/2008 e s.m.i. - Titolo V",
      "linkedLegislation": "D.Lgs. 81/2008 art.15; art.32; art.33; art.36; art.37; art.77",
      "items": []
    },
    {
      "code": "leg_sic_06",
      "title": "6. GESTIONE DEGLI INFORTUNI",
      "displayOrder": 6,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Articolo 53, comma 6\nD.M. 12 settembre 1958 e D.M. 5 dicembre 1996 (registro infortuni)\nD.Lgs. 81/2008 e s.m.i. - Articolo 243 (registro di esposizione e cartelle sanitarie)\nD.Lgs. 81/2008 e s.m.i. - Articolo 280 (registri degli esposti e degli eventi accidentali)",
      "linkedLegislation": "D.Lgs. 81/2008 art.53; art.243; art.280",
      "items": []
    },
    {
      "code": "leg_sic_07",
      "title": "7. RIUNIONE PERIODICA",
      "displayOrder": 7,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Articolo 35, commi 1, 2 e 3",
      "linkedLegislation": "D.Lgs. 81/2008 art.35",
      "items": []
    },
    {
      "code": "leg_sic_08",
      "title": "8. VALUTAZIONE GENERALE DEI RISCHI LAVORATIVI",
      "displayOrder": 8,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Articoli 2, 15, 28 e 29\nD.Lgs. 81/2008 e s.m.i. - Articoli 63, 64 e Allegato IV\nD.Lgs. 81/2008 e s.m.i. - Articoli 65, 66, 80, 136, 168, 183, 190 e 202\nD.Lgs. 81/2008 e s.m.i. - Titolo VIII, Capo V\nD.Lgs. 81/2008 e s.m.i. - Allegati VIII e XV\nD.Lgs. 26 marzo 2001, n. 151\nD.Lgs. 26 novembre 1999, n. 532\nISO 11228, metodi NIOSH, Snook-Ciriello e OCRA\nLinee guida nazionali 27 settembre 2001 e Linea guida ISPESL 1 giugno 2006",
      "linkedLegislation": "D.Lgs. 81/2008 art.2; art.15; art.28; art.29; art.63; art.64; art.65; art.66; art.80; art.136; art.168; art.183; art.190; art.202",
      "items": []
    },
    {
      "code": "leg_sic_09",
      "title": "9. RISCHI AGENTI BIOLOGICI",
      "displayOrder": 9,
      "referenceText": "Accordo 7 febbraio 2013 sulla valutazione e gestione dei rischi correlati all'igiene degli impianti di trattamento aria\nD.Lgs. 81/2008 e s.m.i. - Esposizione ad agenti biologici (articoli 266-286)\nDecreto Ministeriale n. 219 del 26 giugno 2000\nLinee guida nazionali 4 aprile 2000 per la prevenzione e il controllo della legionellosi",
      "linkedLegislation": "D.Lgs. 81/2008 art.266; art.267; art.268; art.269; art.270; art.271; art.272; art.273; art.274; art.275; art.276; art.277; art.278; art.279; art.280; art.281; art.282; art.283; art.284; art.285; art.286",
      "items": []
    },
    {
      "code": "leg_sic_10",
      "title": "10. RISCHI MOVIMENTAZIONE MANUALE DEI CARICHI",
      "displayOrder": 10,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Movimentazione manuale dei carichi (articoli 167-171)\nD.Lgs. 81/2008 e s.m.i. - Allegato XXXIII\nISO 11228-1",
      "linkedLegislation": "D.Lgs. 81/2008 art.167; art.168; art.169; art.170; art.171",
      "items": []
    },
    {
      "code": "leg_sic_11",
      "title": "11. RISCHI TRAINO/SPINTA, TRASPORTO IN PIANO",
      "displayOrder": 11,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Movimentazione manuale dei carichi (articoli 167-171)\nD.Lgs. 81/2008 e s.m.i. - Allegato XXXIII\nISO 11228-2",
      "linkedLegislation": "D.Lgs. 81/2008 art.167; art.168; art.169; art.170; art.171",
      "items": []
    },
    {
      "code": "leg_sic_12",
      "title": "12. POSTURE INCONGRUE",
      "displayOrder": 12,
      "referenceText": "D.Lgs. 81/2008 e s.m.i.\nMovimentazione manuale dei carichi (articoli 167-171)\nD.Lgs. 81/2008 e s.m.i. - Allegato XXXIII",
      "linkedLegislation": "D.Lgs. 81/2008 art.167; art.168; art.169; art.170; art.171",
      "items": []
    },
    {
      "code": "leg_sic_13",
      "title": "13. RISCHI MOVIMENTI RIPETITIVI CON SOVRACCARICO ARTI SUPERIORI",
      "displayOrder": 13,
      "referenceText": "D.Lgs. 81/2008 e s.m.i.\nMovimentazione manuale dei carichi (articoli 167-171)\nD.Lgs. 81/2008 e s.m.i. - Allegato XXXIII\nISO 11228-3",
      "linkedLegislation": "D.Lgs. 81/2008 art.167; art.168; art.169; art.170; art.171",
      "items": []
    },
    {
      "code": "leg_sic_14",
      "title": "14. ATTREZZATURE MUNITE DI VIDEOTERMINALI",
      "displayOrder": 14,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Titolo VII, attrezzature munite di videoterminali (articoli 172-179)\nD.Lgs. 81/2008 e s.m.i. - Allegato XXXIV\nDecreto Ministeriale 2 ottobre 2000 - Linee guida d'uso dei videoterminali",
      "linkedLegislation": "D.Lgs. 81/2008 art.172; art.173; art.174; art.175; art.176; art.177; art.178; art.179",
      "items": []
    },
    {
      "code": "leg_sic_15",
      "title": "15. RISCHIO ATMOSFERE ESPLOSIVE",
      "displayOrder": 15,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Titolo XI\nD.Lgs. 81/2008 e s.m.i. - Articolo 294 (documento sulla protezione contro le esplosioni)",
      "linkedLegislation": "D.Lgs. 81/2008 art.294",
      "items": []
    },
    {
      "code": "leg_sic_16",
      "title": "16. RISCHIO ELETTRICO, ELETTROSTATICO, FULMINAZIONE",
      "displayOrder": 16,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Titolo III, Capo III\nLegge 5 marzo 1990, n. 46\nD.M. 37/2008\nCEI 11-27\nD.P.R. 22 ottobre 2001, n. 462\nD.Lgs. 81/2008 e s.m.i. - Articoli 84 e 86\nLegge 1 marzo 1968, n. 186\nCEI 64-8:2024 e CEI 64-14:2022",
      "linkedLegislation": "D.Lgs. 81/2008 art.84; art.86",
      "items": []
    },
    {
      "code": "leg_sic_17",
      "title": "17. RISCHIO STRESS LAVORO CORRELATO",
      "displayOrder": 17,
      "referenceText": "D.Lgs. 81/2008 e s.m.i.\nLinee guida 2025 sulla metodologia per la valutazione e gestione del rischio stress lavoro-correlato, contestualizzata al lavoro da remoto e all'innovazione tecnologica",
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_18",
      "title": "18. RISCHIO LAVORATRICI IN STATO DI GRAVIDANZA",
      "displayOrder": 18,
      "referenceText": "D.Lgs. 81/2008 e s.m.i.\nD.Lgs. 26 marzo 2001, n. 151",
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_19",
      "title": "19. RISCHIO LAVORO NOTTURNO",
      "displayOrder": 19,
      "referenceText": "D.Lgs. 81/2008 e s.m.i.",
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_20",
      "title": "20. RISCHIO LUOGHI ELEVATI CON PERICOLO DI CADUTA",
      "displayOrder": 20,
      "referenceText": "D.Lgs. 81/2008 e s.m.i.",
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_21",
      "title": "21. LUOGHI DI LAVORO",
      "displayOrder": 21,
      "referenceText": "D.M. 22 gennaio 2019 sulla segnaletica stradale destinata alle attività lavorative in presenza di traffico veicolare\nR.D. 27 luglio 1934, n. 1265 - Articoli 221 e 222\nLegge 4 dicembre 1993, n. 493\nD.P.R. 22 aprile 1994, n. 425\nD.Lgs. 6 giugno 2001, n. 378 - Articoli 24, 25 e 26\nD.Lgs. 81/2008 e s.m.i. - Articolo 67\nD.Lgs. 81/2008 e s.m.i. - Titolo II",
      "linkedLegislation": "D.Lgs. 81/2008 art.67",
      "items": []
    },
    {
      "code": "leg_sic_22",
      "title": "22. APPROVVIGIONAMENTO ACQUA CONSUMO UMANO",
      "displayOrder": 22,
      "referenceText": "D.P.R. 24 maggio 1988, n. 236\nD.Lgs. 2 febbraio 2001, n. 31",
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_23",
      "title": "23. MACCHINE / ATTREZZATURE DI LAVORO",
      "displayOrder": 23,
      "referenceText": "Regolamento (UE) 2023/1230, applicabile dal 20 gennaio 2027\nD.Lgs. 81/2008 e s.m.i. - Titolo III (articoli 69-87)\nD.Lgs. 81/2008 e s.m.i. - Allegati V, VI e VII\nDirettive 98/37/CE e 2006/42/CE; D.Lgs. 17/2010\nDirettive 89/336/CE e 2004/108/CE\nDirettiva 2006/95/CE",
      "linkedLegislation": "D.Lgs. 81/2008 art.69; art.70; art.71; art.72; art.73; art.74; art.75; art.76; art.77; art.78; art.79; art.80; art.81; art.82; art.83; art.84; art.85; art.86; art.87",
      "items": []
    },
    {
      "code": "leg_sic_24",
      "title": "24. MEZZI DI SOLLEVAMENTO",
      "displayOrder": 24,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Allegati VI e VII\nDirettive UE di riferimento per macchine, compatibilità elettromagnetica e bassa tensione\nD.P.R. 30 aprile 1999, n. 162\nLinee guida ISPESL per il controllo periodico dei carrelli elevatori e delle relative attrezzature\nLinee guida ISPESL per l'adeguamento al D.Lgs. 359/1999 nel settore edilizio",
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_25",
      "title": "25. APPARECCHI A PRESSIONE",
      "displayOrder": 25,
      "referenceText": "R.D. 12 maggio 1927, n. 824\nDecreto Ministeriale 21 maggio 1974\nD.Lgs. 81/2008 e s.m.i. - Allegato VII\nD.M. 1 dicembre 2004, n. 329 (Direttiva 97/23/CE)\nDecreto 6 marzo 2002\nDecreto 7 febbraio 2001\nD.Lgs. 25 febbraio 2000, n. 93",
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_26",
      "title": "26. CANTIERI TEMPORANEI E MOBILI",
      "displayOrder": 26,
      "referenceText": "D.Lgs. 81/2008 e s.m.i. - Titolo IV\nD.Lgs. 81/2008 e s.m.i. - Allegati X-XXIII",
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_27",
      "title": "27. DPI E RELATIVA GESTIONE",
      "displayOrder": 27,
      "referenceText": "D.Lgs. 19 febbraio 2019, n. 17 - Adeguamento al Regolamento (UE) 2016/425 sui dispositivi di protezione individuale\nD.Lgs. 81/2008 e s.m.i.",
      "linkedLegislation": null,
      "items": []
    },
    {
      "code": "leg_sic_28",
      "title": "28. AMBITI NORMATI DIVERSAMENTE (NON APPLICABILE IL TESTO UNICO)",
      "displayOrder": 28,
      "referenceText": "D.Lgs. 14 maggio 2019, n. 50 - Sicurezza delle ferrovie\nD.Lgs. 27 luglio 1999, n. 271 - Lavoratori marittimi a bordo delle navi\nD.Lgs. 17 agosto 1999, n. 298 - Lavoro a bordo delle navi da pesca\nD.Lgs. 27 luglio 1999, n. 272 - Operazioni e servizi portuali\nDecreto 16 dicembre 2004 - Operazioni di carico e scarico delle navi portarinfuse\nCodice di buona pratica ILO sulla salute e sicurezza nei porti (2003)\nD.Lgs. 25 novembre 1996, n. 624 - Industrie estrattive\nLegge 26 aprile 1974, n. 191 - Settore ferroviario\nDecreto 6 febbraio 2001, n. 110 - Corpo Forestale dello Stato\nD.P.R. 19 marzo 1956, n. 302 - Produzione e impiego degli esplosivi\nD.P.R. 20 marzo 1956, n. 320 - Lavoro in sotterraneo\nD.P.R. 20 marzo 1956, n. 321 - Cassoni ad aria compressa\nD.P.R. 20 marzo 1956, n. 323 - Impianti telefonici",
      "linkedLegislation": null,
      "items": []
    }
  ]
};

function isLegislativoSicurezzaDescription(description) {
  return typeof description === 'string' && description.includes(TEMPLATE_MARKER);
}

module.exports = { TEMPLATE_MARKER, LEGISLATIVO_SICUREZZA_TEMPLATE, isLegislativoSicurezzaDescription };
