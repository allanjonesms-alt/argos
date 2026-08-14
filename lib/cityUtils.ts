export const cleanCityName = (cityRaw?: string, addressRaw?: string): string => {
  const normalize = (text: string) => text.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const textToScan = normalize([cityRaw || "", addressRaw || ""].join(" "));

  if (textToScan.includes("ALCINOPOLIS") || textToScan.includes("ALCINÓPOLIS")) return "ALCINÓPOLIS";
  if (textToScan.includes("RIO VERDE") || textToScan.includes("79480")) return "RIO VERDE DE MT";
  if (textToScan.includes("COXIM")) return "COXIM";
  if (textToScan.includes("PEDRO GOMES")) return "PEDRO GOMES";
  if (textToScan.includes("SONORA")) return "SONORA";
  if (textToScan.includes("SAO GABRIEL DO OESTE")) return "SÃO GABRIEL DO OESTE";
  // Ignora explicitamente FIGUEIRAO, se ele não for para aparecer
  // O filtro do gráfico já cuida disso, mas podemos padronizar aqui.
  if (textToScan.includes("FIGUEIRAO")) return "FIGUEIRÃO"; 

  // Se a cidade já for válida (ex: "SÃO GABRIEL DO OESTE"), retornamos ela
  if (cityRaw && cityRaw.length > 2 && cityRaw !== "N/I") {
    return cityRaw.toUpperCase().trim();
  }

  // Tenta extrair corretamente do addressRaw no padrão "RUA X, 123 - BAIRRO - CIDADE"
  if (addressRaw && addressRaw.trim()) {
    const dashParts = addressRaw.split("-");
    if (dashParts.length > 1) {
       const lastPart = dashParts[dashParts.length - 1].trim().toUpperCase();
       if (lastPart.length > 2) return lastPart;
    }
    const commaParts = addressRaw.split(",");
    if (commaParts.length > 1) {
      return commaParts[commaParts.length - 1]?.trim().toUpperCase() || "NÃO INFORMADA";
    }
  }

  return "NÃO INFORMADA";
};
