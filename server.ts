import express from "express";
import cors from "cors";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  // API Route for processing PDF with Gemini
  app.post("/api/parse-shift-pdf", async (req, res) => {
    try {
      const { base64Pdf } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "Chave de API do Gemini não configurada no servidor (.env)." });
      }

      if (!base64Pdf) {
        return res.status(400).json({ error: "Nenhum PDF fornecido abortando." });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Você é um assistente militar especialista em organizar escalas. O documento anexado é uma escala de serviço policial em PDF.
A primeira linha do documento geralmente contém a UNIDADE. Note que o 5° BPM se subdivide em diversas frentes de serviço.
Localize as guarnições sob os títulos/frentes de serviço específicos:
- RADIO PATRULHA I
- RADIO PATRULHA II
- FORÇA TÁTICA
- POLICIAMENTO DE TRÂNSITO (Use a unidade "5° BPM - GTRAN" para este caso)

Para cada uma dessas frentes que encontrar, identifique:
- O Comandante (geralmente na linha imediatamente abaixo do título da frente de serviço)
- O Motorista (na próxima linha)
- Os Patrulheiros 1 e 2 (se houverem, nas próximas linhas)

Se os assentos não estiverem explícitos, deduza pela ordem comum descrita.
Retorne OBRIGATÓRIA E ESTRITAMENTE um array JSON puro com os serviços extraídos, com esta exata estrutura:
[
  {
    "unidade": "Identificação da frente (ex: 5° BPM - RADIO PATRULHA I, 5° BPM - GTRAN, FORÇA TÁTICA)",
    "comandante": "NOME GUERRA OU COMPLETO",
    "motorista": "NOME GUERRA OU COMPLETO",
    "patrulheiro_1": "NOME",
    "patrulheiro_2": "NOME"
  }
]
Se patrulheiros não existirem, deixe vazio. Não use crases (\`\`\`) nem inclua explicações, apenas retorne o JSON puro.`;

      let response;
      let attempt = 0;
      const maxAttempts = 3;

      while (attempt < maxAttempts) {
        attempt++;
        const modelName = 'gemini-2.5-flash';
        try {
          console.log(`[Gemini API] Chamando modelo ${modelName} (tentativa ${attempt}/${maxAttempts})...`);
          response = await ai.models.generateContent({
            model: modelName,
            contents: [
              { inlineData: { data: base64Pdf, mimeType: "application/pdf" } },
              { text: prompt }
            ],
            config: {
              responseMimeType: "application/json",
              temperature: 0.2
            }
          });
          break; // successfully generated content, break retry loop!
        } catch (err: any) {
          console.error(`Tentativa ${attempt} do proxy Gemini falhou com erro:`, err.message || err);
          if (attempt === maxAttempts) {
            if (err?.message && (err.message.includes("429") || err.message.includes("Quota") || err.message.includes("Rate") || err.message.includes("exceeded"))) {
              throw new Error("Limite de requisições excedido. Por favor, aguarde alguns segundos e tente novamente.");
            }
            throw err; // throw error if all attempts fail
          }
          // Backoff before retrying
          const delay = attempt * 2000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      if (!response) {
        throw new Error("Não foi possível obter resposta do serviço de inteligência artificial após múltiplas tentativas.");
      }

      const textResponse = response.text || '[]';
      const parsedData = JSON.parse(textResponse);
      res.json({ data: parsedData });

    } catch (error: any) {
      console.error("Erro no proxy do Gemini:", error.message);
      res.status(500).json({ error: error.message || "Erro desconhecido ao processar o PDF." });
    }
  });



  // In-memory store for uploaded files to serve them publicly
  const uploadedFiles = new Map<string, { filename: string; buffer: Buffer; mimeType: string }>();

  // API Route to upload a PDF file
  app.post("/api/upload-pdf", (req, res) => {
    try {
      const { filename, base64Data } = req.body;
      if (!filename || !base64Data) {
        return res.status(400).json({ error: "Nome do arquivo e dados em base64 são obrigatórios." });
      }

      const fileId = "pdf_" + Math.random().toString(36).substring(2, 15);
      const buffer = Buffer.from(base64Data, "base64");
      
      uploadedFiles.set(fileId, {
        filename: filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
        buffer,
        mimeType: "application/pdf"
      });

      res.json({ 
        id: fileId,
        url: `/api/uploads/${fileId}`
      });
    } catch (error: any) {
      console.error("Erro ao fazer upload do PDF:", error);
      res.status(500).json({ error: "Erro interno ao salvar o PDF." });
    }
  });

  // API Route to append values to Google Sheets
  app.post("/api/sheets/append", async (req, res) => {
    try {
      const { accessToken, spreadsheetId, range, values } = req.body;
      
      if (!accessToken || !spreadsheetId || !values) {
        return res.status(400).json({ error: "accessToken, spreadsheetId e values são obrigatórios." });
      }

      const targetRange = range || "Página1!A1";
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetRange)}:append?valueInputOption=USER_ENTERED`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro no Google Sheets API:", errorText);
        return res.status(response.status).json({ error: "Erro no Google Sheets: " + errorText });
      }

      const data = await response.json();
      res.json({ success: true, result: data });
    } catch (error: any) {
      console.error("Erro na rota /api/sheets/append:", error);
      res.status(500).json({ error: error.message || "Erro ao conectar ao Google Sheets." });
    }
  });

  // API Route to update a specific cell/range in Google Sheets
  app.put("/api/sheets/update-cell", async (req, res) => {
    try {
      const { accessToken, spreadsheetId, range, value } = req.body;

      if (!accessToken || !spreadsheetId || !range) {
        return res.status(400).json({ error: "accessToken, spreadsheetId e range são obrigatórios." });
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

      const response = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: [[value ?? 0]] })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro no Google Sheets API (update-cell):", errorText);
        return res.status(response.status).json({ error: "Erro no Google Sheets: " + errorText });
      }

      const data = await response.json();
      res.json({ success: true, result: data });
    } catch (error: any) {
      console.error("Erro na rota /api/sheets/update-cell:", error);
      res.status(500).json({ error: error.message || "Erro ao atualizar célula no Google Sheets." });
    }
  });

  // API Route to batch update multiple ranges in Google Sheets
  app.post("/api/sheets/batch-update", async (req, res) => {
    try {
      const { accessToken, spreadsheetId, data } = req.body;

      if (!accessToken || !spreadsheetId || !Array.isArray(data)) {
        return res.status(400).json({ error: "accessToken, spreadsheetId e data (array) são obrigatórios." });
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: data.map((item: { range: string; value: any }) => ({
            range: item.range,
            values: [[item.value ?? 0]]
          }))
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro no Google Sheets API (batch-update):", errorText);
        return res.status(response.status).json({ error: "Erro no Google Sheets: " + errorText });
      }

      const resData = await response.json();
      res.json({ success: true, result: resData });
    } catch (error: any) {
      console.error("Erro na rota /api/sheets/batch-update:", error);
      res.status(500).json({ error: error.message || "Erro no batch update do Google Sheets." });
    }
  });

  // API Route to download/view the uploaded PDF
  app.get("/api/uploads/:id", (req, res) => {
    const fileId = req.params.id;
    const file = uploadedFiles.get(fileId);
    if (!file) {
      return res.status(404).send("Arquivo não encontrado.");
    }

    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.filename)}"`);
    res.send(file.buffer);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support Express v5 syntax internally for splat route
    // The current version installed is ^5.2.1
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
