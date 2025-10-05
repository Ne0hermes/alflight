import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  TextField,
  Grid,
  Alert
} from '@mui/material';
import {
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon
} from '@mui/icons-material';

const ExcelTrackerComponent = () => {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Charger les logs au montage
  useEffect(() => {
    loadLogs();

    // Écouter les nouveaux logs
    const handleNewLog = () => {
      loadLogs();
    };

    window.addEventListener('excel-log-added', handleNewLog);

    // Rafraîchir toutes les 5 secondes
    const interval = setInterval(loadLogs, 5000);

    return () => {
      window.removeEventListener('excel-log-added', handleNewLog);
      clearInterval(interval);
    };
  }, []);

  const loadLogs = () => {
    if (window.excelTracker) {
      const recentLogs = window.excelTracker.getRecentLogs(50);
      setLogs(recentLogs.reverse());
      setSummary(window.excelTracker.getSummary());
      setLastUpdate(new Date());
    }
  };

  const handleExport = () => {
    if (window.excelTracker) {
      window.excelTracker.exportToExcel();
    }
  };

  const handleAddTestLog = () => {
    if (window.excelTracker) {
      window.excelTracker.log(
        'Test manuel',
        'ExcelTracker',
        `Test ajouté à ${new Date().toLocaleTimeString('fr-FR')}`,
        'completed'
      );
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckIcon fontSize="small" color="success" />;
      case 'error':
        return <ErrorIcon fontSize="small" color="error" />;
      case 'warning':
        return <WarningIcon fontSize="small" color="warning" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  const filteredLogs = filter
    ? logs.filter(log =>
        log.action?.toLowerCase().includes(filter.toLowerCase()) ||
        log.component?.toLowerCase().includes(filter.toLowerCase()) ||
        log.details?.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  return (
    <Card elevation={3}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h5" component="h2">
            📊 Tracker Excel Local
          </Typography>
          <Box>
            <IconButton onClick={loadLogs} title="Rafraîchir">
              <RefreshIcon />
            </IconButton>
            <Button
              variant="contained"
              color="primary"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              sx={{ ml: 1 }}
            >
              Exporter Excel
            </Button>
          </Box>
        </Box>

        {summary && (
          <Grid container spacing={2} mb={3}>
            <Grid item xs={3}>
              <Alert severity="info" variant="outlined">
                <Typography variant="body2">
                  <strong>Total:</strong> {summary.totalLogs} logs
                </Typography>
              </Alert>
            </Grid>
            <Grid item xs={3}>
              <Alert severity="success" variant="outlined">
                <Typography variant="body2">
                  <strong>Dernières 24h:</strong> {summary.stats.recentActions}
                </Typography>
              </Alert>
            </Grid>
            <Grid item xs={3}>
              <Alert severity="info" variant="outlined">
                <Typography variant="body2">
                  <strong>Moy/jour:</strong> {summary.stats.actionsPerDay.toFixed(1)}
                </Typography>
              </Alert>
            </Grid>
            <Grid item xs={3}>
              <Alert severity="info" variant="outlined">
                <Typography variant="body2">
                  <strong>Mise à jour:</strong> {lastUpdate.toLocaleTimeString('fr-FR')}
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        )}

        <Box mb={2} display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Filtrer les logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
          <Button
            variant="outlined"
            onClick={handleAddTestLog}
            startIcon={<SaveIcon />}
          >
            Ajouter Test
          </Button>
        </Box>

        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Heure</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Composant</TableCell>
                <TableCell>Détails</TableCell>
                <TableCell align="center">Statut</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLogs.map((log, index) => (
                <TableRow key={log.id || index} hover>
                  <TableCell>
                    {new Date(log.timestamp).toLocaleTimeString('fr-FR')}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {log.action}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={log.component}
                      size="small"
                      variant="outlined"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {log.details}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Box display="flex" alignItems="center" justifyContent="center">
                      {getStatusIcon(log.status)}
                      <Chip
                        label={log.status}
                        size="small"
                        color={getStatusColor(log.status)}
                        sx={{ ml: 1 }}
                      />
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box mt={2} display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Auto-save activé • Mise à jour toutes les 30 secondes
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {filteredLogs.length} / {logs.length} logs affichés
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ExcelTrackerComponent;