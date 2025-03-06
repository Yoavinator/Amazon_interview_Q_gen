import React, { useState, useRef, useEffect } from 'react';
import './InterviewRecorder.css';
import ReactMarkdown from 'react-markdown';

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
  const audioRef = useRef(null);
  const [audioProgress, setAudioProgress] = useState({ current: '0:00', duration: '0:00' });

  // New state variable for transcription status
  const [transcriptionStatus, setTranscriptionStatus] = useState('');

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Enhanced startRecording function with mobile fixes
  const startRecording = async () => {
    try {
      // First, clear any previous state
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Check if we're on mobile Chrome
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isChrome = /Chrome/i.test(navigator.userAgent) && !/Edg/i.test(navigator.userAgent);
      const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
      
      console.log(`Device detection: Mobile: ${isMobile}, Chrome: ${isChrome}, Safari: ${isSafari}`);
      
      // Different audio constraints for mobile Chrome
      let audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      
      // Some older versions of Chrome mobile need simpler constraints
      if (isMobile && isChrome) {
        console.log("Using simplified audio constraints for mobile Chrome");
        audioConstraints = true; // Just use simple constraints for mobile Chrome
      }
      
      // Request microphone access with appropriate constraints
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;
      
      // Log audio tracks to help with debugging
      const audioTracks = stream.getAudioTracks();
      console.log(`Got ${audioTracks.length} audio tracks`);
      audioTracks.forEach((track, i) => {
        console.log(`Track ${i}: ${track.label}, enabled: ${track.enabled}`);
      });
      
      // Try different MIME types for better mobile compatibility
      let options = {};
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        ''  // empty string means browser default
      ];
      
      // Find the first supported MIME type
      for (let type of mimeTypes) {
        if (!type || MediaRecorder.isTypeSupported(type)) {
          options = type ? { mimeType: type } : {};
          console.log(`Using MIME type: ${type || 'browser default'}`);
          break;
        }
      }
      
      try {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        console.log(`MediaRecorder initialized with state: ${mediaRecorderRef.current.state}`);
      } catch (e) {
        console.error('MediaRecorder initialization failed:', e);
        // Absolute fallback - no options
        mediaRecorderRef.current = new MediaRecorder(stream);
        console.log('Fallback MediaRecorder initialized');
      }
      
      // Add more detailed event listeners for debugging
      mediaRecorderRef.current.addEventListener('start', () => {
        console.log('MediaRecorder started');
      });
      
      mediaRecorderRef.current.addEventListener('pause', () => {
        console.log('MediaRecorder paused');
      });
      
      mediaRecorderRef.current.addEventListener('resume', () => {
        console.log('MediaRecorder resumed');
      });
      
      mediaRecorderRef.current.addEventListener('stop', () => {
        console.log('MediaRecorder stopped');
      });
      
      mediaRecorderRef.current.addEventListener('dataavailable', (e) => {
        console.log(`Data available: ${e.data.size} bytes`);
        handleDataAvailable(e);
      });
      
      mediaRecorderRef.current.addEventListener('error', (e) => {
        console.error('MediaRecorder error:', e);
        setError(`Recording error: ${e.message || 'Unknown error'}`);
        stopRecording();
      });
      
      // Clear chunks before starting
      chunksRef.current = [];
      
      // Start recording with smaller chunks for better handling
      mediaRecorderRef.current.start(1000); // Get data every second for more frequent updates
      setIsRecording(true);
      
      // Start timer
      startTimer();
      
      setError(''); // Clear any previous errors
      
    } catch (err) {
      console.error('Error accessing microphone:', err);
      
      // Check if this is an HTTPS issue
      if (window.location.protocol !== 'https:') {
        setError('Microphone access requires HTTPS. Please use a secure connection.');
        return;
      }
      
      // More detailed error messages
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please check your browser settings and permissions. For Chrome mobile, go to Settings > Site Settings > Microphone.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please check that your device has a working microphone.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Could not start audio recording. Try closing other apps that might be using the microphone, or reload the page.');
      } else if (err.name === 'OverconstrainedError') {
        setError('Audio constraints issue. Trying again with simpler settings might help.');
      } else if (err.name === 'TypeError' && err.message.includes('getUserMedia')) {
        setError('Your browser may not support audio recording. Please try using Chrome or Firefox on desktop.');
      } else {
        setError(`Microphone error (${err.name}): ${err.message}`);
      }
    }
  };

  // Enhanced stop recording function
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      console.log(`Stopping MediaRecorder with state: ${mediaRecorderRef.current.state}`);
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('Error stopping MediaRecorder:', e);
      }
    }
    
    // Always stop all tracks in the stream
    if (streamRef.current) {
      console.log('Stopping all audio tracks');
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.error('Error stopping audio track:', e);
        }
      });
      streamRef.current = null;
    }
    
    setIsRecording(false);
    
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Enhanced data available handler
  const handleDataAvailable = (e) => {
    if (e.data && e.data.size > 0) {
      console.log(`Adding chunk of size ${e.data.size} bytes`);
      chunksRef.current.push(e.data);
    } else {
      console.warn('Received empty data chunk');
    }
    
    // When recording has stopped and we have data, create the audio file
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive' && chunksRef.current.length > 0) {
      const totalSize = chunksRef.current.reduce((total, chunk) => total + chunk.size, 0);
      console.log(`Creating blob from ${chunksRef.current.length} chunks, total size: ${totalSize} bytes`);
      
      try {
        // Try to determine the best blob type
        let blobType = 'audio/webm';
        if (mediaRecorderRef.current.mimeType) {
          blobType = mediaRecorderRef.current.mimeType;
        }
        
        // Combine all chunks into a single blob
        const blob = new Blob(chunksRef.current, { type: blobType });
        console.log(`Created blob of type ${blobType}, size: ${blob.size} bytes`);
        
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        // Immediately start transcribing
        transcribeAudio(blob);
      } catch (error) {
        console.error('Error creating audio blob:', error);
        setError(`Failed to process recording: ${error.message}`);
      }
    }
  };

  // Add a timer function if it's not already there
  const startTimer = () => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Reset recording time
    setRecordingTime(0);
    
    // Start the timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const elapsedTime = Math.floor((Date.now() - startTime) / 1000);
      setRecordingTime(elapsedTime);
      
      // Auto-stop at 5 minutes (300 seconds)
      if (elapsedTime >= 300) {
        setError('Maximum recording time of 5 minutes reached');
        stopRecording();
      }
    }, 1000);
  };

  // Add a function to check if we're approaching the limit
  const getTimerColor = () => {
    if (recordingTime >= 270) { // Last 30 seconds
      return '#ff4444'; // Red
    } else if (recordingTime >= 240) { // Last minute
      return '#ffbb33'; // Yellow
    }
    return '#FF9900'; // Default Amazon orange
  };

  const getTimeRemaining = () => {
    const remaining = 300 - recordingTime; // 5 minutes in seconds
    return formatTime(remaining);
  };

  // Add a useEffect to check device compatibility
  useEffect(() => {
    // Check if MediaRecorder is supported
    if (!window.MediaRecorder) {
      setError('Audio recording is not supported in this browser. Please try Chrome or Firefox on desktop.');
      return;
    }
    
    // Check if we're on HTTPS
    if (window.location.protocol !== 'https:') {
      setError('Warning: Microphone access typically requires HTTPS. You may encounter issues with recording.');
    }
    
    // Detect browser
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const browser = 
      /Firefox/i.test(navigator.userAgent) ? 'Firefox' :
      /Chrome/i.test(navigator.userAgent) ? 'Chrome' :
      /Safari/i.test(navigator.userAgent) ? 'Safari' :
      'Unknown';
    
    console.log(`Device environment: Mobile: ${isMobile}, Browser: ${browser}`);
    
    // Add warning for known problematic environments
    if (isMobile && browser === 'Safari') {
      setError('Safari on iOS has limited support for audio recording. Consider using Chrome if you encounter issues.');
    }
  }, []);

  // Enhanced transcription function with better error handling and timeouts
  const transcribeAudio = async (audioBlob) => {
    // Don't start transcribing if already in progress
    if (isTranscribing) return;
    
    setIsTranscribing(true);
    setError(''); // Clear any previous errors
    
    try {
      // Add a visible status message
      setTranscriptionStatus('Preparing audio for transcription...');
      
      console.log('Preparing audio for transcription, blob size:', audioBlob.size);
      
      // Create a FormData object
      const formData = new FormData();
      // Create a File object from the Blob with a .webm extension
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
      formData.append('file', audioFile);
      
      setTranscriptionStatus('Uploading audio to transcription service...');
      
      // Set up timeout for the fetch request with a longer duration
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log('Request timed out, attempting to process partial response');
      }, 180000); // 3 minute timeout
      
      console.log('Starting transcription request');
      
      // Send the request with retry logic
      let retries = 3;
      let response;
      
      while (retries > 0) {
        try {
          response = await fetch('https://amazon-interview-q-gen.onrender.com/api/transcribe', {
            method: 'POST',
            body: formData,
            signal: controller.signal
          });
          
          if (response.ok) {
            break; // Success, exit retry loop
          }
          
          retries--;
          if (retries > 0) {
            console.log(`Retrying transcription request, ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          }
        } catch (fetchError) {
          if (fetchError.name === 'AbortError') {
            throw fetchError; // Don't retry timeouts
          }
          retries--;
          if (retries > 0) {
            console.log(`Fetch error, retrying. ${retries} attempts remaining`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            throw fetchError;
          }
        }
      }
      
      clearTimeout(timeoutId); // Clear timeout on successful response
      
      // Check for HTTP errors
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription API error:', response.status, errorText);
        throw new Error(`Transcription failed with status ${response.status}: ${errorText}`);
      }
      
      setTranscriptionStatus('Processing transcription results...');
      const data = await response.json();
      console.log('Transcription completed successfully');
      
      if (data.text) {
        setTranscription(data.text);
        setTranscriptionStatus('');
      } else {
        throw new Error('Transcription response was empty');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      
      // More user-friendly error messages
      if (err.name === 'AbortError') {
        setError('Transcription timed out. Please try recording in smaller segments.');
      } else if (err.message.includes('NetworkError')) {
        setError('Network error during transcription. Please check your internet connection and try again.');
      } else if (err.message.includes('401')) {
        setError('Authentication error with the transcription service. Please contact support.');
      } else if (err.message.includes('429')) {
        setError('Transcription service rate limit exceeded. Please try again in a few minutes.');
      } else {
        setError(`Transcription failed: ${err.message}`);
      }
      
      setTranscriptionStatus('');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Updated generateAIFeedback function with length validation
  const generateAIFeedback = async () => {
    if (!transcription) {
      setError("Cannot generate feedback without a transcription");
      return;
    }
    
    // Check if transcription is too short (less than 20 words)
    const wordCount = transcription.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount < 20) {
      setError(`Your answer is too short (${wordCount} words). Please provide a more detailed response for meaningful feedback.`);
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
        // Better error handling with more details
        const errorData = await response.json().catch(() => null);
        throw new Error(`Server error: ${response.status}${errorData ? ' - ' + errorData.error : ''}`);
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
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Function to download audio
  const downloadAudio = () => {
    if (!audioUrl) return;
    
    // Create an invisible anchor element
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = audioUrl;
    a.download = `interview_recording_${new Date().toISOString().slice(0,10)}.wav`;
    
    // Add to body, click to trigger download, then remove
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Function to download transcript
  const downloadTranscript = () => {
    if (!transcription) return;
    
    // Create a blob with the text content
    const blob = new Blob([transcription], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Create an invisible anchor element
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `interview_transcript_${new Date().toISOString().slice(0,10)}.txt`;
    
    // Add to body, click to trigger download, then remove
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up the URL
    URL.revokeObjectURL(url);
  };

  // Updated button styles to match "Get Another Question" button
  const buttonStyle = {
    backgroundColor: '#232f3e', // Amazon dark blue
    color: '#ff9900',          // Amazon orange
    border: '2px solid #ff9900',
    borderRadius: '4px',
    padding: '8px 16px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
    margin: '5px',
    transition: 'all 0.3s ease'
  };

  const activeButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ff9900',
    color: '#232f3e'
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
    },
    feedbackSection: {
      backgroundColor: '#1a2433',
      border: '1px solid #3a4553',
      borderRadius: '5px',
      padding: '15px 20px',
      margin: '15px 0',
      lineHeight: '1.6',
      fontSize: '1rem',
      color: 'white'
    },
    feedbackHeading: {
      fontSize: '1.1rem',
      fontWeight: 'bold',
      color: '#FF9900',
      marginBottom: '10px',
      borderBottom: '1px solid #3a4553',
      paddingBottom: '8px'
    },
    controlSection: {
      marginBottom: '15px'
    },
    heading: {
      fontSize: '1.2rem',
      fontWeight: 'bold',
      marginBottom: '10px'
    }
  };

  // First, add this function to reset the state when a new question is generated
  const resetRecordingState = () => {
    setIsRecording(false);
    setRecordingTime(0);
    setAudioUrl(null);
    setTranscription('');
    setFeedback('');
    setError('');
    setNetworkStatus('');
    setIsTranscribing(false);
    setIsGeneratingFeedback(false);
    
    // Stop any ongoing recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Clear audio chunks
    chunksRef.current = [];
    
    // Stop timer if running
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Clear audio streams if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  // Add this useEffect to listen for question changes
  useEffect(() => {
    // Find the button that generates new questions
    const newQuestionButton = document.querySelector('.get-question-btn');
    if (newQuestionButton) {
      const handleNewQuestion = () => {
        resetRecordingState();
      };
      
      newQuestionButton.addEventListener('click', handleNewQuestion);
      
      // Clean up
      return () => {
        newQuestionButton.removeEventListener('click', handleNewQuestion);
      };
    }
  }, []);

  // Enhanced styling for the feedback report
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
              <div className="timer" style={{
                ...fontStyles.bodyText,
                color: getTimerColor(),
                transition: 'color 0.3s ease'
              }}>
                {isRecording ? `Time remaining: ${getTimeRemaining()}` : formatTime(recordingTime)}
              </div>
              {recordingTime >= 240 && (
                <div style={{
                  color: getTimerColor(),
                  fontSize: '0.8rem',
                  marginTop: '4px',
                  transition: 'color 0.3s ease'
                }}>
                  {recordingTime >= 270 ? 'Recording will stop in ' + (300 - recordingTime) + ' seconds'
                                      : 'Less than 1 minute remaining'}
                </div>
              )}
            </div>
          )}
          
          <div className="recording-controls">
            <button 
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              onClick={startRecording}
              disabled={isRecording}
              style={isRecording ? activeButtonStyle : buttonStyle}
            >
              {isRecording ? 'Recording...' : 'Start Recording'}
            </button>
            
            <button 
              className="stop-btn"
              onClick={stopRecording}
              disabled={!isRecording}
              style={buttonStyle}
            >
              Stop Recording
            </button>
          </div>
          
          <p className="recording-instructions" style={fontStyles.bodyText}>
            Click "Start Recording" and answer the question as if you were in an Amazon interview
          </p>
        </div>
        
        {audioUrl && (
          <div className="audio-playback" style={fontStyles.controlSection}>
            <h3 style={fontStyles.heading}>Recording</h3>
            
            {/* Custom audio player wrapper */}
            <div style={{ position: 'relative', marginBottom: '15px' }}>
              <audio 
                ref={audioRef} 
                src={audioUrl} 
                controls 
                style={{ width: '100%' }}
                onTimeUpdate={() => {
                  // Update current time display when audio plays
                  if (audioRef.current) {
                    const current = audioRef.current.currentTime;
                    const duration = audioRef.current.duration || 0;
                    setAudioProgress({
                      current: formatTime(current),
                      duration: formatTime(duration)
                    });
                  }
                }}
                onLoadedMetadata={() => {
                  // Get duration when audio loads
                  if (audioRef.current) {
                    setAudioProgress({
                      current: '0:00',
                      duration: formatTime(audioRef.current.duration || 0)
                    });
                  }
                }}
              />
              
              {/* Time display overlay */}
              <div style={{
                position: 'absolute',
                bottom: '5px',
                right: '10px',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '0.8rem',
                pointerEvents: 'none'
              }}>
                {audioProgress.current} / {audioProgress.duration}
              </div>
            </div>
            
            {/* Your existing download button */}
            <button
              onClick={downloadAudio}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FF9900',
                padding: '8px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                width: '40px',
                height: '40px',
                minWidth: '40px', // Prevent shrinking
                marginLeft: 'auto' // Push to right side if in a flex container
              }}
              aria-label="Download Recording"
              title="Download Recording"
            >
              <span role="img" aria-hidden="true">
                💾
              </span>
            </button>
          </div>
        )}
        
        {isTranscribing ? (
          <div className="loading">
            <p>Transcribing your answer...</p>
            <div className="loader"></div>
          </div>
        ) : transcription && (
          <div className="transcription" style={fontStyles.feedbackSection}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={fontStyles.feedbackHeading}>Transcription</h4>
              <button
                onClick={downloadTranscript}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#FF9900',
                  padding: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  width: '40px',
                  height: '40px',
                  minWidth: '40px', // Prevent shrinking
                  marginLeft: 'auto' // Push to right side if in a flex container
                }}
                aria-label="Download Transcript"
                title="Download Transcript"
              >
                <span role="img" aria-hidden="true">
                  💾
                </span>
              </button>
            </div>
            <p>{transcription}</p>
            <button 
              onClick={generateAIFeedback}
              disabled={isGeneratingFeedback}
              className="feedback-btn"
              style={isGeneratingFeedback ? {...buttonStyle, opacity: 0.7} : buttonStyle}
            >
              {isGeneratingFeedback ? 'Generating Feedback...' : 'Get AI Feedback'}
            </button>
          </div>
        )}
        
        {feedback && (
          <div className="ai-feedback" style={{
            ...fontStyles.feedbackSection,
            backgroundColor: '#f9f7f2', 
            padding: '25px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            color: '#333',
            fontFamily: 'Arial, sans-serif',
            maxWidth: '800px',
            margin: '0 auto',
          }}>
            <h2 style={{
              fontFamily: '"Times New Roman", Times, serif',
              fontSize: '1.8rem',
              color: '#333',
              textAlign: 'center',
              marginBottom: '20px',
              fontStyle: 'italic',
              borderBottom: '2px solid #e0e0e0',
              paddingBottom: '10px',
            }}>
              Interview Feedback Report
            </h2>
            
            <div className="markdown-content">
              {typeof ReactMarkdown !== 'undefined' ? (
                <ReactMarkdown
                  components={{
                    h2: ({children, ...props}) => (
                      <h2 {...props} style={{
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        marginTop: '1.5em',
                        marginBottom: '0.8em',
                        color: '#FF9900',
                        borderBottom: '1px solid #4B5563',
                        paddingBottom: '0.5em',
                        textAlign: 'left',
                        display: 'block',
                        width: '100%'
                      }}>
                        {children}
                      </h2>
                    ),
                    p: ({node, ...props}) => (
                      <p {...props} style={{
                        marginBottom: '1em',
                        textAlign: 'left',
                        display: 'block',
                        width: '100%',
                        lineHeight: '1.5'
                      }} />
                    ),
                    ul: ({node, ...props}) => (
                      <ul {...props} style={{
                        paddingLeft: '2em',
                        marginBottom: '1em',
                        textAlign: 'left'
                      }} />
                    ),
                    li: ({node, ...props}) => (
                      <li {...props} style={{
                        marginBottom: '0.5em',
                        textAlign: 'left'
                      }} />
                    )
                  }}
                >
                  {feedback}
                </ReactMarkdown>
              ) : (
                // Fallback without ReactMarkdown (simplified)
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: feedback
                      .replace(/## (.*?)$/gm, '<h2 style="background:linear-gradient(to right, #e0e7ff, #c7d2fe);padding:10px 15px;margin:18px 0 0 0;color:#1e293b;font-weight:bold;font-size:1.2rem;border-radius:8px 8px 0 0;">$1</h2><div style="border:1px solid #cbd5e1;border-top:none;padding:15px;margin-bottom:18px;border-radius:0 0 8px 8px;background-color:#f0f4f8;line-height:1.6;">')
                      .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight:bold;color:#1e293b">$1</strong>')
                      .replace(/- (.*?)$/gm, '<ul style="margin-left:20px"><li style="margin-bottom:8px;line-height:1.6">$1</li></ul>')
                      .replace(/(\d+)\. (.*?)$/gm, '<ol style="margin-left:20px"><li style="margin-bottom:12px;line-height:1.6;padding-left:5px;">$1. $2</li></ol>')
                      .replace(/\n\n/g, '</div>\n\n')
                  }} 
                />
              )}
            </div>
            
            {/* Download button for the feedback report */}
            <div style={{textAlign: 'center', marginTop: '25px'}}>
              <button
                onClick={() => {
                  // Create a blob with the feedback content
                  const blob = new Blob([feedback], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  
                  // Create an invisible anchor element
                  const a = document.createElement('a');
                  a.style.display = 'none';
                  a.href = url;
                  a.download = `interview_feedback_${new Date().toISOString().slice(0,10)}.md`;
                  
                  // Add to body, click to trigger download, then remove
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  
                  // Clean up the URL
                  URL.revokeObjectURL(url);
                }}
                style={{
                  ...buttonStyle, 
                  padding: '10px 18px',
                  background: 'linear-gradient(to right, #3b82f6, #1d4ed8)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                  ':hover': {
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                  }
                }}
              >
                📥 Download Feedback Report
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add a visual indicator for transcription status */}
      {isTranscribing && (
        <div style={{
          backgroundColor: '#2d3748',
          color: '#FF9900',
          padding: '12px',
          borderRadius: '6px',
          marginTop: '10px',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <div 
            className="spinner"
            style={{
              width: '20px',
              height: '20px',
              border: '3px solid #FF9900',
              borderTopColor: 'transparent',
              borderRadius: '50%'
            }}
          />
          <span>{transcriptionStatus || 'Transcribing audio...'}</span>
        </div>
      )}
    </div>
  );
};

export default InterviewRecorder;