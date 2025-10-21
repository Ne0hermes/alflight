import React, { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, LinearProgress,
  Chip, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Add as AddIcon
} from '@mui/icons-material';
import { useTechnicalLogStore } from '../../../core/stores/technicalLogStore';
import { useAircraftStore } from '../../../core/stores/aircraftStore';

const MaintenanceSchedule = () => {
  const { maintenanceItems, updateMaintenanceItem, addMaintenanceItem } = useTechnicalLogStore();
  const { selectedAircraft } = useAircraftStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newItem, setNewItem] = useState({
    name: '',
    type: 'hours',
    interval: '',
    lastDone: '',
    nextDue: ''
  });

  const currentHours = selectedAircraft?.totalHours || 0;
  const currentCycles = selectedAircraft?.totalCycles || 0;

  const getItemStatus = (item) => {
    let remaining = 0;
    let percentage = 0;

    if (item.type === 'hours') {
      remaining = item.nextDue - currentHours;
      percentage = ((currentHours - item.lastDone) / item.interval) * 100;
    } else if (item.type === 'cycles') {
      remaining = item.nextDue - currentCycles;
      percentage = ((currentCycles - item.lastDone) / item.interval) * 100;
    } else if (item.type === 'calendar') {
      const today = new Date();
      const nextDue = new Date(item.nextDue);
      const lastDone = new Date(item.lastDone);
      remaining = Math.ceil((nextDue - today) / (1000 * 60 * 60 * 24));
      const totalDays = Math.ceil((nextDue - lastDone) / (1000 * 60 * 60 * 24));
      const elapsedDays = Math.ceil((today - lastDone) / (1000 * 60 * 60 * 24));
      percentage = (elapsedDays / totalDays) * 100;
    }

    let status = 'ok';
    let color = 'success';
    
    if (percentage >= 100) {
      status = 'overdue';
      color = 'error';
    } else if (percentage >= 90) {
      status = 'due-soon';
      color = 'warning';
    } else if (percentage >= 75) {
      status = 'approaching';
      color = 'info';
    }

    return { remaining, percentage: Math.min(percentage, 100), status, color };
  };

  const sortedItems = useMemo(() => {
    return [...maintenanceItems].sort((a, b) => {
      const statusA = getItemStatus(a);
      const statusB = getItemStatus(b);
      return statusB.percentage - statusA.percentage;
    });
  }, [maintenanceItems, currentHours, currentCycles]);

  const handleAddItem = () => {
    setNewItem({
      name: '',
      type: 'hours',
      interval: '',
      lastDone: '',
      nextDue: ''
    });
    setSelectedItem(null);
    setDialogOpen(true);
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    setNewItem(item);
    setDialogOpen(true);
  };

  const handleSaveItem = () => {
    if (selectedItem) {
      updateMaintenanceItem(selectedItem.id, newItem);
    } else {
      addMaintenanceItem(newItem);
    }
    setDialogOpen(false);
  };

  const getUnitLabel = (type) => {
    switch (type) {
      case 'hours': return 'heures';
      case 'cycles': return 'cycles';
      case 'calendar': return 'jours';
      default: return '';
    }
  };

  return (
    <Box>
      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <CheckCircleIcon color="success" />
                <Box>
                  <Typography variant="h4">
                    {sortedItems.filter(item => getItemStatus(item).status === 'ok').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    En règle
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <InfoIcon color="info" />
                <Box>
                  <Typography variant="h4">
                    {sortedItems.filter(item => getItemStatus(item).status === 'approaching').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    À surveiller
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <WarningIcon color="warning" />
                <Box>
                  <Typography variant="h4">
                    {sortedItems.filter(item => getItemStatus(item).status === 'due-soon').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Bientôt dus
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <ScheduleIcon color="error" />
                <Box>
                  <Typography variant="h4">
                    {sortedItems.filter(item => getItemStatus(item).status === 'overdue').length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    En retard
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Aircraft Status */}
      {selectedAircraft && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>{selectedAircraft.registration}</strong> - 
            Heures totales: {currentHours}h | 
            Cycles totaux: {currentCycles}
          </Typography>
        </Alert>
      )}

      {/* Maintenance Items Table */}
      <Paper>
        <Box p={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Programme de maintenance</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddItem}
          >
            Ajouter un élément
          </Button>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Élément</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Intervalle</TableCell>
                <TableCell>Dernier fait</TableCell>
                <TableCell>Prochain dû</TableCell>
                <TableCell>Restant</TableCell>
                <TableCell>Progression</TableCell>
                <TableCell>Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedItems.map((item) => {
                const status = getItemStatus(item);
                return (
                  <TableRow 
                    key={item.id}
                    hover
                    onClick={() => handleEditItem(item)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {item.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.type === 'hours' ? 'Heures' : item.type === 'cycles' ? 'Cycles' : 'Calendaire'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {item.interval} {getUnitLabel(item.type)}
                    </TableCell>
                    <TableCell>
                      {item.type === 'calendar' 
                        ? new Date(item.lastDone).toLocaleDateString('fr-FR')
                        : `${item.lastDone} ${getUnitLabel(item.type)}`
                      }
                    </TableCell>
                    <TableCell>
                      {item.type === 'calendar' 
                        ? new Date(item.nextDue).toLocaleDateString('fr-FR')
                        : `${item.nextDue} ${getUnitLabel(item.type)}`
                      }
                    </TableCell>
                    <TableCell>
                      <Typography 
                        variant="body2" 
                        color={status.remaining < 0 ? 'error' : 'text.primary'}
                      >
                        {Math.abs(status.remaining)} {getUnitLabel(item.type)}
                        {status.remaining < 0 && ' en retard'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <LinearProgress
                          variant="determinate"
                          value={status.percentage}
                          color={status.color}
                          sx={{ width: 100, height: 8, borderRadius: 4 }}
                        />
                        <Typography variant="body2">
                          {Math.round(status.percentage)}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          status.status === 'overdue' ? 'En retard' :
                          status.status === 'due-soon' ? 'Bientôt dû' :
                          status.status === 'approaching' ? 'À surveiller' :
                          'OK'
                        }
                        color={status.color}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedItem ? 'Modifier l\'élément' : 'Ajouter un élément'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nom de l'élément"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                select
                label="Type"
                value={newItem.type}
                onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                SelectProps={{ native: true }}
              >
                <option value="hours">Heures de vol</option>
                <option value="cycles">Cycles</option>
                <option value="calendar">Calendaire</option>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Intervalle"
                type="number"
                value={newItem.interval}
                onChange={(e) => setNewItem({ ...newItem, interval: e.target.value })}
                helperText={`En ${getUnitLabel(newItem.type)}`}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Dernière exécution"
                type={newItem.type === 'calendar' ? 'date' : 'number'}
                value={newItem.lastDone}
                onChange={(e) => setNewItem({ ...newItem, lastDone: e.target.value })}
                InputLabelProps={newItem.type === 'calendar' ? { shrink: true } : {}}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Prochaine échéance"
                type={newItem.type === 'calendar' ? 'date' : 'number'}
                value={newItem.nextDue}
                onChange={(e) => setNewItem({ ...newItem, nextDue: e.target.value })}
                InputLabelProps={newItem.type === 'calendar' ? { shrink: true } : {}}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleSaveItem} variant="contained">
            {selectedItem ? 'Modifier' : 'Ajouter'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MaintenanceSchedule;