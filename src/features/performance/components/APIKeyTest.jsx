import React, { useState } from 'react';
import { Box, Button, Typography, Alert, CircularProgress, Paper } from '@mui/material';
import unifiedPerformanceService from '../services/unifiedPerformanceService';
import apiKeyManager from '../../../utils/apiKeyManager';

const APIKeyTest = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);
  const [apiKeyInfo, setApiKeyInfo] = useState(null);

  const checkAPIKey = () => {
    const key = apiKeyManager.getAPIKey();
    const hasKey = apiKeyManager.hasAPIKey();
    const endpoint = apiKeyManager.getEndpoint();
    
    setApiKeyInfo({
      hasKey,
      keyLength: key ? key.length : 0,
      keyPrefix: key ? key.substring(0, 10) + '...' : 'No key',
      endpoint,
      source: key ? (key === import.meta?.env?.VITE_OPENAI_API_KEY ? 'Environment Variable' : 'LocalStorage') : 'Not Found'
    });
  };

  const testAPIConnection = async () => {
    setTesting(true);
    setResult(null);
    
    try {
      // Initialize the service first
      unifiedPerformanceService.initialize();
      
      // Get current API key status
      checkAPIKey();
      
      // Test the connection
      const testResult = await unifiedPerformanceService.testAPIConnection();
      
      setResult({
        success: testResult.success,
        message: testResult.message,
        mode: testResult.mode
      });
      
      // If successful, try a simple AI call
      if (testResult.success) {
        const aiTestResult = await unifiedPerformanceService.callOpenAI(
          null,
          'Say "API connection successful" if you can read this.'
        
        setResult(prev => ({
          ...prev,
          aiResponse: aiTestResult.raw || JSON.stringify(aiTestResult)
        }));
      }
    } catch (error) {
      setResult({
        success: false,
        message: error.message,
        error: true
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Paper sx={{ p: 3, m: 2 }}>
      <Typography variant="h5" gutterBottom>
        API Key Integration Test
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Button 
          variant="contained" 
          onClick={checkAPIKey}
          sx={{ mr: 2 }}
        >
          Check API Key Status
        </Button>
        
        <Button 
          variant="contained" 
          color="primary"
          onClick={testAPIConnection}
          disabled={testing}
        >
          {testing ? <CircularProgress size={24} /> : 'Test API Connection'}
        </Button>
      </Box>
      
      {apiKeyInfo && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="subtitle2">API Key Info:</Typography>
          <Typography variant="body2">Has Key: {apiKeyInfo.hasKey ? 'Yes' : 'No'}</Typography>
          <Typography variant="body2">Key: {apiKeyInfo.keyPrefix}</Typography>
          <Typography variant="body2">Length: {apiKeyInfo.keyLength} characters</Typography>
          <Typography variant="body2">Source: {apiKeyInfo.source}</Typography>
          <Typography variant="body2">Endpoint: {apiKeyInfo.endpoint}</Typography>
        </Alert>
      )}
      
      {result && (
        <Alert severity={result.success ? 'success' : 'error'}>
          <Typography variant="subtitle2">
            {result.success ? 'Connection Successful!' : 'Connection Failed'}
          </Typography>
          <Typography variant="body2">
            Message: {result.message}
          </Typography>
          {result.mode && (
            <Typography variant="body2">
              Mode: {result.mode}
            </Typography>
          )}
          {result.aiResponse && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              AI Response: {result.aiResponse}
            </Typography>
          )}
        </Alert>
      )}
    </Paper>

};

export default APIKeyTest;