/**
 * Verbale visita QTAFI_VIS001 — seed checklist custom (cantiere OFF.MA / Fincantieri)
 * Fonte struttura: CheckList/160060 QTAFI_VIS001-R1 _OFF.MA 260225.md
 */

const TEMPLATE_MARKER = '[SGQ_TEMPLATE:QTAFI_VIS001]';

const QTAFI_VIS001_TEMPLATE = {
  name: 'Verbale di riunione QTAFI_VIS001',
  description:
    `${TEMPLATE_MARKER} Verbale visita cantiere OFF.MA (Fincantieri Infrastructure). Sezioni 1.0–5.0.`,
  hasOutcomeButtons: false,
  reportTemplateId: 7,
  sections: [
    {
      code: '1.0',
      title: 'Generale',
      displayOrder: 0,
      items: [
        {
          code: '1.1',
          title: 'Situazione cantiere e cicli di produzione',
          displayOrder: 0,
          responseType: 'verbale',
        },
      ],
    },
    {
      code: '2.0',
      title: 'MONTE E ALLUNGHI TAGLI / GESTIONE PRE-SALDATURA',
      displayOrder: 1,
      items: [
        {
          code: '2.1',
          title: 'Materiale preassemblato',
          displayOrder: 0,
          responseType: 'verbale',
        },
      ],
    },
    {
      code: '3.0',
      title: 'GESTIONE DEL MAGAZZINO E TAGLIO',
      displayOrder: 2,
      items: [
        {
          code: '3.1',
          title: 'Materiale base per ciclo',
          displayOrder: 0,
          responseType: 'verbale',
        },
        {
          code: '3.2',
          title: 'STEEL PREPARATION',
          displayOrder: 1,
          responseType: 'verbale',
        },
      ],
    },
    {
      code: '4.0',
      title: 'ASSEMBLAGGIO, SALDATURA, SABBIATURA E VERNICIATURA',
      displayOrder: 3,
      items: [
        {
          code: '4.1',
          title: 'ASSEMBLAGGIO E SALDATURA',
          displayOrder: 0,
          responseType: 'verbale',
        },
        {
          code: '4.2',
          title: 'SABBIATURA',
          displayOrder: 1,
          responseType: 'verbale',
        },
        {
          code: '4.3',
          title: 'VERNICIATURA',
          displayOrder: 2,
          responseType: 'verbale',
        },
        {
          code: '4.4',
          title: 'CONTROLLO DIMENSIONALE',
          displayOrder: 3,
          responseType: 'verbale',
        },
        {
          code: '4.5',
          title: 'MARCATURA',
          displayOrder: 4,
          responseType: 'verbale',
        },
        {
          code: '4.6',
          title: "MATERIALE D'APPORTO",
          displayOrder: 5,
          responseType: 'verbale',
        },
      ],
    },
    {
      code: '5.0',
      title: 'STOCCAGGIO ELEMENTI STRUTTURALI PRONTI PER LA SPEDIZIONE',
      displayOrder: 4,
      items: [
        {
          code: '5.1',
          title: 'Elementi strutturali pronti alla spedizione',
          displayOrder: 0,
          responseType: 'verbale',
        },
      ],
    },
  ],
};

function isQtafiVis001Description(description) {
  return typeof description === 'string' && description.includes(TEMPLATE_MARKER);
}

module.exports = {
  TEMPLATE_MARKER,
  QTAFI_VIS001_TEMPLATE,
  isQtafiVis001Description,
};
