import React, { useState, useRef, useEffect } from 'react';
import './InterviewRecorder.css';

const InterviewRecorder = ({ removePracticeHeader = false }) => {
  // State for recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  
  // State for transcription and feedback
  const [transcription, setTranscription] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  
  // State for error handling
  const [error, setError] = useState('');
  const [networkStatus, setNetworkStatus] = useState('');

  // Refs
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      // Reset states
      setError('');
      setAudioUrl(null);
      setTranscription('');
      setFeedback('');
      chunksRef.current = [];
      
      console.log("Starting recording...");
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Set up recording timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // Handle data available event
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      // Handle recording stop
      mediaRecorder.onstop = async () => {
        console.log("Recording stopped, processing audio...");
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Create audio blob and URL
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Log blob size
        console.log(`Audio blob created: ${(audioBlob.size / 1024).toFixed(2)} KB`);
        
        // Send for transcription
        await transcribeAudio(audioBlob);
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      console.log("Recording started!");
      
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(`Failed to start recording: ${err.message}`);
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const stopRecording = () => {
    console.log("Stopping recording...");
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Real API call for transcription
  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true);
    setNetworkStatus('Sending audio to server...');
    console.log("Sending audio to transcription API...");
    
    try {
      // Create form data
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      
      console.log("Making request to server:", 'https://amazon-interview-q-gen.onrender.com/api/transcribe');
      
      // Make API request
      const response = await fetch('https://amazon-interview-q-gen.onrender.com/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      console.log("Received response:", response.status, response.statusText);
      setNetworkStatus(`Server responded with status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Transcription data:", data);
      
      setTranscription(data.text || "No transcription received from server");
      
    } catch (err) {
      console.error("Transcription error:", err);
      setError(`Transcription failed: ${err.message}`);
      setTranscription("Failed to transcribe audio. Please try again.");
    } finally {
      setIsTranscribing(false);
      setNetworkStatus('');
    }
  };

  // Real API call for feedback with improved prompt
  const generateAIFeedback = async () => {
    if (!transcription) {
      setError("Cannot generate feedback without a transcription");
      return;
    }
    
    setIsGeneratingFeedback(true);
    setNetworkStatus('Requesting feedback from server...');
    console.log("Requesting AI feedback...");
    
    try {
      // Get the current question from the DOM
      const question = document.querySelector('.question-box-inner p')?.textContent || 'Unknown question';
      
      console.log("Making request to feedback API with question:", question);
      console.log("Transcription:", transcription.substring(0, 100) + "...");
      
      // Make API request for real feedback with STAR and Leadership Principles focus
      const response = await fetch('https://amazon-interview-q-gen.onrender.com/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription,
          question,
          feedbackType: 'amazon_pm',  // Signal to server this is for Amazon PM role
        }),
      });
      
      console.log("Received response:", response.status, response.statusText);
      setNetworkStatus(`Server responded with status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Feedback data received:", Object.keys(data));
      
      // Extract feedback content from response
      const feedbackContent = data.choices?.[0]?.message?.content || 
                             data.feedback || 
                             "No feedback content received from server";
      
      setFeedback(feedbackContent);
      
    } catch (err) {
      console.error("Feedback error:", err);
      setError(`Failed to get AI feedback: ${err.message}`);
      setFeedback("Could not generate feedback at this time. Please try again later.");
    } finally {
      setIsGeneratingFeedback(false);
      setNetworkStatus('');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Styles for fonts
  const fontStyles = {
    subheading: {
      fontSize: '1.2rem',
      fontWeight: '500',
      color: '#FF9900',
      fontFamily: 'Amazon Ember, Arial, sans-serif'
    },
    bodyText: {
      fontSize: '1rem',
      fontWeight: 'normal',
      color: 'white'
    }
  };

  return (
    <div className="interview-recorder" id="single-interview-recorder">
      {!removePracticeHeader && (
        <h2 style={fontStyles.subheading}>Record Your Answer</h2>
      )}
      
      {/* Display any errors */}
      {error && (
        <div className="error-message" style={{ color: 'red', marginBottom: '15px' }}>
          {error}
        </div>
      )}
      
      {/* Display network status */}
      {networkStatus && (
        <div className="network-status" style={{ color: '#FF9900', marginBottom: '10px' }}>
          {networkStatus}
        </div>
      )}
      
      <div className="recording-section">
        <h3 style={fontStyles.subheading}>Record Your Answer</h3>
        
        <div className="recording-container">
          {isRecording && (
            <div className="sound-wave">
              <div className="visualizer">
                {Array(20).fill().map((_, i) => (
                  <div 
                    key={i} 
                    className="bar" 
                    style={{ 
                      height: `${20 + Math.random() * 30}px`,
                      animationDelay: `${i * 0.05}s`
                    }} 
                  />
                ))}
              </div>
              <div className="timer" style={fontStyles.bodyText}>
                {formatTime(recordingTime)}
              </div>
            </div>
          )}
          
          <div className="recording-controls">
            <button 
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              onClick={startRecording}
              disabled={isRecording}
              style={fontStyles.bodyText}
            >
              {isRecording ? 'Recording...' : 'Start Recording'}
            </button>
            
            <button 
              className="stop-btn"
              onClick={stopRecording}
              disabled={!isRecording}
              style={fontStyles.bodyText}
            >
              Stop Recording
            </button>
          </div>
          
          <p className="recording-instructions" style={fontStyles.bodyText}>
            Click "Start Recording" and answer the question as if you were in an Amazon interview
          </p>
        </div>
        
        {audioUrl && (
          <div className="audio-playback">
            <h4>Review Your Answer</h4>
            <audio controls src={audioUrl} style={{ width: '100%', marginTop: '10px' }}></audio>
          </div>
        )}
        
        {isTranscribing ? (
          <div className="loading">
            <p>Transcribing your answer...</p>
            <div className="loader"></div>
          </div>
        ) : transcription && (
          <div className="transcription">
            <h4>Transcription</h4>
            <p>{transcription}</p>
            <button 
              onClick={generateAIFeedback}
              disabled={isGeneratingFeedback}
              className="feedback-btn"
            >
              {isGeneratingFeedback ? 'Generating Feedback...' : 'Get AI Feedback'}
            </button>
          </div>
        )}
        
        {feedback && (
          <div className="ai-feedback">
            <h4>AI Feedback</h4>
            <div dangerouslySetInnerHTML={{ __html: feedback.replace(/\n/g, '<br>') }}></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewRecorder;