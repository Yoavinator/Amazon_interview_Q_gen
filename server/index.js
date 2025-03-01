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
    
    // Prepare prompt for ChatGPT - enhanced for Amazon PM interviews
    let prompt;
    
    if (feedbackType === 'amazon_pm') {
      prompt = `As an Amazon interview coach specializing in Product Management roles, evaluate the following candidate's answer to this question: "${question}".
      
      Candidate's answer: "${transcription}"
      
      Provide detailed feedback using these frameworks:
      
      1. STAR Method Analysis:
         - Situation: Did the candidate clearly establish the context?
         - Task: Was their role/responsibility clearly articulated?
         - Action: Did they explain their specific actions with enough detail?
         - Result: Did they quantify the impact and outcomes?
      
      2. Amazon Leadership Principles Assessment:
         Evaluate how well the answer demonstrated relevant Amazon Leadership Principles, such as:
         - Customer Obsession
         - Ownership
         - Invent and Simplify
         - Are Right, A Lot
         - Learn and Be Curious
         - Hire and Develop the Best
         - Insist on the Highest Standards
         - Think Big
         - Bias for Action
         - Frugality
         - Earn Trust
         - Dive Deep
         - Have Backbone; Disagree and Commit
         - Deliver Results
      
      3. PM-Specific Skills:
         - Product sense
         - Strategic thinking
         - Data-driven decision making
         - Cross-functional collaboration
      
      4. Improvement Suggestions:
         Provide 3-4 specific ways the candidate could strengthen their answer.
      
      5. Overall Rating:
         Score the answer out of 10 and provide a brief summary.
      
      Format your response with markdown.`;
    } else {
      // Standard prompt for other interview types
      prompt = `As an Amazon interview coach, evaluate the following candidate's answer to this question: "${question}".
      
      Candidate's answer: "${transcription}"
      
      Provide feedback in these areas:
      1. How well the candidate answered the question
      2. Structure and clarity
      3. Specific improvements
      4. Overall rating out of 10
      
      Format your response with markdown.`;
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
        temperature: 0.7,
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