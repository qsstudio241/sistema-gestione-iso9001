/**
 * Router unico verso i viewer Office in-app (chrome condiviso + schermo intero).
 * Usare per allegati (blob) e per qualsiasi punto che non sia già DocFileDialog.
 */
import React from "react";
import DocumentDocxViewer from "./DocumentDocxViewer";
import SpreadsheetViewer from "./SpreadsheetViewer";

export default function InAppOfficeViewer({ kind, file, fileName, onClose }) {
  if (kind === "word") {
    return (
      <DocumentDocxViewer
        file={file}
        fileName={fileName}
        onClose={onClose}
      />
    );
  }
  if (kind === "excel") {
    return (
      <SpreadsheetViewer
        file={file}
        fileName={fileName}
        onClose={onClose}
      />
    );
  }
  return null;
}
