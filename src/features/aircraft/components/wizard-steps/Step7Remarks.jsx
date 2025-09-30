import React from 'react';
import { 
  Box, 
  Typography,
  Paper
} from '@mui/material';
import { 
  Notes as NotesIcon
} from '@mui/icons-material';

const Step7Remarks = ({ data, updateData, errors = {} }) => {
  return (
    <Box sx={{ 
      maxWidth: 1000, 
      mx: 'auto', 
      p: 2
    }}>
      
      {/* Section unique pour les remarques */}
      <Paper 
        elevation={0}
        sx={{ 
          p: 4,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minHeight: 500
        }}
      >

        <Box sx={{ width: '100%' }}>
          {/* Label custom */}
          <Typography 
            variant="body2" 
            sx={{ 
              mb: 1,
              fontSize: '14px',
              fontWeight: 500,
              color: errors.remarks ? 'error.main' : 'text.primary'
            }}
          >
            Remarques
          </Typography>
          
          {/* Zone de texte */}
          <Box
            component="textarea"
            value={data.remarks || ''}
            onChange={(e) => updateData('remarks', e.target.value)}
            placeholder="Ajoutez ici toutes les informations complémentaires concernant l'appareil..."
            sx={{
              width: '100%',
              minHeight: '240px',
              maxHeight: '400px',
              padding: '14px',
              fontSize: '14px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              lineHeight: 1.6,
              border: errors.remarks ? '2px solid' : '1px solid',
              borderColor: errors.remarks ? 'error.main' : 'rgba(0, 0, 0, 0.23)',
              borderRadius: '4px',
              bgcolor: 'background.paper',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.2s',
              '&:hover': {
                borderColor: errors.remarks ? 'error.main' : 'rgba(0, 0, 0, 0.87)'
              },
              '&:focus': {
                borderColor: errors.remarks ? 'error.main' : 'primary.main',
                borderWidth: '2px',
                padding: '13px'
              }
            }}
          />
          
          {/* Info box avec les suggestions */}
          <Box sx={{
            mt: 3,
            p: 2.5,
            bgcolor: 'grey.50',
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'grey.300'
          }}>
            <Typography variant="body2" sx={{ 
              fontSize: '13px', 
              color: 'text.secondary',
              fontWeight: 500,
              mb: 1.5
            }}>
              Suggestions de contenu :
            </Typography>
            <Box component="ul" sx={{ 
              m: 0, 
              pl: 2.5,
              '& li': {
                fontSize: '12px',
                color: 'text.secondary',
                lineHeight: 1.8,
                mb: 0.5
              }
            }}>
              <li>Modifications spécifiques (STC)</li>
              <li>Historique de maintenance particulier</li>
              <li>Limitations supplémentaires</li>
              <li>Particularités de pilotage</li>
              <li>Consignes spéciales</li>
              <li>Contacts utiles</li>
              <li>Autres informations pertinentes</li>
            </Box>
          </Box>
        </Box>
      </Paper>

    </Box>
  );
};

export default Step7Remarks;