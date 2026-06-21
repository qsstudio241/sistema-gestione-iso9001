/**
 * generateVtTemplate.js
 * Genera il template Word VT-verbale.docx per export Verbale CND.
 * Layout basato su VT_2471.docx (UNI EN ISO 17637).
 * USO: node scripts/generateVtTemplate.js
 */
'use strict';
const { Document, Paragraph, TextRun, Table, TableRow, TableCell,
    Footer, Header, AlignmentType, WidthType, BorderStyle, ShadingType,
    Packer, PageNumber, convertInchesToTwip } = require('docx');
const fs = require('fs');
const path = require('path');

const C = { primary:'1F3A5F', lightGray:'F3F4F6', lightBlue:'DBEAFE', black:'000000', white:'FFFFFF' };

function run(text, o) {
    o = o||{};
    return new TextRun({ text: text||'', bold:o.bold||false, italic:o.italic||false,
        size: o.size||20, color:o.color||undefined, font:'Arial' });
}
function para(children, o) {
    o = o||{};
    if (typeof children === 'string') children = [run(children, o)];
    return new Paragraph({ children, alignment:o.align||AlignmentType.LEFT,
        spacing:{ before:o.before||0, after:o.after||80 } });
}
function mkBorder() {
    var b = {style:BorderStyle.SINGLE, size:1, color:C.black};
    return {top:b,bottom:b,left:b,right:b,insideHorizontal:b,insideVertical:b};
}
function noBorder() {
    var b = {style:BorderStyle.NONE, size:0, color:'FFFFFF'};
    return {top:b,bottom:b,left:b,right:b};
}
function cell(ch, o) {
    o = o||{};
    if (typeof ch === 'string') ch = [para([run(ch,{bold:o.bold,size:o.size||20})])];
    return new TableCell({
        children: Array.isArray(ch)?ch:[ch],
        columnSpan: o.span||1,
        shading: o.fill?{fill:o.fill,type:ShadingType.CLEAR}:undefined,
        width: o.pct?{size:o.pct,type:WidthType.PERCENTAGE}:undefined,
        margins:{top:60,bottom:60,left:80,right:80},
        borders: o.noBorder?noBorder():mkBorder(),
    });
}
function lbl(text, pct) {
    return cell([para([run(text,{bold:true,size:18})])],{fill:C.lightGray,pct:pct||20});
}
function hdr(text, pct) {
    return cell([para([run(text,{bold:true,size:18,color:C.white})],{align:AlignmentType.CENTER})],{fill:C.primary,pct:pct});
}
function val(ph, pct) { return cell([para([run(ph)])],{pct:pct}); }

