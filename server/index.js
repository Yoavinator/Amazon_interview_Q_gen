require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
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
  origin: [
    'http://localhost:3000',         // For local development
    'https://yoavinator.github.io'   // Your GitHub Pages base domain
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

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
    
    try {
      // Fix: Use axios with FormData properly
      const FormData = require('form-data');
      
      const formData = new FormData();
      formData.append('file', fs.createReadStream(req.file.path));
      formData.append('model', 'whisper-1');

      console.log('Sending request to OpenAI API...');
      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', 
        formData, 
        {
          headers: {
            ...formData.getHeaders(),
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
      console.error('Response data:', apiError.response?.data);
      
      // Fall back to mock response
      return res.json({ text: "Error calling OpenAI API. Using mock response instead." });
    }
  } catch (error) {
    console.error('Transcription error:', error.message);
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
    const { transcription, question } = req.body;
    
    if (!transcription || !question) {
      return res.status(400).json({ error: 'Missing transcription or question' });
    }

    // Check if OpenAI API key is set
    if (!process.env.OPENAI_API_KEY) {
      console.log('OpenAI API key is not set');
      return res.json({
        choices: [{
          message: {
            content: `## Feedback on Your Answer (Mock Response - API Key Not Set)

### How well the candidate answered the question
* Good attempt at addressing the question
* Covered some key points about the topic
* Could use more specific examples

### Structure and clarity
* Clear introduction
* Logical flow of ideas
* Consider improving conclusion

### Specific improvements
* Add more technical details
* Quantify your achievements
* Connect your answer to Amazon's Leadership Principles

### Overall rating: 7/10`
          }
        }]
      });
    }
    
    try {
      const prompt = `
        You are an expert Amazon interviewer. Analyze the following candidate response to this interview question:
        
        Question: ${question}
        
        Candidate's response: ${transcription}
        
        Provide feedback on:
        1. How well the candidate answered the question
        2. Structure and clarity of the response
        3. Specific improvements they could make
        4. Overall rating (1-10)
        
        Format your response in clear sections with bullet points where appropriate.
      `;

      console.log('Sending request to OpenAI API...');
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: 'You are an expert Amazon interviewer providing feedback on candidate responses.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          }
        }
      );
      console.log('Received response from OpenAI API');

      res.json(response.data);
    } catch (apiError) {
      console.error('OpenAI API error:', apiError.message);
      console.error('Response data:', apiError.response?.data);
      
      // Fall back to mock response
      return res.json({
        choices: [{
          message: {
            content: `## Feedback on Your Answer (Mock Response - API Error)

### How well the candidate answered the question
* Good attempt at addressing the question
* Covered some key points about the topic
* Could use more specific examples

### Structure and clarity
* Clear introduction
* Logical flow of ideas
* Consider improving conclusion

### Specific improvements
* Add more technical details
* Quantify your achievements
* Connect your answer to Amazon's Leadership Principles

### Overall rating: 7/10`
          }
        }]
      });
    }
  } catch (error) {
    console.error('Feedback error:', error.message);
    res.status(500).json({ 
      error: 'Failed to get feedback',
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