import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  FormGroup,
  TextField,
  Button
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Radio as RadioIcon,
  Navigation as NavigationIcon,
  Radar as RadarIcon,
  RadioButtonChecked as SpecialIcon,
  ChevronRight as ChevronRightIcon,
  ChevronLeft as ChevronLeftIcon,
  WbSunny as SunIcon,
  Stars as StarsIcon,
  Terrain as TerrainIcon,
  LocalHospital as SearchRescueIcon
} from '@mui/icons-material';

const Step5Equipment = ({ data, updateData, errors = {}, onNext, onPrevious }) => {
  const [expandedPanels, setExpandedPanels] = useState({
    com: false,
    nav: false,
    surveillance: false,
    special: false,
    flightRules: false,
    specialOps: false,
    searchRescue: false,
    environment: false
  });

  // Helper pour assurer que les valeurs sont des booléens
  const ensureBoolean = (value) => {
    if (typeof value === 'string') {
      return value === 'true' || value === '1';
    }
    return Boolean(value);
  };

  const handlePanelChange = (panel) => (event, isExpanded) => {
    if (isExpanded) {
      // When opening a panel, close all others and open this one
      setExpandedPanels({
        com: false,
        nav: false,
        surveillance: false,
        special: false,
        flightRules: false,
        specialOps: false,
        searchRescue: false,
        environment: false,
        [panel]: true
      });
    } else {
      // When closing a panel, just close it
      setExpandedPanels(prev => ({ ...prev, [panel]: false }));
    }
  };

  // Initialiser les objets s'ils n'existent pas
  const equipmentCom = data.equipmentCom || {};
  const equipmentNav = data.equipmentNav || {};
  const equipmentSurv = data.equipmentSurv || {};
  const specialCapabilities = data.specialCapabilities || {};
  const approvedOps = data.approvedOperations || {};

  const handleEquipmentChange = (category, field, value) => {
    const updatedCategory = {
      ...data[category],
      [field]: value
    };
    updateData(category, updatedCategory);
  };

  const handleOperationChange = (operation) => {
    const newApprovedOps = {
      ...approvedOps,
      [operation]: !approvedOps[operation]
    };
    updateData('approvedOperations', newApprovedOps);
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      
      {/* Équipements COM */}
      <Accordion 
        expanded={expandedPanels.com}
        onChange={handlePanelChange('com')}
        elevation={0}
        sx={{ 
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': { 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <RadioIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Équipements COM (Communication)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <FormGroup sx={{ width: '100%', maxWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentCom.vhf1 !== false)}
                      onChange={(e) => handleEquipmentChange('equipmentCom', 'vhf1', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      VHF COM 1
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentCom.vhf2 !== false)}
                      onChange={(e) => handleEquipmentChange('equipmentCom', 'vhf2', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      VHF COM 2
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentCom.hf || false)}
                      onChange={(e) => handleEquipmentChange('equipmentCom', 'hf', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      HF (Haute fréquence)
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentCom.satcom || false)}
                      onChange={(e) => handleEquipmentChange('equipmentCom', 'satcom', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      SATCOM
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentCom.acars || false)}
                      onChange={(e) => handleEquipmentChange('equipmentCom', 'acars', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      ACARS
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentCom.cpdlc || false)}
                      onChange={(e) => handleEquipmentChange('equipmentCom', 'cpdlc', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      CPDLC (Datalink)
                    </Typography>

                  }
                  sx={{ gridColumn: 'span 2' }}
                />
              </Box>
            </FormGroup>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Équipements NAV */}
      <Accordion 
        expanded={expandedPanels.nav}
        onChange={handlePanelChange('nav')}
        elevation={0}
        sx={{ 
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': { 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <NavigationIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Équipements NAV (Navigation)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <FormGroup sx={{ width: '100%', maxWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentNav.vor !== false)}
                      onChange={(e) => handleEquipmentChange('equipmentNav', 'vor', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      VOR
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentNav.dme !== false)}
                      onChange={(e) => handleEquipmentChange('equipmentNav', 'dme', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      DME
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentNav.adf || false)}
                      onChange={(e) => handleEquipmentChange('equipmentNav', 'adf', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      ADF/NDB
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentNav.gnss !== false)}
                      onChange={(e) => handleEquipmentChange('equipmentNav', 'gnss', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      GNSS/GPS
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentNav.ils !== false)}
                      onChange={(e) => handleEquipmentChange('equipmentNav', 'ils', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      ILS
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentNav.mls || false)}
                      onChange={(e) => handleEquipmentChange('equipmentNav', 'mls', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      MLS
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentNav.gbas || false)}
                      onChange={(e) => handleEquipmentChange('equipmentNav', 'gbas', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      GBAS
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentNav.lpv || false)}
                      onChange={(e) => handleEquipmentChange('equipmentNav', 'lpv', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      LPV (approche GPS)
                    </Typography>
                  }
                />
              </Box>

              {/* Nouveaux équipements Nav */}
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontSize: '14px', fontWeight: 500, mb: 2 }}>
                  Systèmes avancés
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={ensureBoolean(equipmentNav.ahrs || false)}
                        onChange={(e) => handleEquipmentChange('equipmentNav', 'ahrs', e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: '14px' }}>
                        AHRS (Attitude & Heading)
                      </Typography>
                    }
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={ensureBoolean(equipmentNav.adc || false)}
                        onChange={(e) => handleEquipmentChange('equipmentNav', 'adc', e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: '14px' }}>
                        ADC (Air Data Computer)
                      </Typography>
                    }
                  />
                </Box>
              </Box>

              {/* RNAV et RNP */}
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={ensureBoolean(equipmentNav.rnav || false)}
                          onChange={(e) => handleEquipmentChange('equipmentNav', 'rnav', e.target.checked)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: '14px', fontWeight: 500 }}>
                          Capacité RNAV
                        </Typography>
                      }
                    />
                    {equipmentNav.rnav && (
                      <TextField
                        size="small"
                        fullWidth
                        value={equipmentNav.rnavTypes || ''}
                        onChange={(e) => handleEquipmentChange('equipmentNav', 'rnavTypes', e.target.value)}
                        placeholder="Ex: RNAV 10, RNAV 5, RNAV 1"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={ensureBoolean(equipmentNav.rnp || false)}
                          onChange={(e) => handleEquipmentChange('equipmentNav', 'rnp', e.target.checked)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: '14px', fontWeight: 500 }}>
                          Capacité RNP
                        </Typography>
                      }
                    />
                    {equipmentNav.rnp && (
                      <TextField
                        size="small"
                        fullWidth
                        value={equipmentNav.rnpTypes || ''}
                        onChange={(e) => handleEquipmentChange('equipmentNav', 'rnpTypes', e.target.value)}
                        placeholder="Ex: RNP 4, RNP 1, RNP APCH"
                        sx={{ mt: 1 }}
                      />
                    )}
                  </Box>
                </Box>
              </Box>
            </FormGroup>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Équipements Surveillance */}
      <Accordion 
        expanded={expandedPanels.surveillance}
        onChange={handlePanelChange('surveillance')}
        elevation={0}
        sx={{ 
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': { 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <RadarIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Équipements de Surveillance
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <FormGroup sx={{ width: '100%', maxWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentSurv.adsb || false)}
                      onChange={(e) => handleEquipmentChange('equipmentSurv', 'adsb', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      ADS-B Out
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentSurv.adsc || false)}
                      onChange={(e) => handleEquipmentChange('equipmentSurv', 'adsc', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      ADS-C
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentSurv.tcas || false)}
                      onChange={(e) => handleEquipmentChange('equipmentSurv', 'tcas', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      TCAS
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentSurv.acas || false)}
                      onChange={(e) => handleEquipmentChange('equipmentSurv', 'acas', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      ACAS II
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentSurv.taws || false)}
                      onChange={(e) => handleEquipmentChange('equipmentSurv', 'taws', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      TAWS/GPWS
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentSurv.cvr || false)}
                      onChange={(e) => handleEquipmentChange('equipmentSurv', 'cvr', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      CVR
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentSurv.fdr || false)}
                      onChange={(e) => handleEquipmentChange('equipmentSurv', 'fdr', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      FDR
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(equipmentSurv.weather || false)}
                      onChange={(e) => handleEquipmentChange('equipmentSurv', 'weather', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Radar météo
                    </Typography>
                  }
                />
              </Box>

              {/* Mode transpondeur - Sélection multiple */}
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontSize: '14px', fontWeight: 500, mb: 1 }}>
                  Mode transpondeur (sélection multiple)
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
                  {['Mode A', 'Mode C', 'Mode S'].map(mode => {
                    const modeKey = mode.toLowerCase().replace('mode ', '');
                    const transponderModes = equipmentSurv.transponderModes || [];

                    return (
                      <FormControlLabel
                        key={mode}
                        control={
                          <Checkbox
                            checked={ensureBoolean(transponderModes.includes(modeKey))}
                            onChange={(e) => {
                              const newModes = e.target.checked
                                ? [...transponderModes, modeKey]
                                : transponderModes.filter(m => m !== modeKey);
                              handleEquipmentChange('equipmentSurv', 'transponderModes', newModes);
                            }}
                            size="small"
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontSize: '14px' }}>
                            {mode}
                          </Typography>
                        }
                      />
                    );
                  })}
                </Box>

                {/* ADS-B Out - Checkbox séparé */}
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={ensureBoolean(equipmentSurv.adsbOut || false)}
                        onChange={(e) => handleEquipmentChange('equipmentSurv', 'adsbOut', e.target.checked)}
                        size="small"
                      />
                    }
                    label={
                      <Typography variant="body2" sx={{ fontSize: '14px', fontWeight: 500 }}>
                        ADS-B Out (1090 MHz)
                      </Typography>
                    }
                  />
                </Box>
              </Box>
            </FormGroup>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Capacités spéciales */}
      <Accordion 
        expanded={expandedPanels.special}
        onChange={handlePanelChange('special')}
        elevation={0}
        sx={{ 
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ 
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': { 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <SpecialIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Capacités spéciales
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <FormGroup sx={{ width: '100%', maxWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.pbn || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'pbn', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      PBN (Performance Based Navigation)
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.lvto || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'lvto', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      LVTO (Low Visibility Take-Off)
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.catII || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'catII', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      CAT II
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.catIIIa || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'catIIIa', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      CAT IIIa
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.catIIIb || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'catIIIb', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      CAT IIIb
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.catIIIc || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'catIIIc', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      CAT IIIc
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.etops || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'etops', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      ETOPS
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.rvsm || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'rvsm', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      RVSM
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.mnps || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'mnps', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      MNPS
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={ensureBoolean(specialCapabilities.icing || false)}
                      onChange={(e) => handleEquipmentChange('specialCapabilities', 'icing', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Dégivrage/Antigivrage
                    </Typography>
                  }
                />
              </Box>
            </FormGroup>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* === OPÉRATIONS APPROUVÉES === */}

      {/* Règles de vol */}
      <Accordion
        expanded={expandedPanels.flightRules}
        onChange={handlePanelChange('flightRules')}
        elevation={0}
        sx={{
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': {
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <SunIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Règles de vol
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <FormGroup sx={{ width: '100%', maxWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.vfrDay || false}
                      onChange={() => handleOperationChange('vfrDay')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      VFR Jour
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.vfrNight || false}
                      onChange={() => handleOperationChange('vfrNight')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      VFR Nuit
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.ifrDay || false}
                      onChange={() => handleOperationChange('ifrDay')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      IFR Jour
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.ifrNight || false}
                      onChange={() => handleOperationChange('ifrNight')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      IFR Nuit
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.svfr || false}
                      onChange={() => handleOperationChange('svfr')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      VFR Spécial (SVFR)
                    </Typography>
                  }
                  sx={{ gridColumn: 'span 2' }}
                />
              </Box>
            </FormGroup>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Opérations spéciales */}
      <Accordion
        expanded={expandedPanels.specialOps}
        onChange={handlePanelChange('specialOps')}
        elevation={0}
        sx={{
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': {
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <StarsIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Opérations spéciales
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <FormGroup sx={{ width: '100%', maxWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.formation || false}
                      onChange={() => handleOperationChange('formation')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Vol en formation
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.aerobatics || false}
                      onChange={() => handleOperationChange('aerobatics')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Voltige aérienne
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.banner || false}
                      onChange={() => handleOperationChange('banner')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Remorquage bannière
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.glider || false}
                      onChange={() => handleOperationChange('glider')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Remorquage planeur
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.parachute || false}
                      onChange={() => handleOperationChange('parachute')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Largage parachutistes
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.agricultural || false}
                      onChange={() => handleOperationChange('agricultural')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Épandage agricole
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.aerial || false}
                      onChange={() => handleOperationChange('aerial')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Photo/Surveillance
                    </Typography>
                  }
                  sx={{ gridColumn: 'span 2' }}
                />
              </Box>
            </FormGroup>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Environnement et usage */}
      <Accordion
        expanded={expandedPanels.environment}
        onChange={handlePanelChange('environment')}
        elevation={0}
        sx={{
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': {
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <TerrainIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Environnement et usage
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <FormGroup sx={{ width: '100%', maxWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.training || false}
                      onChange={() => handleOperationChange('training')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      École de pilotage
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.charter || false}
                      onChange={() => handleOperationChange('charter')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Transport public
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.mountainous || false}
                      onChange={() => handleOperationChange('mountainous')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Vol en montagne
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.seaplane || false}
                      onChange={() => handleOperationChange('seaplane')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Hydravion
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.skiPlane || false}
                      onChange={() => handleOperationChange('skiPlane')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Avion sur skis
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.icing || false}
                      onChange={() => handleOperationChange('icing')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Conditions givrantes
                    </Typography>
                  }
                />
              </Box>
            </FormGroup>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Search and Rescue */}
      <Accordion
        expanded={expandedPanels.searchRescue}
        onChange={handlePanelChange('searchRescue')}
        elevation={0}
        sx={{
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{
            minHeight: '40px',
            '&.Mui-expanded': { minHeight: '40px' },
            '& .MuiAccordionSummary-content': {
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              margin: '8px 0'
            },
            '& .MuiAccordionSummary-content.Mui-expanded': {
              margin: '8px 0'
            }
          }}
        >
          <SearchRescueIcon color="primary" />
          <Typography variant="subtitle1" sx={{ fontSize: '15px', fontWeight: 600 }}>
            Search and Rescue (Équipements de sauvetage)
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <FormGroup sx={{ width: '100%', maxWidth: 600 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.elt || false}
                      onChange={() => handleOperationChange('elt')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      ELT 121.5/406 MHz
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.lifeVests || false}
                      onChange={() => handleOperationChange('lifeVests')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Gilets de sauvetage
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.fireExtinguisherHalon || false}
                      onChange={() => handleOperationChange('fireExtinguisherHalon')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Extincteur Halon (BCF)
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.fireExtinguisherWater || false}
                      onChange={() => handleOperationChange('fireExtinguisherWater')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Extincteur H2O (Eau)
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.fireExtinguisherPowder || false}
                      onChange={() => handleOperationChange('fireExtinguisherPowder')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Extincteur Poudre/CO2
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.oxygenBottles || false}
                      onChange={() => handleOperationChange('oxygenBottles')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Réserve d'oxygène (bouteilles)
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.lifeRaft || false}
                      onChange={() => handleOperationChange('lifeRaft')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Radeau de survie
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.survivalKit || false}
                      onChange={() => handleOperationChange('survivalKit')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Trousse de survie
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.plb || false}
                      onChange={() => handleOperationChange('plb')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Balise PLB
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.signalMirror || false}
                      onChange={() => handleOperationChange('signalMirror')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Miroir de signalisation
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.flares || false}
                      onChange={() => handleOperationChange('flares')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Fusées de détresse
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.survivalRadio || false}
                      onChange={() => handleOperationChange('survivalRadio')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Radio de survie
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.firstAidKit || false}
                      onChange={() => handleOperationChange('firstAidKit')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Kit de premiers secours
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={approvedOps.survivalClothing || false}
                      onChange={() => handleOperationChange('survivalClothing')}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      Vêtements de survie
                    </Typography>
                  }
                />
              </Box>
            </FormGroup>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Boutons de navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        {/* Bouton Précédent */}
        {onPrevious && (
          <Button
            variant="outlined"
            color="primary"
            size="large"
            onClick={onPrevious}
            startIcon={<ChevronLeftIcon />}
          >
            Précédent
          </Button>
        )}

        {/* Bouton Suivant */}
        {onNext && (
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={onNext}
            endIcon={<ChevronRightIcon />}
          >
            Suivant
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default Step5Equipment;