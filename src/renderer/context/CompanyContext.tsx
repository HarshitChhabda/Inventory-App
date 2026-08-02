import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Company {
  id: number;
  uuid: string;
  name: string;
  address?: string;
  phone?: string;
  logoPath?: string;
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

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [company, setCompany] = useState<Company | null>(() => {
    const saved = localStorage.getItem('selectedCompany');
    return saved ? JSON.parse(saved) : null;
  });

  const [financialYear, setFinancialYear] = useState<FinancialYear | null>(() => {
    const saved = localStorage.getItem('selectedFinancialYear');
    return saved ? JSON.parse(saved) : null;
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);

  useEffect(() => {
    if (company) {
      localStorage.setItem('selectedCompany', JSON.stringify(company));
    } else {
      localStorage.removeItem('selectedCompany');
    }
  }, [company]);

  useEffect(() => {
    if (financialYear) {
      localStorage.setItem('selectedFinancialYear', JSON.stringify(financialYear));
    } else {
      localStorage.removeItem('selectedFinancialYear');
    }
  }, [financialYear]);

  return (
    <CompanyContext.Provider
      value={{
        company, setCompany,
        financialYear, setFinancialYear,
        companies, setCompanies,
        financialYears, setFinancialYears,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within CompanyProvider');
  return context;
}
