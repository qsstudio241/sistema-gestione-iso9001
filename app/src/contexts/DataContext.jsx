import React, { createContext, useContext, useState, useEffect } from "react";

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error(
      "useData deve essere utilizzato all'interno di DataProvider"
    );
  }
  return context;
};

export const DataProvider = ({ children }) => {
  // Stati per le diverse entità del SGQ ISO 9001
  const [audits, setAudits] = useState([]);
  const [nonConformita, setNonConformita] = useState([]);
  const [contesto, setContesto] = useState({
    fattoriInterni: [],
    fattoriEsterni: [],
    partiInteressate: [],
  });
  const [processi, setProcessi] = useState([]);
  const [rischiOpportunita, setRischiOpportunita] = useState([]);
  const [documenti, setDocumenti] = useState([]);

  // Carica dati da localStorage al mount (backup)
  useEffect(() => {
    const loadFromLocalStorage = () => {
      try {
        const savedAudits = localStorage.getItem("sgq_audits");
        const savedNonConformita = localStorage.getItem("sgq_non_conformita");
        const savedContesto = localStorage.getItem("sgq_contesto");
        const savedProcessi = localStorage.getItem("sgq_processi");
        const savedRischi = localStorage.getItem("sgq_rischi_opportunita");
        const savedDocumenti = localStorage.getItem("sgq_documenti");

        if (savedAudits) setAudits(JSON.parse(savedAudits));
        if (savedNonConformita)
          setNonConformita(JSON.parse(savedNonConformita));
        if (savedContesto) setContesto(JSON.parse(savedContesto));
        if (savedProcessi) setProcessi(JSON.parse(savedProcessi));
        if (savedRischi) setRischiOpportunita(JSON.parse(savedRischi));
        if (savedDocumenti) setDocumenti(JSON.parse(savedDocumenti));
      } catch (error) {
        console.error("Errore nel caricamento da localStorage:", error);
      }
    };

    loadFromLocalStorage();
  }, []);

  // Sincronizza con localStorage ad ogni modifica (backup automatico)
  useEffect(() => {
    localStorage.setItem("sgq_audits", JSON.stringify(audits));
  }, [audits]);

  useEffect(() => {
    localStorage.setItem("sgq_non_conformita", JSON.stringify(nonConformita));
  }, [nonConformita]);

  useEffect(() => {
    localStorage.setItem("sgq_contesto", JSON.stringify(contesto));
  }, [contesto]);

  useEffect(() => {
    localStorage.setItem("sgq_processi", JSON.stringify(processi));
  }, [processi]);

  useEffect(() => {
    localStorage.setItem(
      "sgq_rischi_opportunita",
      JSON.stringify(rischiOpportunita)
    );
  }, [rischiOpportunita]);

  useEffect(() => {
    localStorage.setItem("sgq_documenti", JSON.stringify(documenti));
  }, [documenti]);

  // Funzioni per gestire Audit (Punto 9.2)
  const addAudit = (audit) => {
    const newAudit = {
      ...audit,
      id: Date.now(),
      dataCreazione: new Date().toISOString(),
      stato: "pianificato",
    };
    setAudits((prev) => [...prev, newAudit]);
    return newAudit;
  };

  const updateAudit = (id, updatedData) => {
    setAudits((prev) =>
      prev.map((audit) =>
        audit.id === id ? { ...audit, ...updatedData } : audit
      )
    );
  };

  const deleteAudit = (id) => {
    setAudits((prev) => prev.filter((audit) => audit.id !== id));
  };

  // Funzioni per gestire Non Conformità (Punto 10.2)
  const addNonConformita = (nc) => {
    const newNC = {
      ...nc,
      id: Date.now(),
      dataRilevazione: new Date().toISOString(),
      stato: "aperta",
    };
    setNonConformita((prev) => [...prev, newNC]);
    return newNC;
  };

  const updateNonConformita = (id, updatedData) => {
    setNonConformita((prev) =>
      prev.map((nc) => (nc.id === id ? { ...nc, ...updatedData } : nc))
    );
  };

  const deleteNonConformita = (id) => {
    setNonConformita((prev) => prev.filter((nc) => nc.id !== id));
  };

  // Funzioni per gestire Contesto dell'Organizzazione (Punto 4)
  const updateContesto = (tipo, data) => {
    setContesto((prev) => ({
      ...prev,
      [tipo]: data,
    }));
  };

  // Funzioni per gestire Processi (Punto 4.4)
  const addProcesso = (processo) => {
    const newProcesso = {
      ...processo,
      id: Date.now(),
    };
    setProcessi((prev) => [...prev, newProcesso]);
    return newProcesso;
  };

  const updateProcesso = (id, updatedData) => {
    setProcessi((prev) =>
      prev.map((proc) => (proc.id === id ? { ...proc, ...updatedData } : proc))
    );
  };

  const deleteProcesso = (id) => {
    setProcessi((prev) => prev.filter((proc) => proc.id !== id));
  };

  // Funzioni per gestire Rischi e Opportunità (Punto 6.1)
  const addRischioOpportunita = (item) => {
    const newItem = {
      ...item,
      id: Date.now(),
      dataValutazione: new Date().toISOString(),
    };
    setRischiOpportunita((prev) => [...prev, newItem]);
    return newItem;
  };

  const updateRischioOpportunita = (id, updatedData) => {
    setRischiOpportunita((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updatedData } : item))
    );
  };

  const deleteRischioOpportunita = (id) => {
    setRischiOpportunita((prev) => prev.filter((item) => item.id !== id));
  };

  // Funzioni per gestire Documenti (Punto 7.5)
  const addDocumento = (documento) => {
    const newDoc = {
      ...documento,
      id: Date.now(),
      dataCreazione: new Date().toISOString(),
    };
    setDocumenti((prev) => [...prev, newDoc]);
    return newDoc;
  };

  const updateDocumento = (id, updatedData) => {
    setDocumenti((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, ...updatedData } : doc))
    );
  };

  const deleteDocumento = (id) => {
    setDocumenti((prev) => prev.filter((doc) => doc.id !== id));
  };

  // Funzione per ottenere tutti i dati (per export)
  const getAllData = () => ({
    audits,
    nonConformita,
    contesto,
    processi,
    rischiOpportunita,
    documenti,
    exportDate: new Date().toISOString(),
  });

  // Funzione per importare dati
  const importData = (data) => {
    if (data.audits) setAudits(data.audits);
    if (data.nonConformita) setNonConformita(data.nonConformita);
    if (data.contesto) setContesto(data.contesto);
    if (data.processi) setProcessi(data.processi);
    if (data.rischiOpportunita) setRischiOpportunita(data.rischiOpportunita);
    if (data.documenti) setDocumenti(data.documenti);
  };

  const value = {
    // Stati
    audits,
    nonConformita,
    contesto,
    processi,
    rischiOpportunita,
    documenti,

    // Funzioni Audit
    addAudit,
    updateAudit,
    deleteAudit,

    // Funzioni Non Conformità
    addNonConformita,
    updateNonConformita,
    deleteNonConformita,

    // Funzioni Contesto
    updateContesto,

    // Funzioni Processi
    addProcesso,
    updateProcesso,
    deleteProcesso,

    // Funzioni Rischi e Opportunità
    addRischioOpportunita,
    updateRischioOpportunita,
    deleteRischioOpportunita,

    // Funzioni Documenti
    addDocumento,
    updateDocumento,
    deleteDocumento,

    // Utility
    getAllData,
    importData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