function buildDoc() {
    var tblHeader = new Table({ width:{size:100,type:WidthType.PERCENTAGE}, borders:mkBorder(), rows:[
        new TableRow({children:[new TableCell({children:[
            para([run('ESAME VISIVO SALDATURA SECONDO UNI EN ISO 17637',{bold:true,size:24,color:C.white})],{align:AlignmentType.CENTER}),
            para([run('Welding visual examination according to UNI EN ISO 17637',{size:18,color:C.white})],{align:AlignmentType.CENTER}),
        ], columnSpan:4, shading:{fill:C.primary,type:ShadingType.CLEAR}, margins:{top:120,bottom:120,left:80,right:80}})]}),
        new TableRow({children:[lbl('CLIENTE / Customer',15),val('{client}',35),lbl('N. VERBALE / Report Nr.',20),val('{reportNumber}',30)]}),
        new TableRow({children:[lbl('COMMESSA / Job Order',15),val('{jobOrder}',35),lbl('DATA CONTROLLO / Test date',20),val('{inspectionDate}',30)]}),
        new TableRow({children:[lbl('SPECIFICA N. / WPS Nr',15),val('{wpsNumber}',35),lbl('TIPO GIUNTO / Joint type',20),val('{jointType}',30)]}),
        new TableRow({children:[lbl('MATERIALE BASE / Base material',15),val('{baseMaterial}',35),lbl('LIVELLO QUALITA\' / Quality level',20),val('{qualityLevel}',30)]}),
        new TableRow({children:[lbl('STANDARD MATERIALE',15),new TableCell({children:[para([run('{materialStandard}')])],columnSpan:3,margins:{top:60,bottom:60,left:80,right:80}})]}),
    ]});

    var tblStrumenti = new Table({ width:{size:100,type:WidthType.PERCENTAGE}, borders:mkBorder(), rows:[
        new TableRow({children:[new TableCell({children:[para([run('STRUMENTAZIONE UTILIZZATA / Instrumentation used',{bold:true,size:20,color:C.white})],{align:AlignmentType.CENTER})],columnSpan:3,shading:{fill:C.primary,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80}})]}),
        new TableRow({children:[hdr('Strumento',30),hdr('Marca / Modello',35),hdr('Matricola / ID',35)]}),
        new TableRow({children:[cell('CALIBRO PER SALDATURE / Welding gauge',{fill:C.lightGray}),cell('{toolGauge}'),cell('{toolGaugeId}')]}),
        new TableRow({children:[cell('LUXMETRO / Luxmeter',{fill:C.lightGray}),cell('{toolLuxmeter}'),cell('{toolLuxmeterId}')]}),
        new TableRow({children:[cell('LAMPADA / Lamp',{fill:C.lightGray}),cell('{toolLamp}'),cell('{toolLampId}')]}),
        new TableRow({children:[cell([para([run('ILLUMINAMENTO / Illuminance (lux)',{bold:true,size:18})])],{fill:C.lightGray}),cell([para([run('Range: {illuminanceMin} / {illuminanceMax} lux  |  Misurato: {illuminanceMeasured} lux',{size:18})])]),cell([para([run('Potenza: {powerW} W  |  Lungh. onda: {wavelength}',{size:18})])])]}),
    ]});

    var tblMarche = new Table({ width:{size:100,type:WidthType.PERCENTAGE}, borders:mkBorder(), rows:[
        new TableRow({children:[new TableCell({children:[para([run('RISULTATI DELL\'ESAME / Examination results',{bold:true,size:20,color:C.white})],{align:AlignmentType.CENTER})],columnSpan:9,shading:{fill:C.primary,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80}})]}),
        new TableRow({children:[hdr('#',5),hdr('POS./CODICE',12),hdr('Q.TA\'',6),hdr('DESCRIZIONE',21),hdr('PARTE ESAMINATA',12),hdr('SUPERFICIE (*)',10),hdr('% CTRL',6),hdr('DIFETTI (**)',13),hdr('GIUDIZIO (***)',15)]}),
        new TableRow({children:[
            cell('{#items}',{pct:5}),cell('{rowNum}',{pct:5}),cell('{positionCode}',{pct:12}),cell('{quantity}',{pct:6}),
            cell('{description}',{pct:21}),cell('{examinedPart}',{pct:12}),cell('{surfaceCondition}',{pct:10}),
            cell('{inspectionPercentage}',{pct:6}),cell('{defects}',{pct:13}),cell('{evaluation}{/items}',{pct:10}),
        ]}),
        new TableRow({children:[new TableCell({children:[para([run('Note: {notes}',{size:18})])],columnSpan:9,margins:{top:80,bottom:80,left:100,right:100}})]}),
        new TableRow({children:[new TableCell({children:[para([run('Si certifica che la prova e\' stata eseguita secondo le norme di riferimento indicate e che i risultati sono quelli trascritti. / This is to certify that the test has been performed as per said reference standard and the results are those recorded.',{size:17,italic:true})])],columnSpan:9,shading:{fill:C.lightBlue,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:100,right:100}})]}),
    ]});

    var tblFirme = new Table({ width:{size:100,type:WidthType.PERCENTAGE}, borders:mkBorder(), rows:[
        new TableRow({children:[new TableCell({children:[para([run('UFFICIALIZZAZIONE DEL COLLAUDO / REPORT AUTHORISATION',{bold:true,size:18,color:C.white})],{align:AlignmentType.CENTER})],columnSpan:4,shading:{fill:C.primary,type:ShadingType.CLEAR},margins:{top:80,bottom:80,left:80,right:80}})]}),
        new TableRow({children:[lbl('Controllo effettuato il:',25),val('{inspectionDate}',25),lbl('Emissione certificato:',25),val('{certificateDate}',25)]}),
        new TableRow({children:[hdr('DATA / Date',20),hdr('IL RESPONSABILE / The Responsible',27),hdr('L\'ISPETTORE / The Inspector',27),hdr('IL CLIENTE / The Client',26)]}),
        new TableRow({children:[cell(''),cell('{responsible}'),cell('{inspector}'),cell('{clientRepresentative}')]}),
    ]});

    // Header identico a ISO9001-audit-report (tabella 2r x 3c)
    // [LOGO] | {client} | [LOGO_ORG]
    // VERBALE VT {reportNumber} {reportType} | {inspectionDate}
    var hdrTable = new Table({ width:{size:100,type:WidthType.PERCENTAGE}, borders:noBorder(), rows:[
        new TableRow({children:[
            cell([para([run('[LOGO]',{size:20})])],{noBorder:true,pct:20}),
            cell([para([run('{client}',{bold:true,size:20,color:C.primary})],{align:AlignmentType.CENTER})],{noBorder:true,pct:60}),
            cell([para([run('[LOGO_ORG]',{size:20})],{align:AlignmentType.RIGHT})],{noBorder:true,pct:20}),
        ]}),
        new TableRow({children:[
            cell([para([run('',{size:16})])],{noBorder:true,pct:20}),
            cell([para([run('VERBALE VT {reportNumber} {reportType}',{bold:true,size:16,color:C.primary})],{align:AlignmentType.CENTER})],{noBorder:true,pct:60}),
            cell([para([run('{inspectionDate}',{size:16})],{align:AlignmentType.RIGHT})],{noBorder:true,pct:20}),
        ]}),
    ]});

    return new Document({ sections:[{
        properties:{ page:{ margin:{ top:convertInchesToTwip(1.0),bottom:convertInchesToTwip(0.6),left:convertInchesToTwip(0.8),right:convertInchesToTwip(0.8),header:convertInchesToTwip(0.4) } } },
        headers:{ default: new Header({ children:[hdrTable] }) },
        footers:{ default: new Footer({ children:[
            new Table({ width:{size:100,type:WidthType.PERCENTAGE}, borders:noBorder(), rows:[new TableRow({children:[
                cell([para([run('{reportType}-{reportNumber}-{reportYear}',{size:16})])],{noBorder:true}),
                cell([para([new TextRun({children:[PageNumber.CURRENT],size:16,font:'Arial'})],{align:AlignmentType.CENTER})],{noBorder:true}),
                cell([para([run('Generato il {generatedAt}',{size:16})],{align:AlignmentType.RIGHT})],{noBorder:true}),
            ]})]}),
        ]}) },
        children:[
            tblHeader, para('',{after:160}),
            tblStrumenti, para('',{after:160}),
            tblMarche, para('',{after:160}),
            tblFirme,
        ],
    }]});
}

var outPath = path.resolve(__dirname, '../public/templates/VT-verbale.docx');
Packer.toBuffer(buildDoc()).then(function(buf) {
    fs.writeFileSync(outPath, buf);
    console.log('[OK] Template generato: ' + outPath);
}).catch(function(e) { console.error('[ERRORE]', e.message); process.exit(1); });
