
import { User, UserRole } from '../types';

export const maskCPF = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
};

export const validateCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum = sum + parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF.substring(10, 11))) return false;

  return true;
};

export const allowedCities = [
  'COXIM',
  'SONORA',
  'ALCINÓPOLIS',
  'PEDRO GOMES',
  'SÃO GABRIEL DO OESTE',
  'RIO VERDE'
];

export const RIO_VERDE_VARIATIONS = [
  'RIO VERDE', 'RIO VERDE DE MATO GROSSO', 'RIO VERDE DE MT',
  'Rio Verde', 'Rio Verde de Mato Grosso', 'Rio Verde de MT',
  'rio verde', 'rio verde de mato grosso', 'rio verde de mt'
];

export const checkCity = (addressComponents: any[]) => {
  const cityComponent = addressComponents.find(c => 
    c.types.includes('locality') || 
    c.types.includes('administrative_area_level_2')
  );
  
  if (!cityComponent) return false;
  
  const cityName = cityComponent.long_name.toUpperCase();
  
  // Check if it matches any of the Rio Verde variations
  if (RIO_VERDE_VARIATIONS.some(v => cityName.includes(v.toUpperCase()))) return true;
  
  return allowedCities.some(city => cityName.includes(city));
};

export const getCityFromAddressComponents = (addressComponents: any[]) => {
  const cityComponent = addressComponents.find(c => 
    c.types.includes('locality') || 
    c.types.includes('administrative_area_level_2')
  );
  
  if (!cityComponent) return '';
  
  const cityName = cityComponent.long_name.toUpperCase();
  
  if (RIO_VERDE_VARIATIONS.some(v => cityName.includes(v.toUpperCase()))) return 'RIO VERDE';
  
  const matchedCity = allowedCities.find(city => cityName.includes(city));
  return matchedCity || '';
};

export const extractCityFromAddress = (address: string) => {
  if (!address) return '';
  
  // Normaliza o endereço para tirar acentos e facilitar a busca
  const upperAddress = address.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Mapeamento preciso de termos para cidades (agora sem acentos nas chaves)
  const cityMap: Record<string, string> = {
    'RIO VERDE': 'Rio Verde de MT',
    'RIO VERDE DE MT': 'Rio Verde de MT',
    '79480': 'Rio Verde de MT', 
    '2ª CIA/RIO VERDE': 'Rio Verde de MT',
    'COXIM': 'Coxim',
    'SONORA': 'Sonora',
    'ALCINOPOLIS': 'Alcinópolis',
    'PEDRO GOMES': 'Pedro Gomes',
    'SAO GABRIEL DO OESTE': 'São Gabriel do Oeste'
  };

  for (const [key, value] of Object.entries(cityMap)) {
    if (upperAddress.includes(key)) {
      if (key === '79480') return 'Rio Verde de MT';
      return value;
    }
  }
  
  // Novo fallback: como o LLM retorna RUA X, NUM - BAIRRO - CIDADE
  const dashParts = address.split('-');
  if (dashParts.length > 1) {
    const lastPart = dashParts[dashParts.length - 1].trim();
    if (lastPart.length > 2) {
      return lastPart.charAt(0).toUpperCase() + lastPart.slice(1).toLowerCase();
    }
  }
  
  return '';
};

export const formatAddress = (address: string) => {
  const parts = (address || '')
    .replace(/BRASIL/gi, '')
    .replace(/\d{5}-\d{3}/g, '')
    .split(',')
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  const city = parts.length > 1 ? parts.pop() : '';
  const street = parts.join(', ');
  
  return { street, city };
};

export const checkIsAdmin = (user: User | null) => {
  if (!user) return false;
  return (
    user.role === UserRole.ADMIN || 
    user.role === UserRole.MASTER || 
    user.role === UserRole.SUPERVISOR_DE_OPERACOES ||
    user.unidade === 'FORÇA TÁTICA' ||
    (user.unidades_extras && user.unidades_extras.includes('FORÇA TÁTICA'))
  );
};

/**
 * Deduplicates police officers/users based on clean matricula, clean CPF, or normalized full name.
 * Automatically filters out temporary session records (is_session: true).
 */
export function deduplicateUsers(usersRaw: (User & { is_session?: boolean })[]): User[] {
  if (!Array.isArray(usersRaw)) return [];

  // Filter out explicit session records
  const filtered = usersRaw.filter(u => u && !u.is_session);

  const userMap = new Map<string, User>();

  filtered.forEach(user => {
    const cleanMat = user.matricula ? user.matricula.replace(/\D/g, '') : '';
    const cleanCpf = user.cpf ? user.cpf.replace(/\D/g, '') : '';
    const normName = user.nome ? user.nome.trim().toUpperCase() : '';

    let key = '';
    if (cleanMat && cleanMat !== '000000') {
      key = `mat_${cleanMat}`;
    } else if (cleanCpf) {
      key = `cpf_${cleanCpf}`;
    } else if (normName && normName.length > 2) {
      key = `nome_${normName}`;
    } else {
      key = `id_${user.id}`;
    }

    if (!userMap.has(key)) {
      userMap.set(key, { ...user });
    } else {
      const existing = userMap.get(key)!;
      // Prefer record with lower ord (priority order) or non-99 ord over 99 ord
      const isNewBetter = (user.ord || 0) < (existing.ord || 0) || (existing.ord === 99 && (user.ord || 0) < 99);
      const baseUser = isNewBetter ? user : existing;
      const otherUser = isNewBetter ? existing : user;

      // Merge fields so no details are lost
      userMap.set(key, {
        ...otherUser,
        ...baseUser,
        id: (existing.id && !existing.id.startsWith('anon_')) ? existing.id : user.id,
        nome_completo: baseUser.nome_completo || otherUser.nome_completo,
        telefone: baseUser.telefone || otherUser.telefone,
        cpf: baseUser.cpf || otherUser.cpf,
        email_pm: baseUser.email_pm || otherUser.email_pm,
        rank: baseUser.rank || otherUser.rank,
        unidade: baseUser.unidade || otherUser.unidade,
        filiacao: baseUser.filiacao || otherUser.filiacao,
        data_inclusao: baseUser.data_inclusao || otherUser.data_inclusao
      });
    }
  });

  return Array.from(userMap.values());
}

export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

