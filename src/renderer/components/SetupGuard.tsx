import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert, Stack, Chip,
} from '@mui/material';
import { Business, EventRepeat, Add, Warning } from '@mui/icons-material';
import { useCompany } from '../context/CompanyContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface SetupGuardProps {
  children: React.ReactNode;
}

export default function SetupGuard({ children }: SetupGuardProps) {
  const { company, financialYear, setCompany, setFinancialYear } = useCompany();
  const queryClient = useQueryClient();
  const [showSetup, setShowSetup] = useState(false);
  const [setupStep, setSetupStep] = useState<'company' | 'fy' | 'complete'>('company');
  const [showCompanyConfirm, setShowCompanyConfirm] = useState(false);
  const [showFyConfirm, setShowFyConfirm] = useState(false);
  const [pendingCompany, setPendingCompany] = useState<any>(null);
  const [pendingFy, setPendingFy] = useState<any>(null);

  // New company form
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');

  // New FY form
  const [newFyLabel, setNewFyLabel] = useState('');
  const [newFyStartDate, setNewFyStartDate] = useState('');
  const [newFyEndDate, setNewFyEndDate] = useState('');

  const { data: companies, isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies', 'active'],
    queryFn: () => window.electronAPI.dbQuery('company', 'findMany', { where: { isActive: true }, orderBy: { name: 'asc' } }),
  });

  const { data: financialYears, isLoading: loadingFy } = useQuery({
    queryKey: ['financialYears', company?.id],
    queryFn: () => window.electronAPI.dbQuery('financialYear', 'findMany', { where: { companyId: company?.id }, orderBy: { startDate: 'desc' } }),
    enabled: !!company?.id,
  });

  // Check setup on mount
  useEffect(() => {
    if (loadingCompanies) return;
    
    if (!companies || companies.length === 0) {
      setShowSetup(true);
      setSetupStep('company');
    } else if (company && financialYears && financialYears.length === 0) {
      setShowSetup(true);
      setSetupStep('fy');
    } else {
      setShowSetup(false);
    }
  }, [companies, company, financialYears, loadingCompanies, loadingFy]);

  // Auto-select first company if none selected
  useEffect(() => {
    if (!company && companies && companies.length > 0) {
      setCompany(companies[0]);
    }
  }, [company, companies, setCompany]);

  // Auto-select latest FY if none selected
  useEffect(() => {
    if (company && financialYears && financialYears.length > 0 && !financialYear) {
      setFinancialYear(financialYears[0]);
    }
  }, [company, financialYears, financialYear, setFinancialYear]);

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (data: { name: string; address?: string; phone?: string }) => {
      return window.electronAPI.createCompany(data);
    },
    onSuccess: (newCompany) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      setCompany(newCompany);
      setNewCompanyName('');
      setNewCompanyAddress('');
      setNewCompanyPhone('');
      toast.success('Company created successfully');
      setSetupStep('fy');
    },
    onError: (err: any) => {
      toast.error('Failed to create company: ' + err.message);
    },
  });

  // Create FY mutation
  const createFyMutation = useMutation({
    mutationFn: async (data: { label: string; startDate: string; endDate: string; companyId: number }) => {
      return window.electronAPI.createFinancialYear({
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      });
    },
    onSuccess: (newFy) => {
      queryClient.invalidateQueries({ queryKey: ['financialYears'] });
      setFinancialYear(newFy);
      setNewFyLabel('');
      setNewFyStartDate('');
      setNewFyEndDate('');
      toast.success('Financial year created successfully');
      setSetupStep('complete');
      setShowSetup(false);
    },
    onError: (err: any) => {
      toast.error('Failed to create financial year: ' + err.message);
    },
  });

  const handleCompanyChange = (newCompanyId: number) => {
    const c = companies?.find((comp: any) => comp.id === newCompanyId);
    if (c && c.id !== company?.id) {
      setPendingCompany(c);
      setShowCompanyConfirm(true);
    }
  };

  const confirmCompanyChange = () => {
    if (pendingCompany) {
      setCompany(pendingCompany);
      setFinancialYear(null); // Reset FY when company changes
      toast.success(`Switched to ${pendingCompany.name}`);
    }
    setShowCompanyConfirm(false);
    setPendingCompany(null);
  };

  const handleFyChange = (newFyId: number) => {
    const fy = financialYears?.find((f: any) => f.id === newFyId);
    if (fy && fy.id !== financialYear?.id) {
      setPendingFy(fy);
      setShowFyConfirm(true);
    }
  };

  const confirmFyChange = () => {
    if (pendingFy) {
      setFinancialYear(pendingFy);
      toast.success(`Switched to ${pendingFy.label}`);
    }
    setShowFyConfirm(false);
    setPendingFy(null);
  };

  // Setup wizard dialog
  const renderSetupDialog = () => {
    if (!showSetup) return null;

    return (
      <Dialog open={showSetup} maxWidth="sm" fullWidth disableEscapeKeyDown>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Warning color="warning" />
            <Typography variant="h6">Initial Setup Required</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {setupStep === 'company' && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                No company found. Please create a company to get started.
              </Alert>
              <Stack spacing={2}>
                <TextField
                  label="Company Name"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="Address (Optional)"
                  value={newCompanyAddress}
                  onChange={(e) => setNewCompanyAddress(e.target.value)}
                  fullWidth
                />
                <TextField
                  label="Phone (Optional)"
                  value={newCompanyPhone}
                  onChange={(e) => setNewCompanyPhone(e.target.value)}
                  fullWidth
                />
              </Stack>
            </Box>
          )}

          {setupStep === 'fy' && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                Company created! Now create a financial year.
              </Alert>
              <Stack spacing={2}>
                <TextField
                  label="Financial Year Label (e.g., 2024-25)"
                  value={newFyLabel}
                  onChange={(e) => setNewFyLabel(e.target.value)}
                  fullWidth
                  required
                />
                <TextField
                  label="Start Date"
                  type="date"
                  value={newFyStartDate}
                  onChange={(e) => setNewFyStartDate(e.target.value)}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End Date"
                  type="date"
                  value={newFyEndDate}
                  onChange={(e) => setNewFyEndDate(e.target.value)}
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            </Box>
          )}

          {setupStep === 'complete' && (
            <Alert severity="success">
              Setup complete! You can now use the application.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          {setupStep === 'company' && (
            <Button
              variant="contained"
              onClick={() => createCompanyMutation.mutate({ name: newCompanyName, address: newCompanyAddress, phone: newCompanyPhone })}
              disabled={!newCompanyName.trim() || createCompanyMutation.isPending}
              startIcon={createCompanyMutation.isPending ? <CircularProgress size={16} /> : <Add />}
            >
              Create Company
            </Button>
          )}
          {setupStep === 'fy' && (
            <Button
              variant="contained"
              onClick={() => createFyMutation.mutate({ label: newFyLabel, startDate: newFyStartDate, endDate: newFyEndDate, companyId: company!.id })}
              disabled={!newFyLabel.trim() || !newFyStartDate || !newFyEndDate || createFyMutation.isPending}
              startIcon={createFyMutation.isPending ? <CircularProgress size={16} /> : <Add />}
            >
              Create Financial Year
            </Button>
          )}
        </DialogActions>
      </Dialog>
    );
  };

  // Company change confirmation
  const renderCompanyConfirmDialog = () => (
    <Dialog open={showCompanyConfirm} onClose={() => setShowCompanyConfirm(false)}>
      <DialogTitle>Change Company?</DialogTitle>
      <DialogContent>
        <Typography>
          Switch to <strong>{pendingCompany?.name}</strong>? This will reset the financial year selection.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setShowCompanyConfirm(false); setPendingCompany(null); }}>Cancel</Button>
        <Button variant="contained" onClick={confirmCompanyChange}>Yes, Switch</Button>
      </DialogActions>
    </Dialog>
  );

  // FY change confirmation
  const renderFyConfirmDialog = () => (
    <Dialog open={showFyConfirm} onClose={() => setShowFyConfirm(false)}>
      <DialogTitle>Change Financial Year?</DialogTitle>
      <DialogContent>
        <Typography>
          Switch to <strong>{pendingFy?.label}</strong>?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setShowFyConfirm(false); setPendingFy(null); }}>Cancel</Button>
        <Button variant="contained" onClick={confirmFyChange}>Yes, Switch</Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      {children}
      {renderSetupDialog()}
      {renderCompanyConfirmDialog()}
      {renderFyConfirmDialog()}
    </>
  );
}
