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

// IMPORTANT: Configure CORS before defining any routes
// This ensures CORS headers are applied to all responses
app.use(cors({
  origin: '*', // Allow all origins for testing
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON bodies
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads');
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Simple test endpoint to verify server is working
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// Endpoint for transcription
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  console.log('Transcribe request received');
  try {
    if (!req.file) {
      console.log('No file received');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('File received:', req.file.path);
    
    // For testing, let's return a mock response
    return res.json({ text: "This is a test transcription. The OpenAI API call is bypassed for testing." });
    
    /* Uncomment this when ready to use the actual OpenAI API
    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path));
    formData.append('model', 'whisper-1');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        }
      }
    );

    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    res.json(response.data);
    */
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

    // For testing, return a mock response
    return res.json({
      choices: [{
        message: {
          content: `## Feedback on Your Answer

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

    /* Uncomment this when ready to use the actual OpenAI API
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

    res.json(response.data);
    */
  } catch (error) {
    console.error('Feedback error:', error.message);
    res.status(500).json({ 
      error: 'Failed to get feedback',
      details: error.message
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Test the server: http://localhost:${port}/api/test`);
}); 