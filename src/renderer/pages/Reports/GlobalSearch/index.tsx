import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, TextField, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, InputAdornment, Card, CardContent, Grid, LinearProgress
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

declare global { interface Window { electronAPI: any } }

const TYPE_COLORS: Record<string, string> = {
  Item: 'primary', Asset: 'secondary', Store: 'info', Department: 'warning',
  Dharmshala: 'success', Room: 'default', Vendor: 'error', Transaction: 'info',
  'Service Request': 'warning', 'Purchase Order': 'secondary',
};

export default function GlobalSearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await window.electronAPI.globalSearch(1, q, 50);
      setResults(res || []);
    } catch (e) { setResults([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, handleSearch]);

  const handleRoute = (route: string) => {
    navigate(route);
  };

  const grouped = results.reduce((acc: Record<string, any[]>, r: any) => {
    (acc[r.type] = acc[r.type] || []).push(r);
    return acc;
  }, {});

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Global Search</Typography>

      <TextField
        fullWidth
        placeholder="Search items, assets, stores, vendors, transactions, service requests..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
        sx={{ mb: 3 }}
      />

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {results.length > 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Found {results.length} results
        </Typography>
      )}

      {Object.entries(grouped).map(([type, items]: [string, any[]]) => (
        <Box key={type} sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            <Chip label={type} color={TYPE_COLORS[type] as any || 'default'} size="small" sx={{ mr: 1 }} />
            ({items.length})
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Details</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((r: any) => (
                  <TableRow key={`${r.type}-${r.id}`} hover sx={{ cursor: 'pointer' }} onClick={() => handleRoute(r.route)}>
                    <TableCell><strong>{r.code || '-'}</strong></TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.subtitle}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      {query.length >= 2 && results.length === 0 && !loading && (
        <Card><CardContent>
          <Typography color="text.secondary" align="center">No results found for "{query}"</Typography>
        </CardContent></Card>
      )}

      {query.length < 2 && (
        <Card><CardContent>
          <Typography color="text.secondary" align="center">Type at least 2 characters to search</Typography>
        </CardContent></Card>
      )}
    </Box>
  );
}
