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

## 📊 Overall Score  
**Score:** X/10  
**Question Category:** [Leadership Principle or PM skill being tested]  
**Response Summary:** [2-10 word summary of candidate's performance]  

---

## 🔹 Scoring Guidelines  
Each section should be scored on a **1-10 scale**, where:  
- **9-10** → Outstanding: Exceptional clarity, depth, and impact.  
- **7-8** → Strong: Well-structured with some room for refinement.  
- **5-6** → Adequate: Meets basic expectations but lacks depth or clarity.  
- **3-4** → Weak: Major gaps in explanation, structure, or impact.  
- **1-2** → Poor: Did not address key elements of the question.  

The **Overall Score** is an **average** of the STAR Method, Leadership Principles, and PM Skills scores.  

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

### Did the Answer Fully Address the Question? (Score: X/10)  
- **Was the response directly relevant to the question asked?** [Yes/No]  
- **If not, what was missing or off-topic?** [Brief explanation]  

### Situation & Task (Score: X/10)  
- **Clarity:** [Was the situation well explained? Any missing details?]  
- **Conciseness:** [Was it too long or too short? Any unnecessary details? Specify.]  
- **Role Definition:** [Did they clearly establish their responsibility?]  

### Action (60% of Answer) (Score: X/10)  
- **Detail Level:** [Was the explanation deep enough or too vague?]  
- **Execution Clarity:** [Did they focus on what they did personally vs. the team?]  
- **Focus Balance:** [Did they allocate at least 60% to Action? If not, what was over/underemphasized?]  

### Result (Score: X/10)  
- **Impact Measurement:** [Did they quantify results effectively?]  
- **Depth of Outcome:** [Was the impact significant? Did they highlight long-term effects?]  
- **Business Relevance:** [Did they tie the result back to business goals?]  

---

## 🏆 Leadership Principles Demonstrated  

[List all relevant Leadership Principles demonstrated in the answer]  

- **[Principle 1]** – [Score X/10] – [Brief assessment]  
- **[Principle 2]** – [Score X/10] – [Brief assessment]  
- **[Principle 3]** – [Score X/10] – [Brief assessment]  

🔹 **Leadership Average Score:** X/10  

---

## 🧠 PM-Specific Skills Demonstrated  

[List all relevant PM skills demonstrated]  

- **[Skill 1]** – [Score X/10] – [Brief assessment]  
- **[Skill 2]** – [Score X/10] – [Brief assessment]  
- **[Skill 3]** – [Score X/10] – [Brief assessment]  

🔹 **PM Skills Average Score:** X/10  

---

## 🚀 Improvement Suggestions  

[Only include relevant suggestions—**do not list all categories, only those needing improvement**]  

### Fluency & Clarity  
- **Was the answer clear and structured?** [Yes/No]  
- **Any sections that were hard to follow?** [If so, specify]  

### Time Balance  
- **Was the answer well-balanced across STAR?** [Yes/No]  
- **Did the candidate allocate at least 60% to Action?** [Yes/No]  

### Concise Storytelling  
- **Were there unnecessary details?** [Yes/No]  
- **Where could they trim content?** [Specify]  

### Depth of Impact  
- **Was the result impactful enough?** [Yes/No]  
- **How could they strengthen it?** [Concrete suggestions]  

---

## ⚡ Summary & Key Takeaways  

- **STAR Average Score:** X/10  
- **Leadership Average Score:** X/10  
- **PM Skills Average Score:** X/10  
- **Final Overall Score:** **X/10**  

[Brief summary of strengths and **only 2-3 actionable improvements**]  

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