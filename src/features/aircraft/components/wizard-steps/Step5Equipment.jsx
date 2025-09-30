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
  TextField
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  Radio as RadioIcon,
  Navigation as NavigationIcon,
  Radar as RadarIcon,
  RadioButtonChecked as SpecialIcon
} from '@mui/icons-material';

const Step5Equipment = ({ data, updateData, errors = {} }) => {
  const [expandedPanels, setExpandedPanels] = useState({
    com: false,
    nav: false,
    surveillance: false,
    special: false
  });
  
  const handlePanelChange = (panel) => (event, isExpanded) => {
    if (isExpanded) {
      // When opening a panel, close all others and open this one
      setExpandedPanels({
        com: false,
        nav: false,
        surveillance: false,
        special: false,
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

  const handleEquipmentChange = (category, field, value) => {
    const updatedCategory = {
      ...data[category],
      [field]: value
    };
    updateData(category, updatedCategory);
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
                      checked={equipmentCom.vhf1 !== false}
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
                      checked={equipmentCom.vhf2 !== false}
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
                      checked={equipmentCom.hf || false}
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
                      checked={equipmentCom.satcom || false}
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
                      checked={equipmentCom.elt !== false}
                      onChange={(e) => handleEquipmentChange('equipmentCom', 'elt', e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '14px' }}>
                      ELT (Balise de détresse)
                    </Typography>
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={equipmentCom.acars || false}
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
                      checked={equipmentCom.cpdlc || false}
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
                      checked={equipmentNav.vor !== false}
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
                      checked={equipmentNav.dme !== false}
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
                      checked={equipmentNav.adf || false}
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
                      checked={equipmentNav.gnss !== false}
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
                      checked={equipmentNav.ils !== false}
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
                      checked={equipmentNav.mls || false}
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
                      checked={equipmentNav.gbas || false}
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
                      checked={equipmentNav.lpv || false}
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

              {/* RNAV et RNP */}
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
                  <Box>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={equipmentNav.rnav || false}
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
                          checked={equipmentNav.rnp || false}
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
                      checked={equipmentSurv.adsb || false}
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
                      checked={equipmentSurv.adsc || false}
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
                      checked={equipmentSurv.tcas || false}
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
                      checked={equipmentSurv.acas || false}
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
                      checked={equipmentSurv.taws || false}
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
                      checked={equipmentSurv.cvr || false}
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
                      checked={equipmentSurv.fdr || false}
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
                      checked={equipmentSurv.weather || false}
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

              {/* Mode transpondeur */}
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontSize: '14px', fontWeight: 500, mb: 1 }}>
                  Mode transpondeur
                </Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {['None', 'A', 'C', 'S'].map(mode => (
                    <FormControlLabel
                      key={mode}
                      control={
                        <Checkbox
                          checked={(equipmentSurv.transponderMode || 'C') === mode}
                          onChange={() => handleEquipmentChange('equipmentSurv', 'transponderMode', mode)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: '14px' }}>
                          Mode {mode}
                        </Typography>
                      }
                    />
                  ))}
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
                      checked={specialCapabilities.pbn || false}
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
                      checked={specialCapabilities.lvto || false}
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
                      checked={specialCapabilities.catII || false}
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
                      checked={specialCapabilities.catIIIa || false}
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
                      checked={specialCapabilities.catIIIb || false}
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
                      checked={specialCapabilities.catIIIc || false}
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
                      checked={specialCapabilities.etops || false}
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
                      checked={specialCapabilities.rvsm || false}
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
                      checked={specialCapabilities.mnps || false}
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
                      checked={specialCapabilities.icing || false}
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

    </Box>
  );
};

export default Step5Equipment;