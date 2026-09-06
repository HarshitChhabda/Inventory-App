import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box, Typography, Button, TextField, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Autocomplete,
  Grid, Chip, alpha, useTheme, Alert, ToggleButton, ToggleButtonGroup, Tooltip,
} from '@mui/material';
import { Add, Delete, ArrowBack, SwapHoriz, Inventory2, ArrowForward, Store, MeetingRoom } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import PageHeader from '../../components/PageHeader';
import DatePickerField from '../../components/DatePickerField';
import { todayISO } from '../../utils/dateUtils';
import { isIntegerOnlyUnit } from '../../utils/unitUtils';
import { toNumber } from '../../utils/numberUtils';
import { ShiftChallanItem } from './types';
import { useChallanForm } from './hooks/useChallanForm';
import ChallanFormSection from './components/ChallanFormSection';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../../utils/errorUtils';
import { useUnsavedChangesWarning, suppressUnsavedWarning } from '../../hooks/useUnsavedChangesWarning';
import UnsavedChangesDialog from '../../components/UnsavedChangesDialog';
import SuccessScreen from '../../components/SuccessScreen';
import PostConfirmationDialog from '../../components/PostConfirmationDialog';
import ActionBar from './components/ActionBar';

type MovementType = 'ROOM_TO_ROOM' | 'STORE_TO_ROOM' | 'ROOM_TO_STORE';

const INITIAL_ITEM: ShiftChallanItem = {
  itemId: 0,
  quantity: 1,
  rate: 0,
  remarks: '',
};

interface ShiftChallanFormProps {
  forcedShiftType?: 'DS' | 'DP';
}

