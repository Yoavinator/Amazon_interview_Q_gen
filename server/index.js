require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const app = express();
const port = process.env.PORT || 3001;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use(cors({
  origin: ['http://localhost:3000', 'https://yoavinator.github.io'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint for transcription
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  console.log('Transcribe request received');
  try {
    if (!req.file) {
      console.log('No file received');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('File received:', req.file.path);
    
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key is not set');
      return res.json({ text: "OpenAI API key is not set. Using mock response instead." });
    }
    
    // Fixed FormData handling with axios
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(req.file.path));
      formData.append('model', 'whisper-1');

      console.log('Sending request to OpenAI API...');
      
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions', 
        formData, 
        {
          headers: {
            ...formData.getHeaders(), // This is the correct way to get headers
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          }
        }
      );
      
      console.log('Received response from OpenAI API');

      // Clean up the uploaded file
      fs.unlinkSync(req.file.path);

      res.json({ text: response.data.text });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError.message);
      
      // Clean up uploaded file
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      // Fall back to mock response
      return res.json({ text: "Error calling OpenAI API. Using mock response instead." });
    }
  } catch (error) {
    console.error('Transcription error:', error.message);
    
    // Clean up uploaded file
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      error: 'Failed to transcribe audio',
      details: error.message
    });
  }
});

// Endpoint for ChatGPT feedback
app.post('/api/feedback', async (req, res) => {
  console.log('Feedback request received');
  
  try {
    const { transcription, question, feedbackType } = req.body;
    
    if (!transcription) {
      console.log('No transcription provided');
      return res.status(400).json({ error: 'No transcription provided' });
    }
    
    // Check for minimum transcription length and variety
    const words = transcription.split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;
    const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')));
    
    console.log('Transcription word count:', wordCount, 'Unique words:', uniqueWords.size);
    
    if (wordCount < 20 || uniqueWords.size < 5) {
      console.log('Transcription too short or not diverse enough');
      return res.status(400).json({ 
        error: `Transcription too short or repetitive (${wordCount} words, ${uniqueWords.size} unique). Please provide a more detailed response.`
      });
    }
    
    console.log('Processing feedback for question:', question);
    console.log('Feedback type:', feedbackType || 'standard');
    
    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key is not set');
      return res.json({ 
        choices: [{ 
          message: { 
            content: "This is a simulated feedback response since the OpenAI API key is not configured." 
          } 
        }] 
      });
    }
    
    // Update the prompt to generate the structured report format
    let prompt;
    
    if (feedbackType === 'amazon_pm') {
      prompt = `As an Amazon interview coach specializing in Product Management roles, evaluate the following candidate's answer to this question: "${question}".
      
      Candidate's answer: "${transcription}"
      
      Please return a structured report in exactly this format (use proper markdown):

      ## 📊 Overall Score
      **Score:** X/10
      **Question Category:** [Leadership Principle or PM skill the question is testing]
      **Response Summary:** [2-3 word summary of candidate's performance]

      ## 📌 STAR Method Analysis
      **Situation:** [Did the candidate clearly establish context? Provide brief analysis]
      **Task:** [Was their role/responsibility clearly articulated? Provide brief analysis]
      **Action:** [Did they explain their specific actions with enough detail? Provide brief analysis]
      **Result:** [Did they quantify impact and outcomes? Provide brief analysis]

      ## 🏆 Amazon Leadership Principles Assessment
      [Evaluate how well the answer demonstrated relevant Amazon Leadership Principles]
      - **Customer Obsession:** [Assessment]
      - **Ownership:** [Assessment]
      - **Invent and Simplify:** [Assessment]
      - Include only the principles that were relevant to this answer

      ## 🧠 PM-Specific Skills Assessment
      - **Product Sense:** [Assessment]
      - **Strategic Thinking:** [Assessment]
      - **Data-Driven Decision Making:** [Assessment]
      - **Cross-Functional Collaboration:** [Assessment]

      ## 🚀 Improvement Suggestions
      [Provide 3-4 specific ways the candidate could strengthen their answer]
      1. [First suggestion]
      2. [Second suggestion]
      3. [Third suggestion]

      ## ⚡ Summary & Key Takeaways
      [Brief summary of the candidate's performance, highlighting strengths and listing 2-3 actionable improvements]
      
      Be direct, specific, and actionable in your feedback. Do not be overly positive if the response does not warrant it.`;
    } else {
      // Standard prompt for other interview types (you can also update this if desired)
      prompt = `As an Amazon interview coach, evaluate the following candidate's answer to this question: "${question}".
      
      Candidate's answer: "${transcription}"
      
      Please return a structured report in exactly this format (use proper markdown):

      ## 📊 Overall Score
      **Score:** X/10
      **Question Category:** [Category]
      **Response Summary:** [2-3 word summary]

      ## 📌 Answer Structure Analysis
      [Analysis of the answer structure and completeness]

      ## 🚀 Improvement Suggestions
      [Provide 3-4 specific ways the candidate could strengthen their answer]
      1. [First suggestion]
      2. [Second suggestion]
      3. [Third suggestion]

      ## ⚡ Summary & Key Takeaways
      [Brief summary with actionable improvements]
      
      Be direct, specific, and actionable in your feedback.`;
    }
    
    // Calculate token estimate for GPT-4 (approximate)
    const inputTokenEstimate = (prompt.length / 4); // Very rough estimate
    
    // Set max tokens based on model and input length
    const model = "gpt-4"; // Updated to GPT-4
    const maxTokens = Math.min(4000, 8192 - Math.ceil(inputTokenEstimate));
    
    console.log(`Using model: ${model}, estimated input tokens: ~${Math.ceil(inputTokenEstimate)}, max output tokens: ${maxTokens}`);
    
    // Call OpenAI API for real-time feedback generation with GPT-4
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: model,
        messages: [
          { 
            role: 'system', 
            content: feedbackType === 'amazon_pm' 
              ? 'You are an expert Amazon interview coach specializing in Product Management roles. You have extensive knowledge of the STAR method and Amazon Leadership Principles.'
              : 'You are an Amazon interview coach helping candidates improve their interview skills.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.1,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Received response from OpenAI for feedback');
    
    // Send the actual ChatGPT-generated feedback
    res.json(openaiResponse.data);
    
  } catch (error) {
    // Improved error logging
    console.error('Feedback error:', error.message);
    
    // Check for specific OpenAI API errors
    if (error.response && error.response.data) {
      console.error('OpenAI API error details:', JSON.stringify(error.response.data));
      
      // Check for rate limits or quota errors
      if (error.response.status === 429) {
        return res.status(429).json({
          error: 'OpenAI rate limit exceeded. Please try again later.',
          details: error.response.data
        });
      }
      
      // Check for invalid API key
      if (error.response.status === 401) {
        return res.status(500).json({
          error: 'Authentication error with AI provider. Please contact support.',
          details: 'API key may be invalid or expired'
        });
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to generate feedback',
      details: error.message 
    });
  }
});

// Add this route before app.listen()
app.get('/', (req, res) => {
  res.send('Amazon Interview Practice API is running. Use /api/test to verify.');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;