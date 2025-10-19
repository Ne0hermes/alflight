import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button,
  Grid, Select, MenuItem, FormControl, InputLabel,
  Divider, Chip, IconButton, Collapse
} from '@mui/material';
import {
  Save as SaveIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';

const TechnicalLogEntry = ({ entry, onSave, onDelete, isNew = false }) => {
  const [isEditing, setIsEditing] = useState(isNew);
  const [expanded, setExpanded] = useState(isNew);
  const [formData, setFormData] = useState({
    date: entry?.date || new Date(),
    flightHours: entry?.flightHours || '',
    cycles: entry?.cycles || '',
    type: entry?.type || 'preflight',
    description: entry?.description || '',
    action: entry?.action || '',
    mechanic: entry?.mechanic || '',
    deferred: entry?.deferred || false,
    deferralRef: entry?.deferralRef || '',
    resolved: entry?.resolved || false,
    resolutionDate: entry?.resolutionDate || null,
    ...entry
  });

  const entryTypes = [
    { value: 'preflight', label: 'Pré-vol' },
    { value: 'postflight', label: 'Post-vol' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'inspection', label: 'Inspection' },
    { value: 'defect', label: 'Défaut' },
    { value: 'modification', label: 'Modification' },
    { value: 'ad', label: 'AD/CN' },
    { value: 'service', label: 'Service Bulletin' }
  ];

  const handleChange = (field) => (event) => {
    const value = event?.target ? event.target.value : event;
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (isNew) {
      onDelete();
    } else {
      setFormData(entry);
      setIsEditing(false);
    }
  };

  const getSeverityColor = () => {
    if (formData.deferred && !formData.resolved) return 'warning';
    if (formData.type === 'defect' && !formData.resolved) return 'error';
    if (formData.resolved) return 'success';
    return 'default';
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <Typography variant="h6">
              {formData.date ? new Date(formData.date).toLocaleDateString('fr-FR') : 'Nouvelle entrée'}
            </Typography>
            <Chip 
              label={entryTypes.find(t => t.value === formData.type)?.label || formData.type}
              size="small"
              color={getSeverityColor()}
              icon={formData.deferred && !formData.resolved ? <WarningIcon /> : null}
            />
            {formData.flightHours && (
              <Typography variant="body2" color="text.secondary">
                {formData.flightHours} heures
              </Typography>
            )}
          </Box>
          <Box>
            {!isEditing && (
              <>
                <IconButton onClick={() => setExpanded(!expanded)} size="small">
                  {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <IconButton onClick={() => setIsEditing(true)} size="small">
                  <EditIcon />
                </IconButton>
                <IconButton onClick={onDelete} size="small" color="error">
                  <DeleteIcon />
                </IconButton>
              </>
            )}
          </Box>
        </Box>

        <Collapse in={expanded || isEditing}>
          {isEditing ? (
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <DateTimePicker
                    label="Date et heure"
                    value={formData.date}
                    onChange={handleChange('date')}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                    ampm={false}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Type d'entrée</InputLabel>
                    <Select
                      value={formData.type}
                      onChange={handleChange('type')}
                      label="Type d'entrée"
                    >
                      {entryTypes.map(type => (
                        <MenuItem key={type.value} value={type.value}>
                          {type.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Heures de vol"
                    type="number"
                    value={formData.flightHours}
                    onChange={handleChange('flightHours')}
                    inputProps={{ step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Cycles"
                    type="number"
                    value={formData.cycles}
                    onChange={handleChange('cycles')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Description"
                    value={formData.description}
                    onChange={handleChange('description')}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    label="Action effectuée"
                    value={formData.action}
                    onChange={handleChange('action')}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Mécanicien / Pilote"
                    value={formData.mechanic}
                    onChange={handleChange('mechanic')}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Statut</InputLabel>
                    <Select
                      value={formData.deferred ? 'deferred' : formData.resolved ? 'resolved' : 'open'}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          deferred: value === 'deferred',
                          resolved: value === 'resolved'
                        }));
                      }}
                      label="Statut"
                    >
                      <MenuItem value="open">Ouvert</MenuItem>
                      <MenuItem value="deferred">Différé</MenuItem>
                      <MenuItem value="resolved">Résolu</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {formData.deferred && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Référence MEL/CDL"
                      value={formData.deferralRef}
                      onChange={handleChange('deferralRef')}
                    />
                  </Grid>
                )}
                {formData.resolved && (
                  <Grid item xs={12} md={6}>
                    <DateTimePicker
                      label="Date de résolution"
                      value={formData.resolutionDate}
                      onChange={handleChange('resolutionDate')}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                      ampm={false}
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  <Box display="flex" gap={2} justifyContent="flex-end">
                    <Button onClick={handleCancel}>
                      Annuler
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSave}
                    >
                      Enregistrer
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </LocalizationProvider>
          ) : (
            <Box>
              <Typography variant="body1" paragraph>
                <strong>Description:</strong> {formData.description || 'N/A'}
              </Typography>
              {formData.action && (
                <Typography variant="body1" paragraph>
                  <strong>Action:</strong> {formData.action}
                </Typography>
              )}
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <Typography variant="body2" color="text.secondary">
                    Mécanicien/Pilote
                  </Typography>
                  <Typography variant="body1">
                    {formData.mechanic || 'N/A'}
                  </Typography>
                </Grid>
                {formData.deferred && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Référence MEL/CDL
                    </Typography>
                    <Typography variant="body1">
                      {formData.deferralRef || 'N/A'}
                    </Typography>
                  </Grid>
                )}
                {formData.resolved && (
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      Date de résolution
                    </Typography>
                    <Typography variant="body1">
                      {formData.resolutionDate ? new Date(formData.resolutionDate).toLocaleDateString('fr-FR') : 'N/A'}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
};

export default TechnicalLogEntry;