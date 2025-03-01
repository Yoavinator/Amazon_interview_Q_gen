import React, { useState, useEffect, useCallback } from 'react';
import InterviewRecorder from './InterviewRecorder';
import './RandomQuestionGenerator.css';

const RandomQuestionGenerator = () => {
  const [questions, setQuestions] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  const [showCategory, setShowCategory] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('');
  const [keyPoints, setKeyPoints] = useState({});
  const [currentKeyPoints, setCurrentKeyPoints] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Google Sheets configuration - using environment variable
  const sheetId = '1O2sJ3uJpNK9t44KPElZWPi_OJ16ArWKbpq2DHJQ8OdE';
  const range = 'Sheet1';
  const apiKey = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;

  const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
  const sheet2Url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet2?key=${apiKey}`;

  // Process key points from Sheet2
  const processKeyPoints = (values, header, index) => {
    const columnData = values.slice(1).map(row => row[index]).filter(Boolean);
    const keyPoints = columnData.slice(0, 3); // First 3 rows are key points
    const example = columnData[3]; // Fourth row is the example
    
    return {
      points: keyPoints,
      example: example
    };
  };

  // Generate a random question based on selected category
  const generateRandomQuestion = useCallback((questionData = questions, category = selectedCategory) => {
    if (!questionData || Object.keys(questionData).length === 0) return;
    
    let questionPool;
    let selectedCat;
    
    if (category === 'all') {
      const allCategories = Object.keys(questionData);
      const randomCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
      questionPool = questionData[randomCategory];
      selectedCat = randomCategory;
    } else {
      questionPool = questionData[category];
      selectedCat = category;
    }
    
    if (questionPool && questionPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * questionPool.length);
      setCurrentQuestion(questionPool[randomIndex]);
      setCurrentCategory(selectedCat);
      setShowCategory(false);
      setCurrentKeyPoints(null);
      
      // Stop speaking if a new question is generated
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
    }
  }, [questions, selectedCategory, isSpeaking]);

  // Fetch data from Google Sheets
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch both sheets in parallel
        const [questionsResponse, keyPointsResponse] = await Promise.all([
          fetch(apiUrl),
          fetch(sheet2Url)
        ]);

        if (!questionsResponse.ok || !keyPointsResponse.ok) {
          throw new Error('Failed to fetch data from Google Sheets');
        }

        const [questionsData, keyPointsData] = await Promise.all([
          questionsResponse.json(),
          keyPointsResponse.json()
        ]);

        if (!questionsData.values || !keyPointsData.values) {
          throw new Error('No data found in the Google Sheets');
        }

        // Process Sheet1 (questions)
        const headers = questionsData.values[0];
        setCategories(headers);

        const questionsByCategory = {};
        headers.forEach((header, index) => {
          questionsByCategory[header] = questionsData.values.slice(1)
            .map(row => row[index])
            .filter(Boolean);
        });
        setQuestions(questionsByCategory);

        // Process Sheet2 (key points)
        const keyPointsByCategory = {};
        const keyPointsHeaders = keyPointsData.values[0];
        keyPointsHeaders.forEach((header, index) => {
          keyPointsByCategory[header] = processKeyPoints(keyPointsData.values, header, index);
        });
        setKeyPoints(keyPointsByCategory);

        // Generate initial random question
        const allQuestions = Object.values(questionsByCategory).flat();
        if (allQuestions.length > 0) {
          const randomIndex = Math.floor(Math.random() * allQuestions.length);
          setCurrentQuestion(allQuestions[randomIndex]);
          
          // Find which category this question belongs to
          for (const [category, categoryQuestions] of Object.entries(questionsByCategory)) {
            if (categoryQuestions.includes(allQuestions[randomIndex])) {
              setCurrentCategory(category);
              break;
            }
          }
        }
      } catch (err) {
        setError('Failed to load data. Please check your Google Sheet connection.');
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [apiUrl, sheet2Url]);

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  const handleRevealCategory = () => {
    setShowCategory(true);
    setCurrentKeyPoints(keyPoints[currentCategory]);
  };

  // Speech synthesis function from the working version
  const speakQuestion = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const voices = window.speechSynthesis.getVoices();
    
    // Try to find the highest quality voice available
    const preferredVoice = voices.find(voice => 
      (voice.name.includes('Enhanced') || // Enhanced quality voices
       voice.name.includes('Microsoft David') ||
       voice.name.includes('Google UK English Male') ||
       voice.name.includes('Premium') ||
       voice.name.includes('en-GB'))
    );

    const speech = new SpeechSynthesisUtterance(currentQuestion);
    
    // Enhanced voice settings
    speech.voice = preferredVoice;
    speech.lang = 'en-GB';
    speech.rate = 1.2;      // Slightly slower for clarity
    speech.pitch = 0.95;    // Slightly lower pitch for more natural sound
    speech.volume = 1;      // Full volume
    
    // Add emphasis and pauses
    const processedText = currentQuestion
      .replace(/\?/g, '... ?')  // Add slight pause before questions
      .replace(/,/g, ', ')      // Add brief pause at commas
      .replace(/\./g, '... ')   // Add pause at periods
      .replace(/!/g, '... !');  // Add pause before exclamations

    speech.text = processedText;

    // Add prosody for more natural speech rhythm
    speech.onboundary = (event) => {
      if (event.name === 'word') {
        // Natural word boundaries
        if (event.charIndex > 0) {
          const char = speech.text[event.charIndex - 1];
          if (char === '.' || char === '?' || char === '!') {
            window.speechSynthesis.pause();
            setTimeout(() => window.speechSynthesis.resume(), 250);
          }
        }
      }
    };

    // Event handlers
    speech.onstart = () => setIsSpeaking(true);
    speech.onend = () => setIsSpeaking(false);
    speech.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(speech);
  };

  // Add this to ensure voices are loaded
  useEffect(() => {
    window.speechSynthesis.getVoices();
  }, []);

  if (isLoading) {
    return (
      <div className="question-generator loading">
        <div className="spinner"></div>
        <p>Loading questions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="question-generator error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="question-generator">
      <h2>Interview Question Generator</h2>
      
      <div className="category-selector">
        <label htmlFor="category-select">Select a category:</label>
        <select 
          id="category-select"
          value={selectedCategory}
          onChange={handleCategoryChange}
        >
          <option value="all">All Categories</option>
          {categories.map((category, index) => (
            <option key={index} value={category}>{category}</option>
          ))}
        </select>
      </div>
      
      <div className="question-container">
        {currentQuestion && (
          <div className="question-box">
            <div className="question-header">
              <h3>Your Question</h3>
              <div className="question-actions">
                <button 
                  className="speak-btn" 
                  onClick={speakQuestion}
                  aria-label={isSpeaking ? "Stop speaking" : "Read question aloud"}
                >
                  {isSpeaking ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
                      <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/>
                      <path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8 3.49 3.49 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
            
            <p>{currentQuestion}</p>
            
            {showCategory && (
              <div className="category-info">
                <h4>Category: {currentCategory}</h4>
                
                {currentKeyPoints && (
                  <div className="key-points">
                    <h4>Key Points:</h4>
                    <ul>
                      {currentKeyPoints.points.map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                    
                    {currentKeyPoints.example && (
                      <div className="example">
                        <h4>Example:</h4>
                        <p>{currentKeyPoints.example}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="question-controls">
          <button 
            className="generate-btn"
            onClick={() => generateRandomQuestion()}
          >
            Generate Random Question
          </button>
          
          {selectedCategory === 'all' && currentQuestion && !showCategory && (
            <button 
              className="reveal-btn"
              onClick={handleRevealCategory}
            >
              Reveal Category
            </button>
          )}
        </div>
      </div>
      
      {currentQuestion && <InterviewRecorder />}
    </div>
  );
};

export default RandomQuestionGenerator;