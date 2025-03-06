require('dotenv').config();

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is not set!');
  process.exit(1);
}

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
app.post('/api/transcribe', upload.single('file'), async (req, res) => {
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
    const { transcription, question } = req.body;
    
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
    
    // Structured prompt for Amazon PM feedback
    const prompt = `As an Amazon interview coach specializing in Product Management roles, evaluate the following candidate's answer to this question:  

**Question:** "${question}"  
**Candidate's Answer:** "${transcription}"  

Use the following structured format for your evaluation:  

## �� Overall Score  
**Final Score:** X/100  
**Question Category:** [Leadership Principle or PM skill being tested]  
**Response Summary:** [2-10 word summary of candidate's performance]  

---

## 🔹 Scoring Guidelines  
Each section should be scored on a **0-100 scale**, following these criteria:  

- **90-100 (Outstanding)** → Exceptional clarity, depth, and impact. The answer is highly structured, directly relevant, well-balanced across STAR, and provides quantified results with strong business relevance. No major improvements needed.  
- **80-89 (Strong)** → Well-structured answer with clear impact, but minor areas for refinement. Might lack some depth in one section, or could be slightly more concise or structured.  
- **70-79 (Good)** → Meets expectations but lacks depth or clarity in key areas. Some STAR sections might be underdeveloped, or the impact might not be well-quantified. Improvement needed in structure or detail.  
- **60-69 (Adequate)** → Answer is understandable but has noticeable gaps in explanation, structure, or impact. Might lack clear ownership, have vague actions, or fail to quantify results effectively.  
- **50-59 (Weak)** → Major issues in clarity, structure, or depth. The answer may be disorganized, missing key details, or fail to provide a meaningful impact. Needs significant improvement.  
- **0-49 (Poor)** → Answer does not address key elements of the question. It may be off-topic, lack any real structure, or fail to show relevant leadership principles or PM skills.  

**Final Overall Score Calculation:**  
The overall score is the **weighted average** of:  
- **STAR Method Score (50%)** – Action section weighted at **60%** of this score.  
- **Leadership Score (25%)**  
- **PM Skills Score (25%)**  

---

## 📌 STAR Method Analysis  

### 📝 Story  

#### Situation & Task  
- **Context:** [Brief description of the situation]  
- **Goal:** [What the candidate needed to achieve]  
- **Challenges:** [Any obstacles they faced]  
- **Candidate's Role:** [What they were responsible for]  

#### Action  
- **Approach Taken:**  
  - [Bullet 1]  
  - [Bullet 2]  
  - [Bullet 3]  
- **Decisions Made:**  
  - [Bullet 1]  
  - [Bullet 2]  

#### Result  
- **Outcome:**  
  - [Bullet 1]  
  - [Bullet 2]  
- **Impact Measurement:**  
  - [Bullet 1] (e.g., revenue increase, engagement boost)  
  - [Bullet 2]  

---

## 📝 Feedback & Rating  

### Did the Answer Fully Address the Question? (Score: X/100)  
**Guidelines for evaluation:**  
- **Was the response directly relevant to the question asked?** [Yes/No]  
- **If not, what was missing or off-topic?** [Brief explanation]  

🔹 **Final Response:** [Only include necessary feedback based on the response]  

### Situation & Task (Score: X/100)  
**Guidelines for evaluation:**  
- **Clarity:** Was the situation well explained, with enough relevant context?  
- **Conciseness:** Was the answer overly detailed or missing key information?  
- **Role Definition:** Did the candidate clearly define their personal role in the story?  

🔹 **Final Response:** [Only include necessary feedback based on the response]  

### Action (60% of Answer) (Score: X/100)  
**Guidelines for evaluation:**  
- **Detail Level:** Did the candidate provide enough detail about what they did?  
- **Execution Clarity:** Did they clearly explain their personal contributions vs. team efforts?  
- **Focus Balance:** Did they allocate at least 60% of their response to Action?  

🔹 **Final Response:** [Only include necessary feedback based on the response]  

### Result (Score: X/100)  
**Guidelines for evaluation:**  
- **Impact Measurement:** Did they quantify results effectively?  
- **Depth of Outcome:** Was the impact significant? Did they highlight long-term effects?  
- **Business Relevance:** Did they tie the result back to business goals?  

🔹 **Final Response:** [Only include necessary feedback based on the response]  

---

## 🏆 Leadership Principles Demonstrated  

**Guidelines for evaluation:**  
- **Identify relevant Leadership Principles the candidate demonstrated.**  

🔹 **Final Response:** **Leadership Score:** X/100  
[List the relevant principles and provide a brief assessment]  

---

## 🧠 PM-Specific Skills Demonstrated  

**Guidelines for evaluation:**  
- **Identify relevant PM skills demonstrated.**  

🔹 **Final Response:** **PM Skills Score:** X/100  
[List the relevant skills and provide a brief assessment]  

---

## 🚀 Improvement Suggestions  

[Only include necessary suggestions—**do not list all categories, only those needing improvement**]  

### Fluency & Clarity  
[Provide feedback if the answer lacked clarity or structure.]  

### Time Balance  
[Provide feedback if the response was not well-balanced across STAR or if Action was not sufficiently emphasized.]  

### Concise Storytelling  
[Provide feedback if unnecessary details were included and where trimming would help.]  

### Depth of Impact  
[Provide feedback if the result was not impactful enough or if more depth was needed.]  

---

## ⚡ Summary & Key Takeaways  

- **STAR Average Score:** X/100  
- **Leadership Score:** X/100  
- **PM Skills Score:** X/100  
- **Final Overall Score:** **X/100**  

🔹 **Final Response:** [Provide a concise summary of strengths and **only 2-3 actionable improvements**.]  

Be **direct, specific, and actionable** in your feedback. Do not be overly positive if the response does not warrant it.`;
    
    // Calculate token estimate for GPT-4 (approximate)
    const inputTokenEstimate = (prompt.length / 4); // Very rough estimate
    
    // Set max tokens based on model and input length
    const model = "gpt-4"; // Using GPT-4 for best feedback quality
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
            content: 'You are an expert Amazon interview coach specializing in Product Management roles. You have extensive knowledge of the STAR method and Amazon Leadership Principles.'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.2,
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