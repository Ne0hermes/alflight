import React, { useState, useMemo } from 'react';
import {
  Box, Paper, Typography, Button, TextField, Select, MenuItem,
  FormControl, InputLabel, Grid, Chip, InputAdornment,
  ToggleButton, ToggleButtonGroup, Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import TechnicalLogEntry from './TechnicalLogEntry';
import { useTechnicalLogStore } from '../../../core/stores/technicalLogStore';

const TechnicalLogList = () => {
  const { entries, addEntry, updateEntry, deleteEntry } = useTechnicalLogStore();
  const [viewMode, setViewMode] = useState('list');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewEntry, setShowNewEntry] = useState(false);

  const statistics = useMemo(() => {
    const stats = {
      total: entries.length,
      open: 0,
      deferred: 0,
      resolved: 0,
      defects: 0,
      maintenance: 0
    };

    entries.forEach(entry => {
      if (entry.resolved) stats.resolved++;
      else if (entry.deferred) stats.deferred++;
      else stats.open++;

      if (entry.type === 'defect') stats.defects++;
      if (entry.type === 'maintenance') stats.maintenance++;
    });

    return stats;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Filter by type
      if (filterType !== 'all' && entry.type !== filterType) return false;

      // Filter by status
      if (filterStatus === 'open' && (entry.resolved || entry.deferred)) return false;
      if (filterStatus === 'deferred' && !entry.deferred) return false;
      if (filterStatus === 'resolved' && !entry.resolved) return false;

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          entry.description?.toLowerCase().includes(searchLower) ||
          entry.action?.toLowerCase().includes(searchLower) ||
          entry.mechanic?.toLowerCase().includes(searchLower) ||
          entry.deferralRef?.toLowerCase().includes(searchLower)
      }

      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [entries, filterType, filterStatus, searchTerm]);

  const handleAddEntry = () => {
    setShowNewEntry(true);
  };

  const handleSaveNewEntry = (entryData) => {
    addEntry(entryData);
    setShowNewEntry(false);
  };

  const handleCancelNewEntry = () => {
    setShowNewEntry(false);
  };

  const StatusCard = ({ title, count, color, icon }) => (
    <Paper sx={{ p: 2, textAlign: 'center' }}>
      <Box display="flex" justifyContent="center" alignItems="center" gap={1} mb={1}>
        {icon}
        <Typography variant="h4" color={color}>
          {count}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </Paper>

  return (
    <Box>
      {/* Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={2.4}>
          <StatusCard
            title="Total des entrées"
            count={statistics.total}
            color="primary"
          />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatusCard
            title="Ouvertes"
            count={statistics.open}
            color="info"
          />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatusCard
            title="Différées"
            count={statistics.deferred}
            color="warning"
            icon={<WarningIcon color="warning" />}
          />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatusCard
            title="Résolues"
            count={statistics.resolved}
            color="success"
            icon={<CheckCircleIcon color="success" />}
          />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatusCard
            title="Défauts"
            count={statistics.defects}
            color="error"
            icon={<ErrorIcon color="error" />}
          />
        </Grid>
      </Grid>

      {/* Filters and Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              placeholder="Rechercher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Type d'entrée</InputLabel>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Type d'entrée"
              >
                <MenuItem value="all">Tous les types</MenuItem>
                <MenuItem value="preflight">Pré-vol</MenuItem>
                <MenuItem value="postflight">Post-vol</MenuItem>
                <MenuItem value="maintenance">Maintenance</MenuItem>
                <MenuItem value="inspection">Inspection</MenuItem>
                <MenuItem value="defect">Défaut</MenuItem>
                <MenuItem value="modification">Modification</MenuItem>
                <MenuItem value="ad">AD/CN</MenuItem>
                <MenuItem value="service">Service Bulletin</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Statut</InputLabel>
              <Select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                label="Statut"
              >
                <MenuItem value="all">Tous les statuts</MenuItem>
                <MenuItem value="open">Ouvert</MenuItem>
                <MenuItem value="deferred">Différé</MenuItem>
                <MenuItem value="resolved">Résolu</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box display="flex" gap={1} justifyContent="flex-end">
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(e, newMode) => newMode && setViewMode(newMode)}
                size="small"
              >
                <ToggleButton value="list">
                  <ViewListIcon />
                </ToggleButton>
                <ToggleButton value="grid">
                  <ViewModuleIcon />
                </ToggleButton>
              </ToggleButtonGroup>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddEntry}
              >
                Nouvelle entrée
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Entries List */}
      <Box>
        {showNewEntry && (
          <TechnicalLogEntry
            isNew={true}
            onSave={handleSaveNewEntry}
            onDelete={handleCancelNewEntry}
          />
        )}
        
        {filteredEntries.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              Aucune entrée trouvée
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {searchTerm || filterType !== 'all' || filterStatus !== 'all' 
                ? 'Essayez de modifier vos filtres'
                : 'Cliquez sur "Nouvelle entrée" pour commencer'}
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {viewMode === 'grid' ? (
              filteredEntries.map(entry => (
                <Grid item xs={12} md={6} key={entry.id}>
                  <TechnicalLogEntry
                    entry={entry}
                    onSave={(data) => updateEntry(entry.id, data)}
                    onDelete={() => deleteEntry(entry.id)}
                  />
                </Grid>
            ) : (
              filteredEntries.map(entry => (
                <Grid item xs={12} key={entry.id}>
                  <TechnicalLogEntry
                    entry={entry}
                    onSave={(data) => updateEntry(entry.id, data)}
                    onDelete={() => deleteEntry(entry.id)}
                  />
                </Grid>
            )}
          </Grid>
        )}
      </Box>
    </Box>
};

export default TechnicalLogList;