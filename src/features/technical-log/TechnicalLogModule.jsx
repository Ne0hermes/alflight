import React, { useState } from 'react';
import { Box, Tabs, Tab, Badge } from '@mui/material';
import {
  Description as DescriptionIcon,
  Build as BuildIcon,
  Schedule as ScheduleIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { useAircraftStore } from '../../core/stores/aircraftStore';
import { useNavigationStore } from '../../core/stores/navigationStore';
import { useTechnicalLogStore } from '../../core/stores/technicalLogStore';
import TechnicalLogList from './components/TechnicalLogList';
import MaintenanceSchedule from './components/MaintenanceSchedule';
import SurvivalEquipmentChecklist from './components/SurvivalEquipmentChecklist';
import DangerousZonesDetector from '../navigation/components/DangerousZonesDetector';

const TechnicalLogModule = () => {
  const { selectedAircraft } = useAircraftStore();
  const { waypoints, segmentAltitudes } = useNavigationStore();
  const { getDeferredEntries, getOpenDefects, getMaintenanceDue } = useTechnicalLogStore();
  const [activeTab, setActiveTab] = useState(0);
  const [flightZones, setFlightZones] = useState({});
  const [dangerousZones, setDangerousZones] = useState({});
  
  // Calculer les badges pour les onglets
  const deferredCount = getDeferredEntries().length;
  const defectsCount = getOpenDefects().length;
  const maintenanceDue = getMaintenanceDue(
    selectedAircraft?.totalHours || 0,
    selectedAircraft?.totalCycles || 0
  );
  const maintenanceDueCount = maintenanceDue.due.length + maintenanceDue.upcoming.length;
  
  // Récupérer les zones dangereuses depuis le module Navigation
  React.useEffect(() => {
    const checkZones = () => {
      const storedZones = localStorage.getItem('flightDangerousZones');
      if (storedZones) {
        try {
          const zones = JSON.parse(storedZones);
          setFlightZones(zones);
          setDangerousZones(zones);
        } catch (error) {
          console.error('Error parsing flight zones:', error);
        }
      }
    };
    
    // Vérifier au montage et à intervalles réguliers
    checkZones();
    const interval = setInterval(checkZones, 2000); // Vérifier toutes les 2 secondes
    
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ width: '100%', p: 2 }}>
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        <Tab 
          icon={<DescriptionIcon />} 
          label={
            <Badge badgeContent={deferredCount + defectsCount} color="error">
              Log technique
            </Badge>

          }
          iconPosition="start"
        />
        <Tab 
          icon={<ScheduleIcon />} 
          label={
            <Badge badgeContent={maintenanceDueCount} color="warning">
              Programme maintenance
            </Badge>

          }
          iconPosition="start"
        />
        <Tab 
          icon={<ShieldIcon />} 
          label="Équipements SAR" 
          iconPosition="start"
        />
        <Tab 
          icon={<WarningIcon />} 
          label={
            <Badge badgeContent={Object.keys(dangerousZones).length} color="error">
              Zones dangereuses
            </Badge>

          }
          iconPosition="start"
        />
      </Tabs>

      {/* Contenu des onglets */}
      <Box sx={{ mt: 2 }}>
        {activeTab === 0 && <TechnicalLogList />}
        {activeTab === 1 && <MaintenanceSchedule />}
        {activeTab === 2 && (
          <SurvivalEquipmentChecklist 
            aircraftReg={selectedAircraft?.registration || 'DEFAULT'}
            flightZones={flightZones}
          />
        )}
        {activeTab === 3 && (
          <DangerousZonesDetector
            waypoints={waypoints}
            onZonesChange={setDangerousZones}
            segmentAltitudes={segmentAltitudes}
          />
        )}
      </Box>
    </Box>

};

export default TechnicalLogModule;