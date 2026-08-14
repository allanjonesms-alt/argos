import jsPDF from 'jspdf';

export interface Dependente {
  id: string;
  nome: string;
  tipo: string;
  dataNascimento: string;
}

export interface Curso {
  id: string;
  curso: string;
  local: string;
  ano: string;
}

export interface Promocao {
  id: string;
  postoGrad: string;
  dataPromocao: string;
  doe: string;
  dataDoe: string;
}

export interface Averbacao {
  id: string;
  tipo: string;
  nrCertidao: string;
  dataCertidao: string;
  doe: string;
  dataPublicacao: string;
  totalDias: string;
}

export interface Deducao {
  id: string;
  tipo: string;
  dataInicial: string;
  dataFinal: string;
  doe: string;
  dataPublicacao: string;
}

export interface DecenioData {
  qtdDias: string;
  bcg: string;
  dataBcg: string;
}

export interface LicencaEspecialSection {
  primeiroDecenio: DecenioData;
  segundoDecenio: DecenioData;
  terceiroDecenio: DecenioData;
}

export interface LicencaEspecial {
  concessao: LicencaEspecialSection;
  fruicao: LicencaEspecialSection;
}

export interface ProfileData {
  full_name: string;
  war_name: string;
  registration: string;
  phone: string;
  email: string;
  rank: string;
  status: string;
  garrison: string;
  unidade: string;
}

export interface RequestData {
  requestTitle: string;
  profile: ProfileData;
  cpf: string;
  rg: string;
  dataInclusao: string;
  doeInclusao: string;
  dataDiario: string;
  pagina: string;
  tempoServico: string;
  filiacao: string;
  pai: string;
  mae: string;
  naturalidade: string;
  endereco: string;
  dependentes: Dependente[];
  cursos: Curso[];
  promocoes: Promocao[];
  licencaEspecial: LicencaEspecial;
  justification: string;
  amparoLegal: string;
  incorporacao?: string;
  averbacao?: Averbacao[];
  deducao?: Deducao[];
  licencaInteresseParticular?: { sim: boolean; periodo?: string };
  respondeProcesso?: { sim: boolean };
  condenacao?: { sim: boolean; pena?: string };
  comandante?: {
    nome_completo: string;
    patente: string;
    posto: string;
    matricula: string;
  };
}

// Load image as base64 using canvas conversion to guarantee clean PNG data URL format
async function loadImageAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        if (img.width === 0 || img.height === 0) {
          resolve(null);
          return;
        }
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl);
      } catch (err) {
        console.warn(`Could not convert image at ${url} to canvas PNG:`, err);
        resolve(null);
      }
    };
    img.onerror = () => {
      // Try direct fetch fallback if Image element fails
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error('Fetch failed');
          const ct = res.headers.get('content-type') || '';
          if (ct.includes('text/html') || !ct.startsWith('image/')) throw new Error('Not an image');
          return res.blob();
        })
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else resolve(null);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(null));
    };
    img.src = url;
  });
}

