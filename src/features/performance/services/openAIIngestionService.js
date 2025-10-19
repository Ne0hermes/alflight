// Service d'ingestion via OpenAI API pour l'extraction des données de performances
// Gère l'OCR et la vision pour extraire les tableaux et abaques des PDFs

class OpenAIIngestionService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4-vision-preview'; // ou gpt-4o pour vision + OCR
  }

  // Ingestion d'une page PDF via l'API OpenAI Vision
  async ingestPage(pageImage, pageNumber, options = {}) {
    const { need = 'both', detail = 'full' } = options;
    
    try {
      const prompt = this.buildIngestionPrompt(need, detail, pageNumber);
      
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an aviation document analyzer specializing in extracting performance data from aircraft manuals.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: pageImage, detail: detail === 'full' ? 'high' : 'low' } }
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.1 // Basse température pour plus de précision
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parser la réponse JSON de l'API
      return this.parseIngestionResponse(content, pageNumber);
      
    } catch (error) {
      console.error('Erreur lors de l\'ingestion OpenAI:', error);
      throw error;
    }
  }

  // Construction du prompt pour l'extraction
  buildIngestionPrompt(need, detail, pageNumber) {
    let prompt = `Analyze this aviation performance document page ${pageNumber}.\n`;
    
    if (need === 'tables' || need === 'both') {
      prompt += `
Extract all performance tables with the following structure:
- Table caption/title
- Column headers with units
- All data rows
- Any notes or conditions mentioned

Format tables as structured JSON with:
{
  "id": "tbl_p${pageNumber}_idx{index}",
  "caption": "table title",
  "columns": [{"name": "column", "unit": "unit"}],
  "rows": [[values]]
}
`;
    }
    
    if (need === 'abacs' || need === 'both') {
      prompt += `
Extract all performance charts/abacs with:
- Chart title and purpose
- Axes labels and units
- Data series/curves information
- If possible, digitize key points from curves

Format charts as:
{
  "id": "fig_p${pageNumber}_idx{index}",
  "caption": "chart title",
  "type": "abac",
  "axes": {
    "x": {"label": "label", "unit": "unit", "min": min, "max": max},
    "y": {"label": "label", "unit": "unit", "min": min, "max": max},
    "z_or_series": [{"label": "series", "value": value}]
  },
  "digitized_points": [{"series": "name", "x": x, "y": y}]
}
`;
    }

    if (detail === 'full') {
      prompt += '\nProvide complete extraction with all data points and maximum precision.';
    } else {
      prompt += '\nProvide a summary extraction focusing on key information only.';
    }

    prompt += '\n\nReturn response as valid JSON in the APP_PAGE_EXTRACT format.';
    
    return prompt;
  }

  // Parser la réponse de l'API OpenAI
  parseIngestionResponse(content, pageNumber) {
    try {
      // Essayer de parser directement comme JSON
      let parsed = JSON.parse(content);
      
      // S'assurer que c'est dans le bon format
      if (!parsed.page) {
        parsed = {
          page: pageNumber,
          text_blocks: parsed.text_blocks || [],
          tables: parsed.tables || [],
          figures: parsed.figures || [],
          notes: parsed.notes || []
        };
      }
      
      return parsed;
      
    } catch (error) {
      // Si le parsing JSON échoue, essayer d'extraire le JSON du texte
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Impossible de parser la réponse OpenAI:', e);
        }
      }
      
      // Retourner une structure vide si l'extraction échoue
      return {
        page: pageNumber,
        text_blocks: [],
        tables: [],
        figures: [],
        notes: ['Extraction failed']
      };
    }
  }

  // Ingestion batch de plusieurs pages
  async ingestBatch(pageImages, options = {}) {
    const results = [];
    
    for (let i = 0; i < pageImages.length; i++) {
      const pageResult = await this.ingestPage(
        pageImages[i].image,
        pageImages[i].pageNumber,
        options
      results.push(pageResult);
      
      // Petite pause pour éviter le rate limiting
      if (i < pageImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return {
      pages: results
    };
  }

  // Extraction des métadonnées du document
  async extractDocumentMeta(firstPageImage) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Extract document metadata from this aviation manual cover/first page:
                  - Aircraft model
                  - Document title
                  - Edition/revision
                  - Date
                  - Section if applicable
                  Return as JSON with keys: aircraft_model, document_title, document_edition, document_date, section`
                },
                {
                  type: 'image_url',
                  image_url: { url: firstPageImage, detail: 'high' }
                }
              ]
            }
          ],
          max_tokens: 500,
          temperature: 0.1
        })
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      try {
        return JSON.parse(content);
      } catch {
        // Extraction basique si le parsing échoue
        return {
          aircraft_model: null,
          document_title: 'Unknown Manual',
          document_edition: null,
          document_date: null,
          section: 'Performance'
        };
      }
      
    } catch (error) {
      console.error('Erreur extraction métadonnées:', error);
      return {
        aircraft_model: null,
        document_title: 'Unknown Manual',
        document_edition: null,
        document_date: null,
        section: null
      };
    }
  }

  // Digitalisation avancée d'un abaque
  async digitizeAbac(abacImage, abacMetadata) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content: 'You are an expert at digitizing aviation performance charts. Extract precise numerical data points from curves.'
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Digitize this performance chart with high precision:
                  ${JSON.stringify(abacMetadata)}
                  
                  Extract at least 20 data points per curve/series.
                  For each point provide exact x,y coordinates.
                  Identify all curves/series in the chart.
                  
                  Return as JSON:
                  {
                    "curves": [
                      {
                        "series_name": "name or value",
                        "points": [{"x": value, "y": value}]
                      }
                    ],
                    "interpolation_method": "linear|spline|polynomial",
                    "confidence": 0.0-1.0
                  }`
                },
                {
                  type: 'image_url',
                  image_url: { url: abacImage, detail: 'high' }
                }
              ]
            }
          ],
          max_tokens: 4000,
          temperature: 0.1
        })
      });

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      return JSON.parse(content);
      
    } catch (error) {
      console.error('Erreur digitalisation abaque:', error);
      throw error;
    }
  }

  // Validation de l'extraction par double vérification
  async validateExtraction(originalImage, extractedData) {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Validate this extraction against the original image:
                  ${JSON.stringify(extractedData)}
                  
                  Check for:
                  - Missing data
                  - Incorrect values
                  - Wrong units
                  
                  Return validation result as JSON:
                  {
                    "is_valid": true/false,
                    "confidence": 0.0-1.0,
                    "issues": ["list of issues"],
                    "corrections": {"field": "corrected_value"}
                  }`
                },
                {
                  type: 'image_url',
                  image_url: { url: originalImage, detail: 'high' }
                }
              ]
            }
          ],
          max_tokens: 1000,
          temperature: 0.1
        })
      });

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
      
    } catch (error) {
      console.error('Erreur validation extraction:', error);
      return {
        is_valid: false,
        confidence: 0,
        issues: ['Validation failed'],
        corrections: {}
      };
    }
  }
}

export default OpenAIIngestionService;