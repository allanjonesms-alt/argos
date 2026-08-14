import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { GoogleGenAI } from '@google/genai';
import { Siren } from 'lucide-react';
import { User } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { extractCityFromAddress } from '../lib/utils';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface ImportReportsProps {
  user: User | null;
}

const ImportReports: React.FC<ImportReportsProps> = ({ user }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [extractedReports, setExtractedReports] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savingStatus, setSavingStatus] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [isSavingAll, setIsSavingAll] = useState(false);
  const [saveAllProgress, setSaveAllProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const extractTextFromPDF = async (file: File, onProgress: (p: number) => void) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    const totalPages = pdf.numPages;
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(' ');
      onProgress((i / totalPages) * 40); // PDF parsing up to 40%
    }
    return text;
  };

  const processPDF = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setProgressText('Lendo páginas do PDF...');
    try {
      const text = await extractTextFromPDF(file, (p) => setProgress(p));
      
      const reportRegex = /RELATÓRIO\s+DETALHADO\s+DO\s+ATENDIMENTO\s+SS\s+Solicitação\s+de\s+Serviço:\s+\d+[\s\S]*?(?=RELATÓRIO\s+DETALHADO\s+DO\s+ATENDIMENTO\s+SS\s+Solicitação\s+de\s+Serviço:|$)/g;
      const reports = text.match(reportRegex) || [];
      
      if (reports.length === 0) {
        throw new Error('Nenhum relatório encontrado no PDF.');
      }

      setProgress(50);
      setProgressText(`Analisando ${reports.length} relatório(s) com IA...`);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Extract the following information from each of the provided military police reports and return as a JSON array of objects with these exact keys: "ssNumber" (10 digits), "date" (formatted as YYYY-MM-DD), "time", "facts", "personnel", "eventoComunicado" (the exact or closely derived name of the event from the report such as "POLICIAMENTO PREVENTIVO OSTENSIVO - RONDA", "ATENDIMENTO DE CHAMADA", "EVENTO", "MEDIDA PROTETIVA", "RONDAS"), "roData" (if "DADOS DO RO" is present in the report, extract the list of events listed after it as an array of strings; otherwise set to null), and "roAddress" (extract the occurrence address and format it as: "RUA [STREET], [NUMBER] - [NEIGHBORHOOD] - [CITY]". Always try to find the address, it might be near the start or in sections like "LOCAL DA OCORRÊNCIA").
        
        Reports: ${JSON.stringify(reports)}`,
        config: {
          responseMimeType: 'application/json',
        }
      });
      
      setProgress(85);
      setProgressText('Verificando relatórios existentes...');

      const parsedReports = JSON.parse(response.text || '[]');

      // Check for existing reports
      const ssSnapshot = await getDocs(collection(db, 'occurrences'));
      const roSnapshot = await getDocs(collection(db, 'occurrences_ro'));
      const existingSS = new Set(ssSnapshot.docs.map(d => d.id));
      const existingRO = new Set(roSnapshot.docs.map(d => d.id));

      const reportsWithStatus = parsedReports.map((r: any) => ({
        ...r,
        isSaved: r.roData ? existingRO.has(r.ssNumber) : existingSS.has(r.ssNumber)
      }));

      setExtractedReports(reportsWithStatus);
      setProgress(100);
      setProgressText('Processamento concluído!');
    } catch (err: any) {
      console.error('Error processing PDF:', err);
      setProgressText('Erro: ' + err.message);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setProgressText(prev => prev === 'Processamento concluído!' ? '' : prev);
      }, 3000);
    }
  };

  const saveReport = async (report: any) => {
    console.log('Saving report:', report);
    const ssNumber = report.ssNumber;
    if (!ssNumber) {
      console.error('Missing ssNumber in report:', report);
      return;
    }
    const isRO = !!report.roData;
    const collectionName = isRO ? 'occurrences_ro' : 'occurrences';
    const city = extractCityFromAddress(report.roAddress || '');
    
    let tipoSS: 'Rondas' | 'Policiamento em evento' | 'Policiamento Medidas Protetivas' | 'Atendimento de Chamada' = 'Atendimento de Chamada';
    if (report.eventoComunicado) {
      const ev = report.eventoComunicado.toUpperCase();
      if (ev.includes('RONDA') || ev.includes('POLICIAMENTO PREVENTIVO')) tipoSS = 'Rondas';
      else if (ev.includes('EVENTO')) tipoSS = 'Policiamento em evento';
      else if (ev.includes('MEDIDA PROTETIVA') || ev.includes('MARIA DA PENHA') || ev.includes('VIOLÊNCIA DOMÉSTICA') || ev.includes('VIOLENCIA DOMESTICA')) tipoSS = 'Policiamento Medidas Protetivas';
    }

    setSavingStatus(prev => ({ ...prev, [ssNumber]: 'Salvando...' }));
    try {
      const docData = isRO ? {
        nr_ro: ssNumber,
        fato: report.roData || report.eventoComunicado,
        roData: report.roData,
        roAddress: report.roAddress,
        cidade: city || 'N/I',
        date: report.date,
        time: report.time,
        facts: report.facts,
        personnel: report.personnel,
        eventoComunicado: report.eventoComunicado,
        unidade: user?.unidade,
        criado_por: user?.nome,
        created_at: new Date().toISOString()
      } : {
        nr_ss: ssNumber,
        tipo_ss: tipoSS,
        gu_servico: [], // Default empty
        cidade: city || 'N/I',
        date: report.date,
        time: report.time,
        facts: report.facts,
        personnel: report.personnel,
        eventoComunicado: report.eventoComunicado,
        roAddress: report.roAddress,
        unidade: user?.unidade,
        criado_por: user?.nome,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, collectionName, ssNumber), {
        ...docData,
        updated_at: serverTimestamp(),
        created_by: user?.id
      });
      setSavingStatus(prev => ({ ...prev, [ssNumber]: 'Salvo!' }));
      // Update local state to reflect saved status
      setExtractedReports(prev => prev.map(r => r.ssNumber === ssNumber ? { ...r, isSaved: true } : r));
    } catch (err) {
      console.error('Error saving report:', err);
      handleFirestoreError(err, OperationType.WRITE, collectionName);
      setSavingStatus(prev => ({ ...prev, [ssNumber]: 'Erro ao salvar' }));
    }
  };

  const saveAllReports = async () => {
    setIsSavingAll(true);
    setSaveAllProgress(0);
    
    // Create an array of reports that still need to be saved
    const reportsToSave = extractedReports.filter(r => !r.isSaved && savingStatus[r.ssNumber] !== 'Salvo!');
    
    let savedCount = 0;
    
    for (const report of reportsToSave) {
      await saveReport(report);
      savedCount++;
      setSaveAllProgress((savedCount / reportsToSave.length) * 100);
    }
    
    setIsSavingAll(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <h2 className="text-2xl font-black text-navy-950 uppercase tracking-tighter">Importar Relatórios</h2>
      <div className="bg-white border border-navy-100 rounded-3xl p-6 shadow-lg">
        <input type="file" accept="application/pdf" onChange={handleFileChange} className="mb-4 block w-full text-sm text-navy-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-black file:uppercase file:bg-navy-50 file:text-navy-900 hover:file:bg-navy-100" />
        <button 
          onClick={processPDF} 
          disabled={!file || isProcessing}
          className="bg-navy-900 text-white font-black py-2.5 px-6 rounded-xl uppercase text-xs disabled:opacity-50"
        >
          {isProcessing ? 'Processando...' : 'Extrair Informações'}
        </button>

        {(isProcessing || progressText) && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-navy-600 uppercase">{progressText}</span>
              {isProcessing && <span className="text-xs font-black text-navy-900">{Math.round(progress)}%</span>}
            </div>
            <div className="w-full bg-navy-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-navy-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
      
      {extractedReports.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-navy-950 uppercase">Relatórios Encontrados</h3>
              <p className="text-xs text-navy-600 mt-1 uppercase font-semibold">
                {extractedReports.filter(r => !r.roData).length} SS / {extractedReports.filter(r => r.roData).length} RO
              </p>
            </div>
            {extractedReports.some(r => !r.isSaved && savingStatus[r.ssNumber] !== 'Salvo!') && (
              <button 
                onClick={saveAllReports}
                disabled={isSavingAll}
                className="bg-emerald-600 text-white font-black py-2 px-4 rounded-xl uppercase text-xs hover:bg-emerald-500 disabled:opacity-50"
              >
                {isSavingAll ? 'SALVANDO TODOS...' : 'SALVAR TODOS'}
              </button>
            )}
          </div>
          
          {isSavingAll && (
            <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-emerald-600 uppercase">Progresso (Salvando 1 por vez para evitar conflitos)</span>
                <span className="text-xs font-black text-emerald-900">{Math.round(saveAllProgress)}%</span>
              </div>
              <div className="w-full bg-emerald-50 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${saveAllProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {extractedReports.map((report, index) => (
            <div key={index} className={`border rounded-2xl p-4 shadow-sm flex items-center justify-between ${report.roData ? 'bg-white border-red-300' : 'bg-white border-navy-100'}`}>
              <div>
                <p className={`font-bold ${report.roData ? 'text-red-600' : 'text-navy-950'}`}>
                  {report.roData && <Siren size={16} className="inline mr-2" />}
                  {report.roData ? 'RO' : 'SS'}: {report.ssNumber}
                </p>
                <p className="text-xs text-navy-500">{report.date} - {report.time}</p>
                <div className="text-sm text-navy-800 mt-1">
                  <p className="font-semibold">
                    {report.roData ? 'Eventos Constatados:' : 'Evento Comunicado:'}
                  </p>
                  {report.roData && Array.isArray(report.roData) ? (
                    <ul className="list-disc list-inside mt-1">
                      {report.roData.map((event: string, i: number) => (
                        <li key={i} className="text-sm text-navy-800">{event}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>{report.eventoComunicado}</p>
                  )}
                </div>
                {report.roAddress && (
                  <p className="text-xs text-navy-800 mt-1">
                    ENDEREÇO: {report.roAddress}
                  </p>
                )}
              </div>
              <button 
                onClick={() => saveReport(report)}
                disabled={report.isSaved || savingStatus[report.ssNumber] === 'Salvo!'}
                className={`${report.isSaved || savingStatus[report.ssNumber] === 'Salvo!' ? 'bg-green-600' : 'bg-navy-600'} text-white font-black py-2 px-4 rounded-xl uppercase text-xs hover:bg-navy-500`}
              >
                {report.isSaved || savingStatus[report.ssNumber] === 'Salvo!' ? 'SALVO!' : (savingStatus[report.ssNumber] || 'Salvar')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImportReports;