export async function generateRequestPdf(data: RequestData): Promise<void> {
  // Explicitly set A4 format (portrait, mm, a4)
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 12;
  const lineHeight = 5;
  const contentWidth = pageWidth - 2 * margin;
  const fontSize = 11;

  // Load header images
  let pmmsImage: string | null = null;
  let sejuspImage: string | null = null;
  
  try {
    pmmsImage = (await loadImageAsBase64('/images/pmms.png')) || (await loadImageAsBase64('/images/pmms.jpg'));
  } catch (error) {
    console.warn('Could not load pmms header image:', error);
  }

  try {
    sejuspImage = (await loadImageAsBase64('/images/sejusp.png')) || (await loadImageAsBase64('/images/sejusp.jpg'));
  } catch (error) {
    console.warn('Could not load sejusp header image:', error);
  }

  // Helper: format empty values with ****
  const formatValue = (value: any): string => {
    if (value === undefined || value === null) {
      return '****';
    }
    const str = String(value).trim();
    if (str === '') {
      return '****';
    }
    return str;
  };

  // Helper: format CPF with dots and dash (XXX.XXX.XXX-XX)
  const formatCpf = (cpf: any): string => {
    if (!cpf) {
      return 'XXX.XXX.XXX-XX';
    }
    const str = String(cpf).trim();
    if (str === '') {
      return 'XXX.XXX.XXX-XX';
    }
    // Remove all non-digits
    const digits = str.replace(/\D/g, '');
    if (digits.length !== 11) {
      return str; // Return as-is if not 11 digits
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
  };

  // Helper: format date in Portuguese (e.g., "05 de outubro de 2008")
  const formatDatePtBr = (dateStr: any): string => {
    if (!dateStr) {
      return '';
    }
    const str = String(dateStr).trim();
    if (str === '') {
      return '';
    }
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const date = new Date(str.includes('T') ? str : str + 'T00:00:00');
    if (isNaN(date.getTime())) {
      return str; // Return as-is if invalid
    }
    const day = String(date.getDate()).padStart(2, '0');
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} de ${month} de ${year}`;
  };

  // Helper: format date as dd/mm/yyyy
  const formatDateDDMMYYYY = (dateStr: any): string => {
    if (!dateStr) {
      return '';
    }
    const str = String(dateStr).trim();
    if (str === '') {
      return '';
    }
    // Already in dd/mm/yyyy format
    if (str.includes('/')) {
      return str;
    }
    // ISO format YYYY-MM-DD
    if (str.includes('-')) {
      const parts = str.split('T')[0].split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return str;
  };

  // Helper: check page break (2.5cm = 25mm bottom margin)
  const bottomMargin = 25;
  const checkPageBreak = (neededSpace: number) => {
    if (yPos + neededSpace > pageHeight - bottomMargin) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Helper: section header with dark blue background (unused here but kept for API match)
  // const addSectionHeader = (text: string) => { ... }

  // Helper: add field (label: value) (unused here but kept for API match)
  // const addField = (label: string, value: string) => { ... }

  // Helper: add text block (unused here but kept for API match)
  // const addText = (text: string) => { ... }

  // ==================== HEADER WITH IMAGES ====================
  // PMMS: 2.40cm x 6.90cm = 24mm x 69mm (width x height)
  // SEJUSP: 2.40cm x 9.80cm = 24mm x 98mm (width x height)
  // Note: jsPDF uses mm by default
  const pmmsWidth = 24; // 2.40cm in mm (square crest)
  const pmmsHeight = 24; // 2.40cm in mm
  const sejuspWidth = 24; // 2.40cm in mm (square coat of arms)
  const sejuspHeight = 24; // 2.40cm in mm

  const isValidBase64Image = (str: string | null | undefined): boolean => {
    if (!str) return false;
    return str.startsWith('data:image/png') || str.startsWith('data:image/jpeg') || str.startsWith('data:image/jpg');
  };

  if (isValidBase64Image(pmmsImage) || isValidBase64Image(sejuspImage)) {
    if (isValidBase64Image(pmmsImage)) {
      try {
        const fmt = pmmsImage!.includes('image/jpeg') || pmmsImage!.includes('image/jpg') ? 'JPEG' : 'PNG';
        doc.addImage(pmmsImage!, fmt, margin, yPos, pmmsWidth, pmmsHeight);
      } catch (err) {
        console.warn('Failed to add pmmsImage to PDF:', err);
      }
    }
    if (isValidBase64Image(sejuspImage)) {
      try {
        const fmt = sejuspImage!.includes('image/jpeg') || sejuspImage!.includes('image/jpg') ? 'JPEG' : 'PNG';
        doc.addImage(sejuspImage!, fmt, pageWidth - margin - sejuspWidth, yPos, sejuspWidth, sejuspHeight);
      } catch (err) {
        console.warn('Failed to add sejuspImage to PDF:', err);
      }
    }
    yPos += Math.max(pmmsHeight, sejuspHeight) + 2;
  } else {
    yPos = 15; // Elegant fallback compact margin
  }

  // Unit header - cell with 100% width, only bottom border, left aligned
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  doc.text('5º Batalhão de Polícia Militar / CPA-6', margin, yPos);
  yPos += 1;
  doc.line(margin, yPos, margin + contentWidth, yPos); // Bottom border only
  yPos += 5;

  // REQUERIMENTO title in a cell with all borders, thicker top border, centered
  const titleCellHeight = 8;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.8); // Thicker top border
  doc.line(margin, yPos, margin + contentWidth, yPos); // Top border (thicker)
  doc.setLineWidth(0.3); // Normal thickness for other borders
  doc.line(margin, yPos, margin, yPos + titleCellHeight); // Left border
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + titleCellHeight); // Right border
  doc.line(margin, yPos + titleCellHeight, margin + contentWidth, yPos + titleCellHeight); // Bottom border
  
  doc.setFontSize(12);
  doc.setFont('times', 'bold');
  doc.text('REQUERIMENTO', pageWidth / 2, yPos + titleCellHeight / 2 + 1.5, { align: 'center' });
  yPos += titleCellHeight + 3;

  // ==================== DADOS DO REQUERENTE ====================
  // Table with all borders visible
  const baseRowHeight = 6;
  const col1Width = contentWidth * 0.4; // 40%
  const col2Width = contentWidth * 0.3; // 30%
  const col3Width = contentWidth * 0.3; // 30%
  
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.setFontSize(fontSize);
  
  // Helper function to draw a cell with wrapped text
  const drawCell = (x: number, y: number, width: number, height: number, label: string, value: any, labelBold: boolean = true) => {
    doc.rect(x, y, width, height, 'S');
    const cellPadding = 2;
    const labelSpacing = 0.5;
    
    if (labelBold) {
      doc.setFont('times', 'bold');
    }
    doc.text(label, x + cellPadding, y + 4);
    const labelWidth = doc.getTextWidth(label);
    
    doc.setFont('times', 'normal');
    const maxValueWidth = Math.max(width - cellPadding * 2 - labelWidth - labelSpacing, 10);
    const strValue = value !== undefined && value !== null ? String(value) : '****';
    const lines = doc.splitTextToSize(strValue, maxValueWidth);
    doc.text(lines, x + cellPadding + labelWidth + labelSpacing, y + 4);
  };

  // Helper function to calculate required row height based on content
  const calcRowHeight = (texts: { value: any; maxWidth: number }[]): number => {
    let maxLines = 1;
    texts.forEach(({ value, maxWidth }) => {
      const str = value !== undefined && value !== null ? String(value) : '';
      const safeWidth = Math.max(maxWidth, 10);
      const lines = doc.splitTextToSize(str, safeWidth);
      if (lines.length > maxLines) maxLines = lines.length;
    });
    return Math.max(baseRowHeight, maxLines * lineHeight + 2);
  };

  // Row 1: Header "DADOS DO REQUERENTE" - single cell, centered, no background
  checkPageBreak(baseRowHeight);
  doc.setFont('times', 'bold');
  doc.rect(margin, yPos, contentWidth, baseRowHeight, 'S');
  doc.text('DADOS DO REQUERENTE', pageWidth / 2, yPos + baseRowHeight / 2 + 1.5, { align: 'center' });
  yPos += baseRowHeight;
  
  // Row 2: NOME (40%) | MAT. (30%) | UNIDADE (30%)
  const nomeValue = formatValue(data.profile.full_name);
  const matValue = formatValue(data.profile.registration);
  const unidadeValue = data.profile.unidade || '5º BPM';
  
  const row2Height = calcRowHeight([
    { value: nomeValue, maxWidth: col1Width - 4 - doc.getTextWidth('NOME: ') - 3 },
    { value: matValue, maxWidth: col2Width - 4 - doc.getTextWidth('MAT.: ') - 3 },
    { value: unidadeValue, maxWidth: col3Width - 4 - doc.getTextWidth('UNIDADE: ') - 3 }
  ]);
  
  checkPageBreak(row2Height);
  drawCell(margin, yPos, col1Width, row2Height, 'NOME: ', nomeValue);
  drawCell(margin + col1Width, yPos, col2Width, row2Height, 'MAT.: ', matValue);
  drawCell(margin + col1Width + col2Width, yPos, col3Width, row2Height, 'UNIDADE: ', unidadeValue);
  yPos += row2Height;
  
  // Row 3: POSTO/GRADUAÇÃO (40%) | RG (30%) | CPF (30%)
  const postoValue = formatValue(data.profile.rank);
  const rgValue = formatValue(data.rg);
  const cpfValue = formatCpf(data.cpf);
  
  const row3Height = calcRowHeight([
    { value: postoValue, maxWidth: col1Width - 4 - doc.getTextWidth('POSTO/GRAD.: ') - 3 },
    { value: rgValue, maxWidth: col2Width - 4 - doc.getTextWidth('RG: ') - 3 },
    { value: cpfValue, maxWidth: col3Width - 4 - doc.getTextWidth('CPF: ') - 3 }
  ]);
  
  checkPageBreak(row3Height);
  drawCell(margin, yPos, col1Width, row3Height, 'POSTO/GRAD.: ', postoValue);
  drawCell(margin + col1Width, yPos, col2Width, row3Height, 'RG: ', rgValue);
  drawCell(margin + col1Width + col2Width, yPos, col3Width, row3Height, 'CPF: ', cpfValue);
  yPos += row3Height;
  
  // Row 4: INCLUSÃO (40%) | TEMPO DE SERVIÇO (60%)
  const dataDiarioFormatted = formatDatePtBr(data.dataDiario);
  const dataInclusaoFormatted = formatDateDDMMYYYY(data.dataInclusao);
  const inclusaoFormatted = dataInclusaoFormatted 
    ? `${dataInclusaoFormatted}${data.doeInclusao ? ` - ${data.doeInclusao}` : ''}${dataDiarioFormatted ? ` de ${dataDiarioFormatted}` : ''}${data.pagina ? `, pág. ${data.pagina}` : ''}`
    : 'XXXXXXXXXX';
  const tempoValue = formatValue(data.tempoServico);
  
  const row4Height = calcRowHeight([
    { value: inclusaoFormatted, maxWidth: col1Width - 4 - doc.getTextWidth('INCLUSÃO: ') - 3 },
    { value: tempoValue, maxWidth: (col2Width + col3Width) - 4 - doc.getTextWidth('TEMPO DE SERVIÇO: ') - 3 }
  ]);
  
  checkPageBreak(row4Height);
  drawCell(margin, yPos, col1Width, row4Height, 'INCLUSÃO: ', inclusaoFormatted);
  drawCell(margin + col1Width, yPos, col2Width + col3Width, row4Height, 'TEMPO DE SERVIÇO: ', tempoValue);
  yPos += row4Height;
  
  // Row 5: FILIAÇÃO (100% - single column with Pai e Mãe)
  // Only show values that are filled, leave blank if empty
  const paiValue = data.pai?.trim() || '';
  const maeValue = data.mae?.trim() || '';
  let filiacaoText = '';
  if (paiValue && maeValue) {
    filiacaoText = `${paiValue} e ${maeValue}`;
  } else if (paiValue) {
    filiacaoText = paiValue;
  } else if (maeValue) {
    filiacaoText = maeValue;
  }
  const row5Height = calcRowHeight([
    { value: filiacaoText || ' ', maxWidth: contentWidth - 4 - doc.getTextWidth('FILIAÇÃO: ') - 3 }
  ]);
  checkPageBreak(row5Height);
  drawCell(margin, yPos, contentWidth, row5Height, 'FILIAÇÃO: ', filiacaoText);
  yPos += row5Height;
  
  // Row 6: NATURALIDADE (100% - single column)
  const naturalidadeValue = formatValue(data.naturalidade);
  const row6Height = calcRowHeight([
    { value: naturalidadeValue, maxWidth: contentWidth - 4 - doc.getTextWidth('NATURALIDADE: ') - 3 }
  ]);
  checkPageBreak(row6Height);
  drawCell(margin, yPos, contentWidth, row6Height, 'NATURALIDADE: ', naturalidadeValue);
  yPos += row6Height;
  
  // Row 7: ENDEREÇO (100% - single column)
  const enderecoValue = formatValue(data.endereco);
  const row7Height = calcRowHeight([
    { value: enderecoValue, maxWidth: contentWidth - 4 - doc.getTextWidth('ENDEREÇO: ') - 3 }
  ]);
  checkPageBreak(row7Height);
  drawCell(margin, yPos, contentWidth, row7Height, 'ENDEREÇO: ', enderecoValue);
  yPos += row7Height + 2;

  // ==================== JUNTADA DE DOCUMENTAÇÃO ====================
  // Table with header row - single column, bold, centered, thicker bottom border
  const juntadaContentHeight = 16;
  checkPageBreak(baseRowHeight + juntadaContentHeight + 4);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.setFontSize(11);
  
  // Row 1: Header "JUNTADA DE DOCUMENTAÇÃO NECESSÁRIA, REQUER"
  doc.setFont('times', 'bold');
  // Draw left, top, right borders with normal thickness
  doc.line(margin, yPos, margin, yPos + baseRowHeight); // Left
  doc.line(margin, yPos, margin + contentWidth, yPos); // Top
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + baseRowHeight); // Right
  // Draw bottom border with thicker line
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + baseRowHeight, margin + contentWidth, yPos + baseRowHeight); // Bottom (thicker)
  doc.setLineWidth(0.3);
  doc.text('JUNTADA DE DOCUMENTAÇÃO NECESSÁRIA, REQUER', pageWidth / 2, yPos + baseRowHeight / 2 + 1.5, { align: 'center' });
  yPos += baseRowHeight;
  
  // Row 2: Content with justification (Requerimento) data
  doc.rect(margin, yPos, contentWidth, juntadaContentHeight, 'S');
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  const justificationText = formatValue(data.justification);
  const justificationLines = doc.splitTextToSize(justificationText, contentWidth - 4);
  doc.text(justificationLines, margin + 2, yPos + 4);
  yPos += juntadaContentHeight + 2;

  // ==================== AMPARO LEGAL ====================
  // Row 1: Header with bold centered text and thicker bottom border (no fill)
  const amparoContentHeight = 16;
  checkPageBreak(baseRowHeight + amparoContentHeight + 4);

  doc.setDrawColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  // Draw left, top, right borders with normal thickness
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin, yPos + baseRowHeight); // Left
  doc.line(margin, yPos, margin + contentWidth, yPos); // Top
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + baseRowHeight); // Right
  // Draw bottom border with thicker line
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + baseRowHeight, margin + contentWidth, yPos + baseRowHeight); // Bottom (thicker)
  doc.setLineWidth(0.3);
  doc.text('AMPARO LEGAL', pageWidth / 2, yPos + baseRowHeight / 2 + 1.5, { align: 'center' });
  yPos += baseRowHeight;
  
  // Row 2: Content with Amparo Legal data
  doc.rect(margin, yPos, contentWidth, amparoContentHeight, 'S');
  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  const amparoText = formatValue(data.amparoLegal);
  const amparoLines = doc.splitTextToSize(amparoText, contentWidth - 4);
  doc.text(amparoLines, margin + 2, yPos + 4);
  yPos += amparoContentHeight + 2;

  // ==================== DEPENDENTES (TABLE) ====================
  // Check page break before section header + at least header columns row
  const depSectionMinHeight = baseRowHeight + 6 + 6; // header + column headers + at least one data row
  checkPageBreak(depSectionMinHeight);
  
  // Row 1: Header "DEPENDENTES" - single column, bold, centered, no background, thicker bottom border
  doc.setDrawColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  // Draw all borders with normal thickness
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin, yPos + baseRowHeight); // Left
  doc.line(margin, yPos, margin + contentWidth, yPos); // Top
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + baseRowHeight); // Right
  // Draw bottom border with thicker line
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + baseRowHeight, margin + contentWidth, yPos + baseRowHeight); // Bottom (thicker)
  doc.setLineWidth(0.3);
  doc.text('DEPENDENTES', pageWidth / 2, yPos + baseRowHeight / 2 + 1.5, { align: 'center' });
  yPos += baseRowHeight;
  
  // Row 2: Header columns - NOME (60%) | TIPO | DATA DE NASCIMENTO
  const depCol1Width = contentWidth * 0.6; // 60%
  const depCol2Width = contentWidth * 0.2; // 20%
  const depCol3Width = contentWidth * 0.2; // 20%
  const depRowHeight = 6;
  
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  
  // Draw header row cells
  doc.rect(margin, yPos, depCol1Width, depRowHeight, 'S');
  doc.rect(margin + depCol1Width, yPos, depCol2Width, depRowHeight, 'S');
  doc.rect(margin + depCol1Width + depCol2Width, yPos, depCol3Width, depRowHeight, 'S');
  
  // Header text - centered
  doc.text('NOME', margin + depCol1Width / 2, yPos + depRowHeight / 2 + 1.5, { align: 'center' });
  doc.text('TIPO', margin + depCol1Width + depCol2Width / 2, yPos + depRowHeight / 2 + 1.5, { align: 'center' });
  doc.text('DATA DE NASC.', margin + depCol1Width + depCol2Width + depCol3Width / 2, yPos + depRowHeight / 2 + 1.5, { align: 'center' });
  yPos += depRowHeight;
  
  // Data rows
  doc.setFont('times', 'normal');
  if (data.dependentes && data.dependentes.length > 0) {
    data.dependentes.forEach((dep) => {
      checkPageBreak(depRowHeight + 2);
      
      // Draw row cells
      doc.rect(margin, yPos, depCol1Width, depRowHeight, 'S');
      doc.rect(margin + depCol1Width, yPos, depCol2Width, depRowHeight, 'S');
      doc.rect(margin + depCol1Width + depCol2Width, yPos, depCol3Width, depRowHeight, 'S');
      
      // Data text - NOME left-aligned, TIPO and DATA centered
      doc.text(formatValue(dep.nome).substring(0, 50), margin + 2, yPos + depRowHeight / 2 + 1.5);
      doc.text(formatValue(dep.tipo).substring(0, 15), margin + depCol1Width + depCol2Width / 2, yPos + depRowHeight / 2 + 1.5, { align: 'center' });
      doc.text(formatDateDDMMYYYY(dep.dataNascimento) || formatValue(dep.dataNascimento), margin + depCol1Width + depCol2Width + depCol3Width / 2, yPos + depRowHeight / 2 + 1.5, { align: 'center' });
      
      yPos += depRowHeight;
    });
  } else {
    // Empty row when no dependents
    doc.rect(margin, yPos, depCol1Width, depRowHeight, 'S');
    doc.rect(margin + depCol1Width, yPos, depCol2Width, depRowHeight, 'S');
    doc.rect(margin + depCol1Width + depCol2Width, yPos, depCol3Width, depRowHeight, 'S');
    
    doc.text('****', margin + 2, yPos + depRowHeight / 2 + 1.5);
    doc.text('****', margin + depCol1Width + depCol2Width / 2, yPos + depRowHeight / 2 + 1.5, { align: 'center' });
    doc.text('****', margin + depCol1Width + depCol2Width + depCol3Width / 2, yPos + depRowHeight / 2 + 1.5, { align: 'center' });
    yPos += depRowHeight;
  }
  yPos += 2;

  // ==================== CURSOS (TABLE) ====================
  // Check page break before section header + at least one data row
  const cursoSectionMinHeight = baseRowHeight + 6; // header + at least one data row
  checkPageBreak(cursoSectionMinHeight);
  
  // Row 1: Header "CURSOS" - single column, bold, centered, all borders visible, thicker bottom border
  doc.setDrawColor(0, 0, 0);
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  // Draw all borders with normal thickness
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin, yPos + baseRowHeight); // Left
  doc.line(margin, yPos, margin + contentWidth, yPos); // Top
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + baseRowHeight); // Right
  // Draw bottom border with thicker line
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + baseRowHeight, margin + contentWidth, yPos + baseRowHeight); // Bottom (thicker)
  doc.setLineWidth(0.3);
  doc.text('CURSOS', pageWidth / 2, yPos + baseRowHeight / 2 + 1.5, { align: 'center' });
  yPos += baseRowHeight;
  
  // Data rows - columns: 25% | 50% | 25%
  const cursoCol1Width = contentWidth * 0.25; // 25%
  const cursoCol2Width = contentWidth * 0.50; // 50%
  const cursoCol3Width = contentWidth * 0.25; // 25%
  const cursoRowHeight = 6;
  
  doc.setFontSize(10);
  
  // Only render course rows if there are courses (no empty rows)
  if (data.cursos && data.cursos.length > 0) {
    data.cursos.forEach((curso) => {
      checkPageBreak(cursoRowHeight + 2);
      
      // Draw row cells
      doc.rect(margin, yPos, cursoCol1Width, cursoRowHeight, 'S');
      doc.rect(margin + cursoCol1Width, yPos, cursoCol2Width, cursoRowHeight, 'S');
      doc.rect(margin + cursoCol1Width + cursoCol2Width, yPos, cursoCol3Width, cursoRowHeight, 'S');
      
      // FORMAÇÃO: value - left aligned
      doc.setFont('times', 'bold');
      doc.text('FORMAÇÃO: ', margin + 2, yPos + cursoRowHeight / 2 + 1.5);
      const formacaoLabelWidth = doc.getTextWidth('FORMAÇÃO: ');
      doc.setFont('times', 'normal');
      doc.text(formatValue(curso.curso).substring(0, 20), margin + 2 + formacaoLabelWidth, yPos + cursoRowHeight / 2 + 1.5);
      
      // LOCAL: value - left aligned
      doc.setFont('times', 'bold');
      doc.text('LOCAL: ', margin + cursoCol1Width + 2, yPos + cursoRowHeight / 2 + 1.5);
      const localLabelWidth = doc.getTextWidth('LOCAL: ');
      doc.setFont('times', 'normal');
      doc.text(formatValue(curso.local).substring(0, 35), margin + cursoCol1Width + 2 + localLabelWidth, yPos + cursoRowHeight / 2 + 1.5);
      
      // ANO: value - left aligned
      doc.setFont('times', 'bold');
      doc.text('ANO: ', margin + cursoCol1Width + cursoCol2Width + 2, yPos + cursoRowHeight / 2 + 1.5);
      const anoLabelWidth = doc.getTextWidth('ANO: ');
      doc.setFont('times', 'normal');
      doc.text(formatValue(curso.ano).substring(0, 10), margin + cursoCol1Width + cursoCol2Width + 2 + anoLabelWidth, yPos + cursoRowHeight / 2 + 1.5);
      
      yPos += cursoRowHeight;
    });
  }
  // No empty rows rendered when there are no courses
  yPos += 2;

  // ==================== PROMOÇÕES (TABLE) ====================
  checkPageBreak(8); // header row only - allows table to split across pages
  
  // Table header - single column with title
  const promoRowHeight = 6;
  const promoCol1Width = contentWidth * 0.25;
  const promoCol2Width = contentWidth * 0.75;
  
  // Header row with "PROMOÇÕES"
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  
  // Draw header with thicker bottom border
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + contentWidth, yPos); // top
  doc.line(margin, yPos, margin, yPos + promoRowHeight); // left
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + promoRowHeight); // right
  doc.setLineWidth(0.6);
  doc.line(margin, yPos + promoRowHeight, margin + contentWidth, yPos + promoRowHeight); // bottom (thicker)
  doc.setLineWidth(0.3);
  
  // Center "PROMOÇÕES" text
  const promoHeaderText = 'PROMOÇÕES';
  const promoHeaderWidth = doc.getTextWidth(promoHeaderText);
  doc.text(promoHeaderText, margin + (contentWidth - promoHeaderWidth) / 2, yPos + promoRowHeight / 2 + 1.5);
  yPos += promoRowHeight;
  
  doc.setFontSize(10);
  
  // Helper function to format date in extensive format (e.g., "21 de abril de 2017")
  const formatDateExtensive = (dateStr: string): string => {
    if (!dateStr) return '';
    
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    
    // Try to parse date in format DD/MM/YYYY or YYYY-MM-DD
    let day: number, month: number, year: number;
    
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    } else if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      return dateStr;
    }
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return dateStr;
    
    return `${day} de ${months[month]} de ${year}`;
  };
  

  // Only render promotion rows if there are promotions
  if (data.promocoes && data.promocoes.length > 0) {
    data.promocoes.forEach((promo) => {
      checkPageBreak(promoRowHeight + 2);
      
      // Draw row cells
      doc.rect(margin, yPos, promoCol1Width, promoRowHeight, 'S');
      doc.rect(margin + promoCol1Width, yPos, promoCol2Width, promoRowHeight, 'S');
      
      // Column 1: Just the posto/grad value (no label)
      doc.setFont('times', 'normal');
      doc.text(promo.postoGrad || '', margin + 2, yPos + promoRowHeight / 2 + 1.5);
      
      // Column 2: A contar de... conforme DOE... (with DOE date in dd/mm/yyyy)
      const dataPromoExtensa = formatDateExtensive(promo.dataPromocao);
      const dataDoeFormatted = formatDateDDMMYYYY(promo.dataDoe);
      const promoDescText = `A contar de ${dataPromoExtensa}, conforme DOE nº ${promo.doe || ''} de ${dataDoeFormatted}`;
      doc.text(promoDescText, margin + promoCol1Width + 2, yPos + promoRowHeight / 2 + 1.5);
      
      yPos += promoRowHeight;
    });
  }
  // No empty rows rendered when there are no promotions
  yPos += 2;

  // ==================== INCORPORAÇÃO (TABLE) ====================
  checkPageBreak(8); // header row only - allows table to split across pages
  
  const incorpRowHeight = 6;
  
  // Header row with "INCORPORAÇÃO"
  doc.setFont('times', 'bold');
  doc.setFontSize(10);
  
  // Draw header with thicker bottom border, no fill
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + contentWidth, yPos); // top
  doc.line(margin, yPos, margin, yPos + incorpRowHeight); // left
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + incorpRowHeight); // right
  doc.setLineWidth(0.6);
  doc.line(margin, yPos + incorpRowHeight, margin + contentWidth, yPos + incorpRowHeight); // bottom (thicker)
  doc.setLineWidth(0.3);
  
  // Center "INCORPORAÇÃO" text
  const incorpHeaderText = 'INCORPORAÇÃO';
  const incorpHeaderWidth = doc.getTextWidth(incorpHeaderText);
  doc.text(incorpHeaderText, margin + (contentWidth - incorpHeaderWidth) / 2, yPos + incorpRowHeight / 2 + 1.5);
  yPos += incorpRowHeight;
  
  // Data row - single column with incorporacao text
  doc.setFont('times', 'normal');
  doc.rect(margin, yPos, contentWidth, incorpRowHeight, 'S');
  if (data.incorporacao) {
    doc.text(data.incorporacao, margin + 2, yPos + incorpRowHeight / 2 + 1.5);
  }
  yPos += incorpRowHeight;
  yPos += 2;

  // ==================== LICENÇA ESPECIAL (TABLE) ====================
  // Allow table to split across pages - only check for header row
  checkPageBreak(12); // header row only
  
  const licRowHeight = 6;
  const licCol1Width = contentWidth * 0.25;
  const licCol2Width = contentWidth * 0.25;
  const licCol3Width = contentWidth * 0.50;
  
  // Header row - single column with "LICENÇA ESPECIAL" - bold, centered, thicker bottom border
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  
  // Draw header cell with thicker bottom border
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, licRowHeight, 'S');
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + licRowHeight, margin + contentWidth, yPos + licRowHeight);
  doc.setLineWidth(0.3);
  
  // Center "LICENÇA ESPECIAL" text
  const licHeaderText = 'LICENÇA ESPECIAL';
  const licHeaderWidth = doc.getTextWidth(licHeaderText);
  doc.text(licHeaderText, margin + (contentWidth - licHeaderWidth) / 2, yPos + licRowHeight / 2 + 1.5);
  yPos += licRowHeight;
  
  // Row "1 - Concessão:" with 3 sub-rows in columns 2 and 3
  const subRowHeight = licRowHeight;
  const totalSubRowsHeight = subRowHeight * 3;
  
  // Draw first column spanning 3 rows
  doc.rect(margin, yPos, licCol1Width, totalSubRowsHeight, 'S');
  doc.setFont('times', 'normal');
  doc.text('1 - Concessão:', margin + 2, yPos + totalSubRowsHeight / 2 + 1.5);
  
  // Draw sub-rows for columns 2 and 3 - Concessão
  const decenios = ['1° DECÊNIO', '2° DECÊNIO', '3° DECÊNIO'];
  const decenioKeys = ['primeiroDecenio', 'segundoDecenio', 'terceiroDecenio'] as const;
  
  for (let i = 0; i < 3; i++) {
    const subY = yPos + i * subRowHeight;
    const decenioKey = decenioKeys[i];
    const concessaoData = data.licencaEspecial?.concessao?.[decenioKey];
    
    // Column 2 - decenio label
    doc.rect(margin + licCol1Width, subY, licCol2Width, subRowHeight, 'S');
    doc.text(decenios[i], margin + licCol1Width + 2, subY + subRowHeight / 2 + 1.5);
    
    // Column 3 - data (QTD dias, BCG, Data BCG) or "Nada Consta"
    doc.rect(margin + licCol1Width + licCol2Width, subY, licCol3Width, subRowHeight, 'S');
    if (concessaoData && (concessaoData.qtdDias || concessaoData.bcg || concessaoData.dataBcg)) {
      const qtd = concessaoData.qtdDias || '';
      const bcg = concessaoData.bcg || '';
      const dataBcg = concessaoData.dataBcg ? new Date(concessaoData.dataBcg).toLocaleDateString('pt-BR') : '';
      const concessaoText = `${qtd ? qtd + ' dias' : ''} ${bcg ? '| BCG: ' + bcg : ''} ${dataBcg ? '| ' + dataBcg : ''}`.trim();
      doc.text(concessaoText, margin + licCol1Width + licCol2Width + 2, subY + subRowHeight / 2 + 1.5);
    } else {
      doc.text('Nada Consta', margin + licCol1Width + licCol2Width + 2, subY + subRowHeight / 2 + 1.5);
    }
  }
  yPos += totalSubRowsHeight;
  
  // Row "2 - Fruição:" with 3 sub-rows in columns 2 and 3
  // Draw first column spanning 3 rows
  doc.rect(margin, yPos, licCol1Width, totalSubRowsHeight, 'S');
  doc.text('2 - Fruição:', margin + 2, yPos + totalSubRowsHeight / 2 + 1.5);
  
  // Draw sub-rows for columns 2 and 3 - Fruição
  for (let i = 0; i < 3; i++) {
    const subY = yPos + i * subRowHeight;
    const decenioKey = decenioKeys[i];
    const fruicaoData = data.licencaEspecial?.fruicao?.[decenioKey];
    
    // Column 2 - decenio label
    doc.rect(margin + licCol1Width, subY, licCol2Width, subRowHeight, 'S');
    doc.text(decenios[i], margin + licCol1Width + 2, subY + subRowHeight / 2 + 1.5);
    
    // Column 3 - data (QTD dias, BCG, Data BCG) or "Nada Consta"
    doc.rect(margin + licCol1Width + licCol2Width, subY, licCol3Width, subRowHeight, 'S');
    if (fruicaoData && (fruicaoData.qtdDias || fruicaoData.bcg || fruicaoData.dataBcg)) {
      const qtd = fruicaoData.qtdDias || '';
      const bcg = fruicaoData.bcg || '';
      const dataBcg = fruicaoData.dataBcg ? new Date(fruicaoData.dataBcg).toLocaleDateString('pt-BR') : '';
      const fruicaoText = `${qtd ? qtd + ' dias' : ''} ${bcg ? '| BCG: ' + bcg : ''} ${dataBcg ? '| ' + dataBcg : ''}`.trim();
      doc.text(fruicaoText, margin + licCol1Width + licCol2Width + 2, subY + subRowHeight / 2 + 1.5);
    } else {
      doc.text('Nada Consta', margin + licCol1Width + licCol2Width + 2, subY + subRowHeight / 2 + 1.5);
    }
  }
  yPos += totalSubRowsHeight;
  yPos += 2;

  // ==================== AVERBAÇÃO (TABLE) ====================
  // Allow table to split across pages - only check for header row
  checkPageBreak(8); // header row only
  
  const averbRowHeight = 6;
  
  // Header row - single column with "AVERBAÇÃO" - bold, centered, thicker bottom border
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  
  // Draw header cell with thicker bottom border
  doc.setLineWidth(0.3);
  doc.rect(margin, yPos, contentWidth, averbRowHeight, 'S');
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + averbRowHeight, margin + contentWidth, yPos + averbRowHeight);
  doc.setLineWidth(0.3);
  
  // Center "AVERBAÇÃO" text
  const averbHeaderText = 'AVERBAÇÃO';
  const averbHeaderWidth = doc.getTextWidth(averbHeaderText);
  doc.text(averbHeaderText, margin + (contentWidth - averbHeaderWidth) / 2, yPos + averbRowHeight / 2 + 1.5);
  yPos += averbRowHeight;
  
  // Helper function to convert number to Portuguese words
  const numberToWords = (num: number): string => {
    const units = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
    const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
    const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
    const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
    
    if (num === 0) return 'zero';
    if (num === 100) return 'cem';
    
    let words = '';
    
    if (num >= 1000) {
      const thousands = Math.floor(num / 1000);
      if (thousands === 1) {
        words += 'mil';
      } else {
        words += numberToWords(thousands) + ' mil';
      }
      num %= 1000;
      if (num > 0) words += ' ';
    }
    
    if (num >= 100) {
      words += hundreds[Math.floor(num / 100)];
      num %= 100;
      if (num > 0) words += ' e ';
    }
    
    if (num >= 20) {
      words += tens[Math.floor(num / 10)];
      num %= 10;
      if (num > 0) words += ' e ';
    } else if (num >= 10) {
      words += teens[num - 10];
      num = 0;
    }
    
    if (num > 0) {
      words += units[num];
    }
    
    return words;
  };
  
  // Data row - averbação content
  doc.setFont('times', 'normal');
  
  // Parse averbacao data
  let averbacaoContent = 'Nada Consta';
  if (data.averbacao && Array.isArray(data.averbacao) && data.averbacao.length > 0) {
    const averbEntries = data.averbacao.map((entry: any) => {
      const totalDias = typeof entry.totalDias === 'number' ? entry.totalDias : (parseInt(entry.totalDias, 10) || 0);
      const diasPorExtenso = numberToWords(totalDias);
      const tipo = entry.tipo || '';
      const doe = entry.doe || '';
      const dataPublicacao = entry.dataPublicacao ? new Date(entry.dataPublicacao).toLocaleDateString('pt-BR') : '';
      
      return `${totalDias} - (${diasPorExtenso}) dias de Tempo de Contribuição ao ${tipo}, conforme DOE nº ${doe} de ${dataPublicacao}`;
    });
    averbacaoContent = averbEntries.join('\n');
  }
  
  // Calculate row height based on content
  const averbLines = doc.splitTextToSize(averbacaoContent, contentWidth - 4);
  const averbDataRowHeight = Math.max(averbRowHeight, averbLines.length * 4 + 4);
  
  doc.rect(margin, yPos, contentWidth, averbDataRowHeight, 'S');
  doc.text(averbLines, margin + 2, yPos + 4);
  yPos += averbDataRowHeight;
  yPos += 2;

  // ==================== PAGE 2 - ADDITIONAL INFO ====================
  checkPageBreak(8); // minimal check - allows content to flow naturally
  
  // ==================== LICENÇA PARA TRATAR DE INTERESSE PARTICULAR (TABLE) ====================
  const ltipRowHeight = 6;
  const ltipCol1Width = contentWidth * 0.20;
  const ltipCol2Width = contentWidth * 0.20;
  const ltipCol3Width = contentWidth * 0.60;
  
  // Header row - single column with title - bold, centered, thicker bottom border
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  
  // Draw header cell with thicker bottom border
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + contentWidth, yPos); // top
  doc.line(margin, yPos, margin, yPos + ltipRowHeight); // left
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + ltipRowHeight); // right
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + ltipRowHeight, margin + contentWidth, yPos + ltipRowHeight); // bottom (thicker)
  doc.setLineWidth(0.3);
  
  // Center title text
  const ltipHeaderText = 'LICENÇA PARA TRATAR DE INTERESSE PARTICULAR';
  const ltipHeaderWidth = doc.getTextWidth(ltipHeaderText);
  doc.text(ltipHeaderText, margin + (contentWidth - ltipHeaderWidth) / 2, yPos + ltipRowHeight / 2 + 1.5);
  yPos += ltipRowHeight;
  
  // Data row - 3 columns (20%, 20%, 60%)
  doc.setFont('times', 'normal');
  const ltipSim = data.licencaInteresseParticular?.sim ? 'X' : ' ';
  const ltipNao = data.licencaInteresseParticular?.sim ? ' ' : 'X';
  const ltipPeriodo = data.licencaInteresseParticular?.periodo || '';
  
  // Column 1 - SIM ( )
  doc.rect(margin, yPos, ltipCol1Width, ltipRowHeight, 'S');
  doc.text(`SIM (  ${ltipSim}  )`, margin + 2, yPos + ltipRowHeight / 2 + 1.5);
  
  // Column 2 - NÃO ( )
  doc.rect(margin + ltipCol1Width, yPos, ltipCol2Width, ltipRowHeight, 'S');
  doc.text(`NÃO (  ${ltipNao}  )`, margin + ltipCol1Width + 2, yPos + ltipRowHeight / 2 + 1.5);
  
  // Column 3 - Período
  doc.rect(margin + ltipCol1Width + ltipCol2Width, yPos, ltipCol3Width, ltipRowHeight, 'S');
  doc.text(`PERÍODO: ${ltipPeriodo || '****'}`, margin + ltipCol1Width + ltipCol2Width + 2, yPos + ltipRowHeight / 2 + 1.5);
  yPos += ltipRowHeight;
  yPos += 2;

  // ==================== RESPONDE PROCESSO / IPM / CONSELHO (TABLE) ====================
  const rpRowHeight = 6;
  const rpCol1Width = contentWidth * 0.20;
  const rpCol2Width = contentWidth * 0.20;
  const rpCol3Width = contentWidth * 0.60;
  
  // Header row - single column with title - bold, centered, thicker bottom border
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  
  // Draw header cell with thicker bottom border
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + contentWidth, yPos); // top
  doc.line(margin, yPos, margin, yPos + rpRowHeight); // left
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + rpRowHeight); // right
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + rpRowHeight, margin + contentWidth, yPos + rpRowHeight); // bottom (thicker)
  doc.setLineWidth(0.3);
  
  // Center title text
  const rpHeaderText = 'RESPONDE PROCESSO / IPM / CONSELHO';
  const rpHeaderWidth = doc.getTextWidth(rpHeaderText);
  doc.text(rpHeaderText, margin + (contentWidth - rpHeaderWidth) / 2, yPos + rpRowHeight / 2 + 1.5);
  yPos += rpRowHeight;
  
  // Data row - 3 columns (20%, 20%, 60%)
  doc.setFont('times', 'normal');
  const rpSim = data.respondeProcesso?.sim ? 'X' : ' ';
  const rpNao = data.respondeProcesso?.sim ? ' ' : 'X';
  
  // Column 1 - SIM ( )
  doc.rect(margin, yPos, rpCol1Width, rpRowHeight, 'S');
  doc.text(`SIM (  ${rpSim}  )`, margin + 2, yPos + rpRowHeight / 2 + 1.5);
  
  // Column 2 - NÃO ( )
  doc.rect(margin + rpCol1Width, yPos, rpCol2Width, rpRowHeight, 'S');
  doc.text(`NÃO (  ${rpNao}  )`, margin + rpCol1Width + 2, yPos + rpRowHeight / 2 + 1.5);
  
  // Column 3 - Empty
  doc.rect(margin + rpCol1Width + rpCol2Width, yPos, rpCol3Width, rpRowHeight, 'S');
  yPos += rpRowHeight;
  yPos += 2;

  // ==================== CONDENAÇÃO (TABLE) ====================
  const condRowHeight = 6;
  const condCol1Width = contentWidth * 0.20;
  const condCol2Width = contentWidth * 0.20;
  const condCol3Width = contentWidth * 0.60;
  
  // Header row - single column with title - bold, centered, thicker bottom border
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  
  // Draw header cell with thicker bottom border
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + contentWidth, yPos); // top
  doc.line(margin, yPos, margin, yPos + condRowHeight); // left
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + condRowHeight); // right
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + condRowHeight, margin + contentWidth, yPos + condRowHeight); // bottom (thicker)
  doc.setLineWidth(0.3);
  
  // Center title text
  const condHeaderText = 'CONDENAÇÃO';
  const condHeaderWidth = doc.getTextWidth(condHeaderText);
  doc.text(condHeaderText, margin + (contentWidth - condHeaderWidth) / 2, yPos + condRowHeight / 2 + 1.5);
  yPos += condRowHeight;
  
  // Data row - 3 columns (20%, 20%, 60%)
  doc.setFont('times', 'normal');
  
  // Check if there's any deduction of type "Prisão"
  const hasPrisaoDeducao = data.deducao?.some(d => d.tipo === 'Prisão') || false;
  const cSim = hasPrisaoDeducao ? 'X' : ' ';
  const cNao = hasPrisaoDeducao ? ' ' : 'X';
  
  // Build pena text from Prisão deductions
  let cPena = '';
  if (hasPrisaoDeducao && data.deducao) {
    const prisaoEntries = data.deducao.filter(d => d.tipo === 'Prisão');
    cPena = prisaoEntries.map(p => {
      const dataInicial = p.dataInicial ? new Date(p.dataInicial + 'T00:00:00').toLocaleDateString('pt-BR') : '';
      const dataFinal = p.dataFinal ? new Date(p.dataFinal + 'T00:00:00').toLocaleDateString('pt-BR') : '';
      
      // Calculate days between dates
      let tempoDed = '';
      if (p.dataInicial && p.dataFinal) {
        const inicio = new Date(p.dataInicial + 'T00:00:00');
        const fim = new Date(p.dataFinal + 'T00:00:00');
        const diffTime = fim.getTime() - inicio.getTime();
        const diasTotais = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const anos = Math.floor(diasTotais / 365);
        const restoDias = diasTotais % 365;
        const meses = Math.floor(restoDias / 30);
        const dias = restoDias % 30;
        const partes = [];
        if (anos > 0) partes.push(`${anos} ano${anos > 1 ? 's' : ''}`);
        if (meses > 0) partes.push(`${meses} ${meses > 1 ? 'meses' : 'mês'}`);
        if (dias > 0 || partes.length === 0) partes.push(`${dias} dia${dias !== 1 ? 's' : ''}`);
        tempoDed = partes.join(', ');
      }
      
      const doe = p.doe || '';
      const dataPub = p.dataPublicacao ? new Date(p.dataPublicacao + 'T00:00:00').toLocaleDateString('pt-BR') : '';
      
      return `${dataInicial} - ${dataFinal}, ${tempoDed} conforme DOE nr. ${doe} de ${dataPub}`;
    }).join('; ');
  }
  
  // Column 1 - SIM ( )
  doc.rect(margin, yPos, condCol1Width, condRowHeight, 'S');
  doc.text(`SIM (  ${cSim}  )`, margin + 2, yPos + condRowHeight / 2 + 1.5);
  
  // Column 2 - NÃO ( )
  doc.rect(margin + condCol1Width, yPos, condCol2Width, condRowHeight, 'S');
  doc.text(`NÃO (  ${cNao}  )`, margin + condCol1Width + 2, yPos + condRowHeight / 2 + 1.5);
  
  // Column 3 - PENA
  doc.rect(margin + condCol1Width + condCol2Width, yPos, condCol3Width, condRowHeight, 'S');
  doc.text(`PENA: ${cPena || '****'}`, margin + condCol1Width + condCol2Width + 2, yPos + condRowHeight / 2 + 1.5);
  yPos += condRowHeight;
  yPos += 2;

  // ==================== ENCAMINHAMENTO (TABLE) ====================
  checkPageBreak(8); // header row only - allows table to split across pages
  const encRowHeight = 6;
  
  // Header row - single column with title - bold, centered, thicker bottom border
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  
  // Draw header cell with thicker bottom border
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + contentWidth, yPos); // top
  doc.line(margin, yPos, margin, yPos + encRowHeight); // left
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + encRowHeight); // right
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + encRowHeight, margin + contentWidth, yPos + encRowHeight); // bottom (thicker)
  doc.setLineWidth(0.3);
  
  // Center title text
  const encHeaderText = 'ENCAMINHAMENTO';
  const encHeaderWidth = doc.getTextWidth(encHeaderText);
  doc.text(encHeaderText, margin + (contentWidth - encHeaderWidth) / 2, yPos + encRowHeight / 2 + 1.5);
  yPos += encRowHeight;
  
  // Content row - single column with justified text + date + signature
  doc.setFont('times', 'normal');
  
  const encText1 = '1. Estou ciente da Capitulação prevista no Art. 312 Código Penal Militar: "Art. 312 - Omitir, em documento público ou particular, declaração que dele devia constar, ou nele inserir ou fazer inserir declaração falsa ou diversa da que devia ser escrita, com o fim de prejudicar direito, criar obrigação ou alterar a verdade sobre fato juridicamente relevante, desde que o fato atente contra a administração ou o serviço militar:';
  const encText2 = '2. Pena - reclusão, até cinco anos, se o documento é público; reclusão, até três anos, se o documento é particular."';
  const encText3 = '3. Encaminho ao Senhor Comandante do 5º BPM para a devida tramitação legal.';
  
  const fullEncText = `${encText1}\n${encText2}\n${encText3}`;
  
  // Split text into lines for justified alignment
  const encLines = doc.splitTextToSize(fullEncText, contentWidth - 4);
  
  // Calculate date/location text
  const today = new Date();
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dateStr = `${today.getDate().toString().padStart(2, '0')} de ${months[today.getMonth()]} de ${today.getFullYear()}`;
  
  // Extract city from unidade field (e.g., "5º BPM/CPA-6/Coxim-MS" -> "Coxim-MS")
  const extractCityFromUnidade = (unidade: string | undefined | null): string => {
    if (!unidade) return 'COXIM - MS';
    const parts = unidade.split('/');
    const lastPart = parts[parts.length - 1]?.trim();
    if (lastPart) {
      // Format: convert "Coxim-MS" to "COXIM - MS"
      const cityParts = lastPart.split('-');
      if (cityParts.length === 2) {
        return `${cityParts[0].trim().toUpperCase()} - ${cityParts[1].trim().toUpperCase()}`;
      }
      return lastPart.toUpperCase();
    }
    return 'COXIM - MS';
  };
  
  const cidadeEncaminhamento = extractCityFromUnidade(data.profile.unidade);
  console.log('Cidade de encaminhamento extraída:', cidadeEncaminhamento);
  
  // Calculate total content height: text + spacing + date + spacing + signature
  const encContentHeight = encLines.length * 4 + 4 + 4 + 18 + 4 + 5 + 5;
  
  // Draw content cell borders
  doc.rect(margin, yPos, contentWidth, encContentHeight, 'S');
  
  // Add justified text
  let encTextY = yPos + 3;
  for (let i = 0; i < encLines.length; i++) {
    const line = encLines[i];
    // Justify all lines except the last one of each paragraph
    const isLastLine = i === encLines.length - 1 || encLines[i + 1]?.startsWith('1.') || encLines[i + 1]?.startsWith('2.') || encLines[i + 1]?.startsWith('3.');
    
    if (!isLastLine && line.trim().length > 0) {
      // Justify the line
      const words = line.split(' ').filter((w: string) => w.length > 0);
      if (words.length > 1) {
        const totalWordsWidth = words.reduce((acc: number, word: string) => acc + doc.getTextWidth(word), 0);
        const spaceWidth = (contentWidth - 4 - totalWordsWidth) / (words.length - 1);
        let xPos = margin + 2;
        words.forEach((word: string, idx: number) => {
          doc.text(word, xPos, encTextY);
          xPos += doc.getTextWidth(word) + (idx < words.length - 1 ? spaceWidth : 0);
        });
      } else {
        doc.text(line, margin + 2, encTextY);
      }
    } else {
      doc.text(line, margin + 2, encTextY);
    }
    encTextY += 4;
  }
  
  // Add date/location - right aligned inside the cell
  encTextY += 4;
  doc.text(`Quartel em Coxim - MS, ${dateStr}.`, margin + contentWidth - 2, encTextY, { align: 'right' });
  encTextY += 18;
  
  // Add signature - centered inside the cell
  doc.setDrawColor(0, 0, 0);
  const signLineStart = margin + contentWidth / 2 - 50;
  const signLineEnd = margin + contentWidth / 2 + 50;
  doc.line(signLineStart, encTextY, signLineEnd, encTextY);
  encTextY += 4;
  
  doc.setFont('times', 'bold');
  const signatureName = `${data.profile.full_name} – ${data.profile.rank}`;
  doc.text(signatureName.toUpperCase(), margin + contentWidth / 2, encTextY, { align: 'center' });
  encTextY += lineHeight;
  doc.setFont('times', 'normal');
  doc.text(`Matrícula: ${data.profile.registration}`, margin + contentWidth / 2, encTextY, { align: 'center' });
  
  yPos += encContentHeight;
  yPos += 2;

  // ==================== DESPACHO DO COMANDANTE (TABLE) ====================
  checkPageBreak(8); // header row only - allows table to split across pages
  const despRowHeight = 6;
  
  // Header row - single column with title - bold, centered, thicker bottom border
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  
  // Draw header cell with thicker bottom border
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, margin + contentWidth, yPos); // top
  doc.line(margin, yPos, margin, yPos + despRowHeight); // left
  doc.line(margin + contentWidth, yPos, margin + contentWidth, yPos + despRowHeight); // right
  doc.setLineWidth(0.8);
  doc.line(margin, yPos + despRowHeight, margin + contentWidth, yPos + despRowHeight); // bottom (thicker)
  doc.setLineWidth(0.3);
  
  // Center title text
  const despHeaderText = 'DESPACHO DO COMANDANTE DO 5º BPM/ CPA-6/ PMMS';
  const despHeaderWidth = doc.getTextWidth(despHeaderText);
  doc.text(despHeaderText, margin + (contentWidth - despHeaderWidth) / 2, yPos + despRowHeight / 2 + 1.5);
  yPos += despRowHeight;
  
  // Content row - single column with text + date + signature
  doc.setFont('times', 'normal');
  
  const despText1 = '1. Parecer favorável deste Comandante;';
  const despText2 = '2. Devidamente instruído;';
  
  // For financial requests, use "Diretor de Finanças" instead of "Diretor de Pessoal"
  const financialRequests = ['AJUDA DE CUSTO', 'AJUDA DE CURSO', 'AUXILIO FARDAMENTO'];
  const isFinancialRequest = financialRequests.some(type => 
    data.requestTitle.toUpperCase().includes(type)
  );
  const directorType = isFinancialRequest ? 'Finanças' : 'Pessoal';
  const despText3 = `3. Encaminhe ao Sr. Diretor de ${directorType} da PMMS para providências cabíveis.`;
  
  const fullDespText = `${despText1}\n${despText2}\n${despText3}`;
  const despLines = doc.splitTextToSize(fullDespText, contentWidth - 4);
  
  // Calculate total content height: text + spacing + date + spacing + signature
  const despContentHeight = despLines.length * 4 + 4 + 4 + 20 + 4 + 5 + 5;
  
  // Draw content cell borders
  doc.rect(margin, yPos, contentWidth, despContentHeight, 'S');
  
  // Add text
  let despTextY = yPos + 3;
  for (let i = 0; i < despLines.length; i++) {
    doc.text(despLines[i], margin + 2, despTextY);
    despTextY += 4;
  }
  
  // Add date/location - right aligned inside the cell
  despTextY += 4;
  doc.text(`Quartel em Coxim - MS, ${dateStr}.`, margin + contentWidth - 2, despTextY, { align: 'right' });
  despTextY += 20;
  
  // Add signature - centered inside the cell
  doc.setDrawColor(0, 0, 0);
  const despLineStart = margin + contentWidth / 2 - 50;
  const despLineEnd = margin + contentWidth / 2 + 50;
  doc.line(despLineStart, despTextY, despLineEnd, despTextY);
  despTextY += 4;
  
  // Use comandante data from database if available, otherwise use defaults
  const comandanteNome = data.comandante?.nome_completo || (data.comandante as any)?.nome || 'ADRIANO RODRIGUES DE OLIVEIRA';
  const comandantePatente = data.comandante?.patente || 'TEN CEL QOPM';
  const comandantePosto = (data.comandante as any)?.funcao || data.comandante?.posto || 'Comandante do 5º BPM';
  const comandanteMatricula = data.comandante?.matricula || 'Matrícula 97838021';

  doc.setFont('times', 'bold');
  doc.text(`${comandanteNome} – ${comandantePatente}`, margin + contentWidth / 2, despTextY, { align: 'center' });
  despTextY += lineHeight;
  doc.text(comandantePosto, margin + contentWidth / 2, despTextY, { align: 'center' });
  despTextY += lineHeight - 1;
  doc.text(comandanteMatricula, margin + contentWidth / 2, despTextY, { align: 'center' });
  
  yPos += despContentHeight;

  // ==================== SAVE PDF ====================
  const safeTitle = String(data.requestTitle || 'REQUERIMENTO').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const safeName = String(data.profile?.war_name || data.profile?.full_name || 'militar').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  const fileName = `REQUERIMENTO_${safeName}_${safeTitle}.pdf`;
  doc.save(fileName);
}
