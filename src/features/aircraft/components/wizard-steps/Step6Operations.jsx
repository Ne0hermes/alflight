import React, { useState } from 'react';
import { 
  Box, 
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  FormGroup
} from '@mui/material';
import { 
  ExpandMore as ExpandMoreIcon,
  WbSunny as SunIcon,
  Stars as StarsIcon,
  Terrain as TerrainIcon
} from '@mui/icons-material';

const Step6Operations = ({ data, updateData, errors = {} }) => {
  const [expandedPanels, setExpandedPanels] = useState({
    flightRules: false,
    specialOps: false,
    environment: false
  });
  
  const handlePanelChange = (panel) => (event, isExpanded) => {
    if (isExpanded) {
      // When opening a panel, close all others and open this one
      setExpandedPanels({
        flightRules: false,
        specialOps: false,
        environment: false,
        [panel]: true
      });
    } else {
      // When closing a panel, just close it
      setExpandedPanels(prev => ({ ...prev, [panel]: false }));
    }
  };

  // Initialiser approvedOperations si elle n'existe pas
  const approvedOps = data.approvedOperations || {};

  const handleOperationChange = (operation) => {
    const newApprovedOps = {
      ...approvedOps,
      [operation]: !approvedOps[operation]
    };
    updateData('approvedOperations', newApprovedOps);
  };

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      
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

    </Box>
  );
};

export default Step6Operations;