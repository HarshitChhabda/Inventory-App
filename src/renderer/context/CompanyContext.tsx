import React, { createContext, useContext, useState, useMemo, useCallback, ReactNode } from 'react';

interface Company {
  id: number;
  uuid: string;
  name: string;
  address?: string;
  phone?: string;
  logoPath?: string;
  isActive?: boolean;
}

interface FinancialYear {
  id: number;
  uuid: string;
  label: string;
  startDate: string;
  endDate: string;
  isClosed: boolean;
}

interface CompanyContextType {
  company: Company | null;
  setCompany: (company: Company | null) => void;
  financialYear: FinancialYear | null;
  setFinancialYear: (fy: FinancialYear | null) => void;
  companies: Company[];
  setCompanies: (companies: Company[]) => void;
  financialYears: FinancialYear[];
  setFinancialYears: (fys: FinancialYear[]) => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

try { localStorage.removeItem('selectedCompany'); localStorage.removeItem('selectedFinancialYear'); } catch {}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompanyState] = useState<Company | null>(null);
  const [financialYear, setFinancialYear] = useState<FinancialYear | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);

  const setCompany = useCallback((c: Company | null) => {
    setCompanyState(c);
    try {
      window.electronAPI?.setCompanyId?.(c?.id || null);
    } catch {}
  }, []);

  const value = useMemo(() => ({
    company, setCompany,
    financialYear, setFinancialYear,
    companies, setCompanies,
    financialYears, setFinancialYears,
  }), [company, financialYear, companies, financialYears, setCompany, setFinancialYear, setCompanies, setFinancialYears]);

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within CompanyProvider');
  return context;
}
