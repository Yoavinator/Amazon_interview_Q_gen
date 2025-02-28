import React, { useState, useEffect } from 'react';
import amazonJobsLogo from './amazon-jobs-logo.png'; // You'll need to add this image to your src folder

const RandomQuestionGenerator = () => {
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState('all');
  const [columnNames, setColumnNames] = useState([]);
  const [showCategory, setShowCategory] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('');
  const [keyPoints, setKeyPoints] = useState({});
  const [currentKeyPoints, setCurrentKeyPoints] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sheetId = '1O2sJ3uJpNK9t44KPElZWPi_OJ16ArWKbpq2DHJQ8OdE';
  const range = 'Sheet1';
  const apiKey = process.env.REACT_APP_GOOGLE_SHEETS_API_KEY;

  const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
  const sheet2Url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet2?key=${apiKey}`;

  // Update the key points processing in useEffect
  const processKeyPoints = (values, header, index) => {
    const columnData = values.slice(1).map(row => row[index]).filter(Boolean);
    const keyPoints = columnData.slice(0, 3); // First 3 rows are key points
    const example = columnData[3]; // Fourth row is the example
    
    return {
      points: keyPoints,
      example: example
    };
  };

  useEffect(() => {
    // Function to fetch questions and key points
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

        // Process Sheet1 (questions) as before
        const headers = questionsData.values[0];
        setColumnNames(headers);

        const questionsByColumn = {};
        headers.forEach((header, index) => {
          questionsByColumn[header] = questionsData.values.slice(1).map(row => row[index]).filter(Boolean);
        });
        setQuestions(questionsByColumn);

        // Process Sheet2 (key points)
        const keyPointsByColumn = {};
        const keyPointsHeaders = keyPointsData.values[0];
        keyPointsHeaders.forEach((header, index) => {
          keyPointsByColumn[header] = processKeyPoints(keyPointsData.values, header, index);
        });
        setKeyPoints(keyPointsByColumn);

        // Select initial random question
        const allQuestions = Object.values(questionsByColumn).flat();
        if (allQuestions.length > 0) {
          const randomIndex = Math.floor(Math.random() * allQuestions.length);
          setCurrentQuestion(allQuestions[randomIndex]);
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

  // Function to get a new random question
  const getRandomQuestion = () => {
    if (!questions || Object.keys(questions).length === 0) return;
    
    let questionPool;
    let selectedCategory;
    
    if (selectedColumn === 'all') {
      const allColumns = Object.keys(questions);
      const randomColumn = allColumns[Math.floor(Math.random() * allColumns.length)];
      questionPool = questions[randomColumn];
      selectedCategory = randomColumn;
    } else {
      questionPool = questions[selectedColumn];
      selectedCategory = selectedColumn;
    }
    
    if (questionPool && questionPool.length > 0) {
      const randomIndex = Math.floor(Math.random() * questionPool.length);
      setCurrentQuestion(questionPool[randomIndex]);
      setCurrentCategory(selectedCategory);
      setShowCategory(false);
      setCurrentKeyPoints(''); // Reset key points when new question is generated
    }
  };

  const handleRevealCategory = () => {
    setShowCategory(true);
    setCurrentKeyPoints(keyPoints[currentCategory] || '');
  };

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
    speech.pitch = 0.95;     // Slightly lower pitch for more natural sound
    speech.volume = 1;       // Full volume
    
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading questions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full" style={{ backgroundColor: '#232f3e' }}>
      <div className="w-[800px] py-8 px-4">
        <div className="text-center">
          <img 
            src={amazonJobsLogo} 
            alt="Amazon Jobs"
            className="h-8 mb-8 mx-auto"
          />

          <h1 style={{ color: 'white' }} className="text-5xl font-light mb-6">
            Interview Question Generator
          </h1>
          <p style={{ color: 'white' }} className="text-xl font-light mb-12">
            Practice your interview skills with questions from various categories.
          </p>

          <p style={{ color: 'white' }} className="mb-8">
            Select a category or try questions from all categories.
          </p>
          
          <select
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
            className="w-64 p-2 mb-8 rounded text-gray-800"
          >
            <option value="all">All Categories</option>
            {columnNames.map((name, index) => (
              <option key={index} value={name}>{name}</option>
            ))}
          </select>

          <div className="content">
            <div className="question-box">
              <div className="question-box-inner">
                <div className="flex justify-between items-center">
                  <p style={{ color: '#16191f' }} className="text-xl text-center">
                    {currentQuestion}
                  </p>
                  <button 
                    onClick={speakQuestion}
                    className="ml-4 text-gray-600 hover:text-gray-800"
                    aria-label={isSpeaking ? "Stop speaking" : "Read question aloud"}
                    style={{ minWidth: '24px' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {isSpeaking ? (
                        // Stop icon when speaking
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M15 9l-6 6M9 9l6 6"/>
                      ) : (
                        // Speaker icon when not speaking
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="button-container flex justify-center gap-4">
            <button 
              onClick={getRandomQuestion}
              className="bg-white text-[#232f3e] px-6 py-2 rounded hover:bg-gray-100"
            >
              Get Another Question
            </button>
            {selectedColumn === 'all' && (
              <button 
                onClick={handleRevealCategory}
                className="bg-white text-[#232f3e] px-6 py-2 rounded hover:bg-gray-100"
              >
                Reveal Category
              </button>
            )}
          </div>

          {selectedColumn === 'all' && showCategory && (
            <div className="category-title">
              <h3 style={{ color: 'white' }} className="text-2xl font-light">
                {currentCategory}
              </h3>
            </div>
          )}

          {currentKeyPoints && keyPoints[currentCategory] && (
            <div className="key-points-section">
              <h3 style={{ color: 'white' }} className="text-2xl font-light mb-8">
                Key Points to Consider
              </h3>
              <ul className="space-y-4 mb-8">
                {keyPoints[currentCategory].points.map((point, index) => (
                  <li key={index} className="flex justify-center items-start">
                    <span style={{ color: 'white' }} className="mr-2">•</span>
                    <span style={{ color: 'white' }}>{point}</span>
                  </li>
                ))}
              </ul>

              {keyPoints[currentCategory].example && (
                <div className="mt-8 pt-8 border-t border-gray-400">
                  <h4 style={{ color: 'white' }} className="text-xl font-light mb-4">
                    <span className="mr-2">•</span>
                    Example
                  </h4>
                  <p style={{ color: 'white' }}>{keyPoints[currentCategory].example}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RandomQuestionGenerator;