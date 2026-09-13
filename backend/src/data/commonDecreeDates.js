/**
 * Date esatte di decreti legislativi comuni (per URN Normattiva corretto).
 * Fonte: Gazzetta Ufficiale / normattiva.it
 */

module.exports = {
  // D.Lgs. numero/anno → data pubblicazione GU
  'decreto.legislativo': {
    '81/2008': '2008-04-09',   // Testo Unico Sicurezza sul Lavoro
    '152/2006': '2006-04-03',  // Testo Unico Ambiente
    '231/2001': '2001-06-08',  // Responsabilità amministrativa enti
    '198/2006': '2006-07-20',  // Codice delle pari opportunità
    '626/1994': '1994-09-19',  // Sicurezza lavoro (abrogato da 81/2008)
  },
  'decreto.legge': {
    '18/2020': '2020-03-17',   // Covid-19
  },
  'legge': {
    '104/1992': '1992-02-05',  // Assistenza handicap
    '68/1999': '1999-03-12',   // Diritto lavoro disabili
  },
};
