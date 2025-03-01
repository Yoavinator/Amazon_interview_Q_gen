/* eslint-disable no-unused-vars */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import amazonJobsLogo from '../amazon-jobs-logo.png'; // Import the logo
import './RandomQuestionGenerator.css';
import InterviewRecorder from './InterviewRecorder';

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
  
  // Add recording state variables
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcription, setTranscription] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  
  // Add refs for recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  
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
  const generateRandomQuestion = useCallback((questionData = questions, category = selectedCategory, keyPointsData = keyPoints) => {
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
  }, [questions, selectedCategory, keyPoints, isSpeaking]);

  // Handle category change
  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setSelectedCategory(newCategory);
    generateRandomQuestion(questions, newCategory, keyPoints);
  };

  // Handle reveal category button click
  const handleRevealCategory = () => {
    setShowCategory(true);
    setCurrentKeyPoints(keyPoints[currentCategory]);
  };

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
          
          // Find the category of the selected question
          for (const [category, questions] of Object.entries(questionsByCategory)) {
            if (questions.includes(allQuestions[randomIndex])) {
              setCurrentCategory(category);
              break;
            }
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchData();
  }, [apiUrl, sheet2Url]);

  // Speech synthesis function
  const speakQuestion = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!currentQuestion) return;

    setIsSpeaking(true);

    // Split the question into sentences for more natural pauses
    const sentences = currentQuestion.split(/(?<=[.!?])\s+/);
    
    let utteranceIndex = 0;
    
    const speakNextSentence = () => {
      if (utteranceIndex < sentences.length) {
        const utterance = new SpeechSynthesisUtterance(sentences[utteranceIndex]);
        
        // Set voice (try to use a natural sounding voice if available)
        const voices = window.speechSynthesis.getVoices();
        const preferredVoices = voices.filter(voice => 
          voice.name.includes('Samantha') || 
          voice.name.includes('Google US English') || 
          voice.name.includes('Microsoft Zira')
        );
        
        if (preferredVoices.length > 0) {
          utterance.voice = preferredVoices[0];
        }
        
        utterance.rate = 0.9; // Slightly slower rate for better comprehension
        utterance.pitch = 1.0;
        
        utterance.onend = () => {
          utteranceIndex++;
          
          // Add a small pause between sentences
          setTimeout(speakNextSentence, 300);
        };
        
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
      }
    };
    
    // Initialize voices if needed (for some browsers)
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speakNextSentence();
      };
    } else {
      speakNextSentence();
    }
  };

  // Recording functions
  const startRecording = async () => {
    audioChunksRef.current = [];
    setIsRecording(true);
    setAudioUrl('');
    setTranscription('');
    setFeedback('');
    setRecordingTime(0);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(audioUrl);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
        
        // Simulate transcription
        setTimeout(() => {
          setTranscription('This is a simulated transcription of your answer. In a real implementation, this would be processed through a speech-to-text service like OpenAI\'s Whisper API.');
        }, 1500);
      };
      
      mediaRecorderRef.current.start();
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  const generateAIFeedback = () => {
    setIsGeneratingFeedback(true);
    
    // Simulate AI feedback generation
    setTimeout(() => {
      setFeedback('This is where AI feedback on your answer would appear.');
      setIsGeneratingFeedback(false);
    }, 2000);
  };

  // Standardized font sizes
  const fontStyles = {
    headline: {
      fontSize: '2.5rem',
      fontWeight: 'light',
      color: '#FF9900',
      fontFamily: 'Amazon Ember, Arial, sans-serif'
    },
    subheading: {
      fontSize: '1.2rem',
      fontWeight: '500',
      color: 'white'
    },
    bodyText: {
      fontSize: '1rem',
      fontWeight: 'normal',
      color: 'white'
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#232f3e' }}>
        <div className="text-white text-xl">
          Loading questions...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: '#232f3e' }}>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen w-full" style={{ backgroundColor: '#232f3e' }}>
      <div className="w-[800px] py-4 px-4">
        <div className="text-center">
          {/* Amazon Jobs logo */}
          <img 
            src={amazonJobsLogo} 
            alt="Amazon Jobs"
            className="h-12 mb-8 mx-auto"
          />
          
          {/* Main header - headline font */}
          <h1 style={fontStyles.headline} className="mb-6">
            Amazon Interview Practice
          </h1>
          
          {/* Instructions - body text font */}
          <p style={fontStyles.bodyText} className="mb-6">
            Practice your interview skills with questions from various categories.
          </p>

          <p style={fontStyles.bodyText} className="mb-4">
            Select a category or try questions from all categories.
          </p>
          
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className="w-64 p-2 mb-8 rounded text-gray-800"
            style={{ fontSize: fontStyles.bodyText.fontSize }}
          >
            <option value="all">All Categories</option>
            {categories.map((category, index) => (
              <option key={index} value={category}>{category}</option>
            ))}
          </select>

          <div className="content">
            <div className="question-box">
              <div className="question-box-inner">
                <div className="flex justify-between items-center">
                  {/* Question text - subheading font */}
                  <p style={{ 
                    color: '#16191f', 
                    fontSize: fontStyles.subheading.fontSize,
                    fontWeight: fontStyles.subheading.fontWeight
                  }} className="text-center">
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M15 9l-6 6M9 9l6 6"/>
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons - body text font */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', margin: '20px 0' }}>
            <button 
              onClick={() => generateRandomQuestion()}
              style={{
                backgroundColor: '#FF9900',
                color: '#232F3E',
                border: 'none',
                borderRadius: '4px',
                padding: '12px 24px',
                fontSize: fontStyles.bodyText.fontSize,
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}
            >
              Get Another Question
            </button>
            
            {selectedCategory === 'all' && (
              <button 
                onClick={() => setShowCategory(!showCategory)}
                style={{
                  backgroundColor: '#FF9900',
                  color: '#232F3E',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '12px 24px',
                  fontSize: fontStyles.bodyText.fontSize,
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                {showCategory ? 'Hide Category' : 'Reveal Category'}
              </button>
            )}
          </div>

          {/* Category box - subheading font */}
          {selectedCategory === 'all' && showCategory && (
            <div style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              width: '100%',
              maxWidth: '600px',
              margin: '20px auto',
              textAlign: 'center'
            }}>
              <h3 style={{ 
                color: '#232F3E', 
                fontWeight: fontStyles.subheading.fontWeight,
                fontSize: fontStyles.subheading.fontSize,
                margin: '0'
              }}>
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
      
      {/* InterviewRecorder component */}
      {currentQuestion && <InterviewRecorder removePracticeHeader={true} />}
    </div>
  );
};

export default RandomQuestionGenerator;