export default function ShiftChallanForm({ forcedShiftType }: ShiftChallanFormProps) {
  const { company, financialYear } = useCompany();
  const navigate = useNavigate();
  const { id, type } = useParams<{ id?: string; type?: string }>();
  const theme = useTheme();
  const shiftType = forcedShiftType || ((type === 'dp' ? 'DP' : 'DS') as 'DS' | 'DP');
  const isEdit = id && id !== 'new' && Number(id) > 0;
  const isDS = shiftType === 'DS';

  const editRequestIdRef = useRef(0);

  const [date, setDate] = useState(todayISO());
  const [selectedEntityId, setSelectedEntityId] = useState<number | null>(null);
  const [movementType, setMovementType] = useState<MovementType>('ROOM_TO_ROOM');
  const [sourceLocationId, setSourceRoomId] = useState<number | null>(null);
  const [destLocationId, setDestRoomId] = useState<number | null>(null);
  const [shiftedBy, setShiftedBy] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState<{ id: number; status: 'Draft' | 'Posted' } | null>(null);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [editLoaded, setEditLoaded] = useState(false);
  const [editNotFound, setEditNotFound] = useState(false);

  const {
    items, setItems, addItem, updateItem, removeItem,
  } = useChallanForm<ShiftChallanItem>({
    storageKey: `recent${shiftType}Items`,
    initialItem: () => ({ ...INITIAL_ITEM }),
  });

  const entityLabel = isDS ? 'Dharmshala' : 'Department';
  const roomLabel = isDS ? 'Room' : 'Location';

  const { data: entities, isLoading: entitiesLoading } = useQuery({
    queryKey: ['shiftEntities', shiftType, company?.id],
    queryFn: async () => {
      if (isDS) {
        const depts: any[] = await window.electronAPI.dbQuery('department', 'findMany', {
          where: {
            isActive: true,
            departmentType: 'Dharamshala',
            companyId: company?.id || 1,
          },
          orderBy: { name: 'asc' },
        });
        return depts;
      } else {
        const depts: any[] = await window.electronAPI.dbQuery('department', 'findMany', {
          where: {
            isActive: true,
            departmentType: 'Department',
            companyId: company?.id || 1,
          },
          orderBy: { name: 'asc' },
        });
        return depts;
      }
    },
    enabled: !!company?.id,
  });

  const entityOptions = useMemo(() => {
    if (!entities) return [];
    return entities.map((e: any) => ({ id: e.id, label: e.name }));
  }, [entities]);

  const { data: entityStore } = useQuery({
    queryKey: ['entityStore', selectedEntityId, isDS],
    queryFn: async () => {
      if (!selectedEntityId) return null;
      const storeType = isDS ? 'DHARMSHALA_STORE' : 'DEPARTMENT_STORE';
      const stores: any[] = await window.electronAPI.dbQuery('store', 'findMany', {
        where: {
          departmentId: selectedEntityId,
          storeType,
          isActive: true,
        },
        take: 1,
      });
      return stores[0] || null;
    },
    enabled: !!selectedEntityId,
  });

  const { data: roomLocations, isLoading: roomsLoading } = useQuery({
    queryKey: ['shiftRooms', selectedEntityId, entityStore?.id, isDS],
    queryFn: async () => {
      if (!selectedEntityId || !entityStore?.id) return [];
      if (isDS) {
        const locs: any[] = await window.electronAPI.dbQuery('location', 'findMany', {
          where: {
            storeId: entityStore.id,
            locationType: 'Room',
            isActive: true,
          },
          orderBy: { name: 'asc' },
        });
        return locs;
      } else {
        const locs: any[] = await window.electronAPI.dbQuery('location', 'findMany', {
          where: {
            storeId: entityStore.id,
            locationType: { in: ['DepartmentLocation', 'Room'] },
            isActive: true,
          },
          orderBy: { name: 'asc' },
        });
        return locs;
      }
    },
    enabled: !!selectedEntityId && !!entityStore?.id,
  });

  const roomLocationOptions = useMemo(() => {
    if (!roomLocations) return [];
    return roomLocations.map((r: any) => ({
      id: r.id,
      label: r.name,
      code: r.code || '',
    }));
  }, [roomLocations]);

  const sourceRoomLocationOptions = useMemo(() => {
    if (movementType === 'STORE_TO_ROOM') return [];
    return roomLocationOptions;
  }, [roomLocationOptions, movementType]);

  const destRoomLocationOptions = useMemo(() => {
    if (movementType === 'ROOM_TO_STORE') return [];
    return roomLocationOptions.filter((r) => r.id !== sourceLocationId);
  }, [roomLocationOptions, movementType, sourceLocationId]);

  const sourceLocationInstallationQuery = useQuery({
    queryKey: ['roomInstallations', sourceLocationId, entityStore?.id],
    queryFn: async () => {
      if (!sourceLocationId || !entityStore?.id) return [];
      const installations: any[] = await window.electronAPI.dbQuery('assetInstallation', 'findMany', {
        where: {
          roomId: sourceLocationId,
          storeId: entityStore.id,
          status: 'ACTIVE',
        },
        include: {
          item: {
            include: { unit: true },
          },
        },
        orderBy: { id: 'asc' },
      });
      return installations;
    },
    enabled: !!sourceLocationId && !!entityStore?.id && movementType !== 'STORE_TO_ROOM',
  });

  const storeStockQuery = useQuery({
    queryKey: ['storeStockForShift', company?.id, financialYear?.id, entityStore?.id],
    queryFn: async () => {
      if (!company?.id || !financialYear?.id || !entityStore?.id) return [];
      const result = await window.electronAPI.getStoreStock(company.id, financialYear.id, entityStore.id);
      return result || [];
    },
    enabled: !!company?.id && !!financialYear?.id && !!entityStore?.id && movementType === 'STORE_TO_ROOM',
  });

  const { data: itemsData } = useQuery({
    queryKey: ['items'],
    queryFn: () => window.electronAPI.dbQuery('item', 'findMany', {
      where: { isActive: true },
      include: { unit: true },
      orderBy: { itemName: 'asc' },
    }),
  });

  const installationStockMap = useMemo(() => {
    const map: Record<number, number> = {};
    (sourceLocationInstallationQuery.data || []).forEach((inst: any) => {
      const itemId = inst.itemId;
      const qty = toNumber(inst.quantity || 0);
      map[itemId] = (map[itemId] || 0) + qty;
    });
    return map;
  }, [sourceLocationInstallationQuery.data]);

  const storeStockMap = useMemo(() => {
    const map: Record<number, number> = {};
    (storeStockQuery.data || []).forEach((b: any) => {
      map[b.itemId] = toNumber(b.available ?? b.quantity ?? 0);
    });
    return map;
  }, [storeStockQuery.data]);

  const getItemStock = useCallback((itemId: number) => {
    if (movementType === 'STORE_TO_ROOM') {
      return storeStockMap[itemId] || 0;
    }
    return installationStockMap[itemId] || 0;
  }, [movementType, storeStockMap, installationStockMap]);

  const availableItems = useMemo(() => {
    if (!itemsData) return [];
    const stockMap = movementType === 'STORE_TO_ROOM' ? storeStockMap : installationStockMap;
    if (Object.keys(stockMap).length === 0 && movementType !== 'STORE_TO_ROOM') {
      return itemsData.filter((item: any) => {
        const inst = (sourceLocationInstallationQuery.data || []).find((i: any) => i.itemId === item.id);
        return inst && toNumber(inst.quantity) > 0;
      });
    }
    return itemsData.filter((item: any) => {
      const stock = stockMap[item.id];
      return stock !== undefined && stock > 0;
    });
  }, [itemsData, movementType, storeStockMap, installationStockMap, sourceLocationInstallationQuery.data]);

  const itemOptions = useMemo(() => {
    return availableItems.map((item: any) => ({
      ...item,
      label: `${item.itemCode} - ${item.itemName}`,
    }));
  }, [availableItems]);

  const initialDateRef = useRef(todayISO());
  const initialEntityIdRef = useRef<number | null>(null);
  const initialMovementTypeRef = useRef<MovementType>('ROOM_TO_ROOM');
  const initialSourceRoomRef = useRef<number | null>(null);
  const initialDestRoomRef = useRef<number | null>(null);
  const initialShiftedByRef = useRef('');
  const initialApprovedByRef = useRef('');
  const initialRemarksRef = useRef('');
  const initialItemsRef = useRef<ShiftChallanItem[]>([]);

  useEffect(() => {
    if (isEdit && id && !editLoaded) {
      const requestId = ++editRequestIdRef.current;
      window.electronAPI.dbQuery('transactionHeader', 'findUnique', {
        where: { id: Number(id) },
        include: {
          fromStore: true,
          toStore: true,
          details: { include: { item: true } },
        },
      }).then((tc: any) => {
        if (requestId !== editRequestIdRef.current) return;
        if (!tc) {
          setEditNotFound(true);
          return;
        }
        const loadedDate = tc.transactionDate.split('T')[0];
        const loadedShiftedBy = tc.issuedBy || '';
        const loadedApprovedBy = tc.receivedBy || '';
        const loadedRemarks = tc.remarks || '';

        const details = tc.details || [];
        const hasFromLoc = details.some((d: any) => d.fromLocationId);
        const hasToLoc = details.some((d: any) => d.toLocationId);
        let detectedMovementType: MovementType = 'ROOM_TO_ROOM';
        if (hasFromLoc && !hasToLoc) detectedMovementType = 'ROOM_TO_STORE';
        else if (!hasFromLoc && hasToLoc) detectedMovementType = 'STORE_TO_ROOM';

        let loadedEntityId: number | null = null;
        if (tc.fromStore?.departmentId) {
          loadedEntityId = tc.fromStore.departmentId;
        }

        let loadedSourceRoom: number | null = null;
        if (detectedMovementType === 'ROOM_TO_ROOM' && hasFromLoc) {
          const firstDetail = details.find((d: any) => d.fromLocationId);
          loadedSourceRoom = firstDetail?.fromLocationId || null;
        }
        let loadedDestRoom: number | null = null;
        if (detectedMovementType !== 'STORE_TO_ROOM' && hasToLoc) {
          const lastDetail = details.find((d: any) => d.toLocationId);
          loadedDestRoom = lastDetail?.toLocationId || null;
        }

        const loadedItems: ShiftChallanItem[] = details.map((i: any) => ({
          itemId: i.itemId,
          quantity: toNumber(i.quantity),
          rate: toNumber(i.rate),
          fromLocationId: i.fromLocationId || null,
          toLocationId: i.toLocationId || null,
          remarks: i.remarks || '',
        }));

        initialDateRef.current = loadedDate;
        initialEntityIdRef.current = loadedEntityId;
        initialMovementTypeRef.current = detectedMovementType;
        initialSourceRoomRef.current = loadedSourceRoom;
        initialDestRoomRef.current = loadedDestRoom;
        initialShiftedByRef.current = loadedShiftedBy;
        initialApprovedByRef.current = loadedApprovedBy;
        initialRemarksRef.current = loadedRemarks;
        initialItemsRef.current = loadedItems;

        setDate(loadedDate);
        setShiftedBy(loadedShiftedBy);
        setApprovedBy(loadedApprovedBy);
        setRemarks(loadedRemarks);
        setMovementType(detectedMovementType);
        if (loadedEntityId) setSelectedEntityId(loadedEntityId);
        if (loadedSourceRoom) setSourceRoomId(loadedSourceRoom);
        if (loadedDestRoom) setDestRoomId(loadedDestRoom);
        setItems(loadedItems);
        setEditLoaded(true);
      });
    }
  }, [id, isEdit, setItems, editLoaded]);

  useEffect(() => {
    if (editLoaded) return;
    setSourceRoomId(null);
    setDestRoomId(null);
    setItems([]);
  }, [selectedEntityId, movementType, setItems, editLoaded]);

  const handleMovementTypeChange = (_: any, newType: MovementType | null) => {
    if (newType) setMovementType(newType);
  };

  const sameLocationSelected = sourceLocationId !== null && destLocationId !== null && sourceLocationId === destLocationId;

  const hasInsufficientStock = items.some(
    (i) => i.itemId > 0 && i.quantity > getItemStock(i.itemId)
  );

  const canSave = useMemo(() => {
    if (!selectedEntityId || !entityStore?.id || !shiftedBy || items.length === 0) return false;
    if (sameLocationSelected) return false;
    const hasInvalidItem = items.some((i) => !i.itemId || i.itemId <= 0 || i.quantity <= 0);
    if (hasInvalidItem) return false;

    if (movementType === 'ROOM_TO_ROOM') {
      return sourceLocationId !== null && destLocationId !== null;
    } else if (movementType === 'STORE_TO_ROOM') {
      return destLocationId !== null;
    } else {
      return sourceLocationId !== null;
    }
  }, [selectedEntityId, entityStore, shiftedBy, items, sameLocationSelected, movementType, sourceLocationId, destLocationId]);

  const isDirty = useMemo(() => {
    if (!editLoaded && isEdit) return false;
    return (
      date !== initialDateRef.current ||
      selectedEntityId !== initialEntityIdRef.current ||
      movementType !== initialMovementTypeRef.current ||
      sourceLocationId !== initialSourceRoomRef.current ||
      destLocationId !== initialDestRoomRef.current ||
      shiftedBy !== initialShiftedByRef.current ||
      approvedBy !== initialApprovedByRef.current ||
      remarks !== initialRemarksRef.current ||
      JSON.stringify(items) !== JSON.stringify(initialItemsRef.current)
    );
  }, [date, selectedEntityId, movementType, sourceLocationId, destLocationId, shiftedBy, approvedBy, remarks, items, editLoaded, isEdit]);

  const {
    showDialog, setShowDialog, handleConfirmNavigation,
    handleCancelNavigation, handleSaveDraft, hasDraftSupport,
  } = useUnsavedChangesWarning({ isDirty });

  const handleBack = useCallback(() => {
    if (isDirty) {
      setShowDialog(true);
    } else {
      navigate(`/inventory/${shiftType.toLowerCase()}`);
    }
  }, [isDirty, setShowDialog, navigate, shiftType]);

  const handleSave = async (status: 'Draft' | 'Posted') => {
    if (!company?.id || !financialYear?.id || !entityStore?.id) return;

    if (movementType === 'ROOM_TO_ROOM') {
      if (!sourceLocationId || !destLocationId) {
        toast.error('Please select source and destination rooms');
        return;
      }
      if (sourceLocationId === destLocationId) {
        toast.error('Source and destination rooms cannot be the same');
        return;
      }
    } else if (movementType === 'STORE_TO_ROOM') {
      if (!destLocationId) {
        toast.error('Please select a destination room');
        return;
      }
    } else {
      if (!sourceLocationId) {
        toast.error('Please select a source room');
        return;
      }
    }

    for (const item of items) {
      if (item.itemId > 0 && item.quantity > getItemStock(item.itemId)) {
        toast.error('Insufficient installed stock for item');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        date,
        fromStoreId: entityStore.id,
        toStoreId: entityStore.id,
        shiftedBy,
        approvedBy,
        remarks,
        companyId: company.id,
        financialYearId: financialYear.id,
        status,
      };

      const formattedItems = items.map((i) => {
        if (movementType === 'ROOM_TO_ROOM') {
          return {
            itemId: i.itemId,
            quantity: i.quantity,
            rate: i.rate || 0,
            fromLocationId: sourceLocationId,
            toLocationId: destLocationId,
            remarks: i.remarks,
          };
        } else if (movementType === 'STORE_TO_ROOM') {
          return {
            itemId: i.itemId,
            quantity: i.quantity,
            rate: i.rate || 0,
            fromLocationId: null,
            toLocationId: destLocationId,
            remarks: i.remarks,
          };
        } else {
          return {
            itemId: i.itemId,
            quantity: i.quantity,
            rate: i.rate || 0,
            fromLocationId: sourceLocationId,
            toLocationId: null,
            remarks: i.remarks,
          };
        }
      });

      const result = await window.electronAPI.saveShiftChallan(
        payload,
        formattedItems,
        shiftType,
        !!isEdit,
        isEdit ? Number(id) : undefined,
      );

      if (result) {
        const label = isDS ? 'Dharmshala Shift' : 'Department Shift';
        toast.success(status === 'Draft' ? `${label} saved as draft` : `${label} posted successfully`);
        suppressUnsavedWarning();
        setSavedResult({ id: result.id, status });
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Failed to save shift challan'));
    } finally {
      setSaving(false);
    }
  };

  const getMovementLabel = (mt: MovementType) => {
    switch (mt) {
      case 'ROOM_TO_ROOM': return `${roomLabel} \u2192 ${roomLabel}`;
      case 'STORE_TO_ROOM': return `Store \u2192 ${roomLabel}`;
      case 'ROOM_TO_STORE': return `${roomLabel} \u2192 Store`;
    }
  };

  const handleCreateNew = useCallback(() => {
    setSavedResult(null);
    navigate(`/inventory/${shiftType.toLowerCase()}/new`);
  }, [navigate, shiftType]);

  const handleBackToList = useCallback(() => {
    setSavedResult(null);
    navigate(`/inventory/${shiftType.toLowerCase()}`);
  }, [navigate, shiftType]);

  return (
    <Box>
      {savedResult ? (
        <SuccessScreen
          title={savedResult.status === 'Posted' ? 'Shift Posted Successfully' : 'Draft Saved Successfully'}
          subtitle={savedResult.status === 'Posted'
            ? `The ${isDS ? 'Dharmshala' : 'Department'} shift has been posted and stock balances updated.`
            : `Your ${isDS ? 'Dharmshala' : 'Department'} shift has been saved as a draft.`}
          entityCode={shiftType}
          entityName={`${isDS ? 'Dharmshala' : 'Department'} Shift ${savedResult.id ? `#${savedResult.id}` : ''}`}
          onViewDetails={() => navigate(`/inventory/${shiftType.toLowerCase()}/${savedResult.id}`)}
          onCreateNew={handleCreateNew}
          onBackToList={handleBackToList}
        />
      ) : (
        <>
          <PageHeader
        title={isEdit
          ? `Edit ${isDS ? 'Dharmshala Shift' : 'Department Shift'} #${id}`
          : isDS ? 'Dharmshala Shift' : 'Department Shift'}
        subtitle={isDS
          ? 'Transfer installed/issued material between rooms'
          : 'Transfer items between Department Store and Locations'}
        breadcrumbs={[
          { label: isDS ? 'Dharmshala Shift' : 'Department Shift', path: `/inventory/${shiftType.toLowerCase()}` },
          { label: isEdit ? `Edit #${id}` : 'New Shift' },
        ]}
        actions={
          <Tooltip title="Back">
            <IconButton
              onClick={handleBack}
              aria-label="Back"
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
            >
              <ArrowBack fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      />

      <ChallanFormSection icon={SwapHoriz} title={isDS ? 'Dharmshala Shift Details' : 'Department Shift Details'}>
        {editNotFound && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Shift challan not found. It may have been deleted.
          </Alert>
        )}
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <DatePickerField
              label="Shift Date"
              value={date}
              onChange={(val: string) => setDate(val)}
              fullWidth
              size="small"
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: 'primary.main' }}>
            Step 1 &mdash; Select {entityLabel}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                size="small"
                options={entityOptions}
                getOptionLabel={(o: any) => o.label}
                value={entityOptions.find((o: any) => o.id === selectedEntityId) || null}
                onChange={(_, v: any) => setSelectedEntityId(v?.id || null)}
                renderInput={(params) => (
                  <TextField {...params} label={`Select ${entityLabel}`} required />
                )}
                loading={entitiesLoading}
                disabled={!!isEdit}
                sx={{ minWidth: 300 }}
              />
            </Grid>
          </Grid>
        </Box>

        <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: 'primary.main' }}>
            Step 2 &mdash; Select Movement Type
          </Typography>
          <ToggleButtonGroup
            value={movementType}
            exclusive
            onChange={handleMovementTypeChange}
            size="small"
            disabled={!selectedEntityId || !!isEdit}
            aria-label="Movement type"
            sx={{ '& .MuiToggleButton-root': { px: 3, py: 1, textTransform: 'none' } }}
          >
            <ToggleButton value="ROOM_TO_ROOM">
              <MeetingRoom sx={{ mr: 1, fontSize: 18 }} />
              {roomLabel} &rarr; {roomLabel}
            </ToggleButton>
            <ToggleButton value="STORE_TO_ROOM">
              <Store sx={{ mr: 1, fontSize: 18 }} />
              Store &rarr; {roomLabel}
            </ToggleButton>
            <ToggleButton value="ROOM_TO_STORE">
              <MeetingRoom sx={{ mr: 1, fontSize: 18 }} />
              {roomLabel} &rarr; Store
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700, color: 'primary.main' }}>
            Step 3 &mdash; Select Source &amp; Destination
          </Typography>
          <Grid container spacing={2}>
            {movementType !== 'STORE_TO_ROOM' && (
              <Grid item xs={12} md={4}>
                <Autocomplete
                  size="small"
                  options={sourceRoomLocationOptions}
                  getOptionLabel={(o: any) => o.label}
                  value={sourceRoomLocationOptions.find((o: any) => o.id === sourceLocationId) || null}
                  onChange={(_, v: any) => setSourceRoomId(v?.id || null)}
                  renderInput={(params) => (
                    <TextField {...params} label={`Source ${roomLabel}`} required />
                  )}
                  disabled={!selectedEntityId || roomsLoading}
                  sx={{ minWidth: 220 }}
                />
              </Grid>
            )}
            {movementType === 'ROOM_TO_ROOM' && (
              <Grid item xs={12} md={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowForward sx={{ color: 'primary.main', fontSize: 28 }} />
              </Grid>
            )}
            {movementType !== 'ROOM_TO_STORE' && (
              <Grid item xs={12} md={4}>
                <Autocomplete
                  size="small"
                  options={destRoomLocationOptions}
                  getOptionLabel={(o: any) => o.label}
                  value={destRoomLocationOptions.find((o: any) => o.id === destLocationId) || null}
                  onChange={(_, v: any) => setDestRoomId(v?.id || null)}
                  renderInput={(params) => (
                    <TextField {...params} label={`Destination ${roomLabel}`} required />
                  )}
                  disabled={!selectedEntityId || roomsLoading}
                  sx={{ minWidth: 220 }}
                />
              </Grid>
            )}
          </Grid>
          {sameLocationSelected && (
            <Alert severity="error" sx={{ mt: 1 }}>
              Source and destination {roomLabel.toLowerCase()} cannot be the same.
            </Alert>
          )}
        </Box>

        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12} md={3}>
            <TextField
              size="small"
              label="Shifted By"
              value={shiftedBy}
              onChange={(e) => setShiftedBy(e.target.value)}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              size="small"
              label="Approved By"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              size="small"
              label="Remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              fullWidth
            />
          </Grid>
        </Grid>
      </ChallanFormSection>

      <ChallanFormSection icon={Inventory2} title="Items" count={items.length}>
        {sourceLocationInstallationQuery.isLoading && sourceLocationId && movementType !== 'STORE_TO_ROOM' && (
          <Alert severity="info" sx={{ mb: 1 }}>Loading installed items...</Alert>
        )}
        {storeStockQuery.isLoading && movementType === 'STORE_TO_ROOM' && (
          <Alert severity="info" sx={{ mb: 1 }}>Loading store stock...</Alert>
        )}

        <TableContainer>
          <Table size="small" aria-label="Items to shift">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Available</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Qty to Shift</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No items added yet. Click &quot;Add Item&quot; to begin.
                  </TableCell>
                </TableRow>
              )}
              {items.map((item: ShiftChallanItem, idx: number) => {
                const selectedItem = itemsData?.find((i: any) => i.id === item.itemId);
                const isInteger = isIntegerOnlyUnit(selectedItem?.unit?.name);
                const stock = getItemStock(item.itemId);
                const isInsufficient = item.itemId > 0 && item.quantity > stock;

                return (
                  <TableRow
                    key={idx}
                    sx={{
                      '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.04) },
                      ...(isInsufficient && {
                        backgroundColor: alpha(theme.palette.error.main, 0.08),
                        '&:hover': { backgroundColor: alpha(theme.palette.error.main, 0.12) },
                      }),
                    }}
                  >
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell sx={{ minWidth: 250 }}>
                      <Autocomplete
                        size="small"
                        options={itemOptions}
                        getOptionLabel={(o: any) => o.label}
                        value={itemOptions.find((o: any) => o.id === item.itemId) || null}
                        onChange={(_, v: any) => {
                          updateItem(idx, 'itemId', v?.id || 0);
                        }}
                        renderInput={(params) => (
                          <TextField {...params} placeholder="Search items..." />
                        )}
                        disabled={!selectedEntityId}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={stock}
                        size="small"
                        color={isInsufficient ? 'error' : 'success'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = isInteger
                            ? Math.round(Number(e.target.value))
                            : Number(e.target.value);
                          updateItem(idx, 'quantity', val);
                        }}
                        inputProps={{
                          min: 0,
                          max: stock,
                          step: isInteger ? 1 : 0.01,
                        }}
                        sx={{ width: 80 }}
                        error={isInsufficient}
                        helperText={isInsufficient ? 'Insufficient' : ''}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={item.remarks}
                        onChange={(e) => updateItem(idx, 'remarks', e.target.value)}
                        sx={{ minWidth: 120 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Remove item">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => removeItem(idx)}
                          aria-label="Remove item"
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 1.5 }}>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => addItem()}
            disabled={!selectedEntityId}
          >
            Add Item
          </Button>
        </Box>
      </ChallanFormSection>

      <ActionBar
        onCancel={handleBack}
        onSaveDraft={() => handleSave('Draft')}
        onPost={() => setShowPostConfirm(true)}
        canSave={canSave && !hasInsufficientStock}
        saving={saving}
        postLabel={isDS ? 'Create Dharmshala Shift' : 'Create Department Shift'}
      />

      <PostConfirmationDialog
        open={showPostConfirm}
        title={`Post ${isDS ? 'Dharmshala' : 'Department'} Shift`}
        summary={[
          { label: 'Shift Type', value: isDS ? 'Dharmshala Shift' : 'Department Shift' },
          { label: 'Date', value: date },
          { label: 'Items', value: `${items.length} item(s)` },
          { label: 'Shifted By', value: shiftedBy || '—' },
          { label: 'Movement', value: getMovementLabel(movementType) || '—' },
        ]}
        onConfirm={() => {
          setShowPostConfirm(false);
          handleSave('Posted');
        }}
        onCancel={() => setShowPostConfirm(false)}
        loading={saving}
      />

      <UnsavedChangesDialog
        open={showDialog}
        onConfirm={handleConfirmNavigation}
        onCancel={handleCancelNavigation}
        onSaveDraft={handleSaveDraft}
        hasDraftSupport={hasDraftSupport}
      />
        </>
      )}
    </Box>
  );
}
