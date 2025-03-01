import React, { useState, useRef } from 'react';
import './InterviewRecorder.css';

const InterviewRecorder = ({ removePracticeHeader = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [transcription, setTranscription] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
  const [error, setError] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    audioChunksRef.current = [];
    setIsRecording(true);
    setAudioUrl('');
    setTranscription('');
    setFeedback('');
    setError('');
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
        setIsTranscribing(true);
        setTimeout(() => {
          setTranscription('This is a simulated transcription of your answer. In a real implementation, this would be processed through a speech-to-text service like OpenAI\'s Whisper API.');
          setIsTranscribing(false);
        }, 1500);
      };
      
      mediaRecorderRef.current.start();
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError(`Failed to access microphone: ${err.message}`);
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

  const generateFeedback = async () => {
    setIsGeneratingFeedback(true);
    
    // Simulate AI feedback generation
    setTimeout(() => {
      setFeedback('This is where AI feedback on your answer would appear.');
      setIsGeneratingFeedback(false);
    }, 2000);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Standardized font sizes
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
      {/* Remove the "Practice Your Answer" header if requested */}
      {!removePracticeHeader && (
        <h2 style={fontStyles.subheading}>
          Record Your Answer
        </h2>
      )}
      
      <div className="recording-section">
        <h3 style={{
          fontSize: fontStyles.subheading.fontSize,
          fontWeight: fontStyles.subheading.fontWeight,
          color: fontStyles.subheading.color,
          fontFamily: fontStyles.subheading.fontFamily
        }}>
          Record Your Answer
        </h3>
        
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
              <div className="timer" style={{ fontSize: fontStyles.bodyText.fontSize }}>
                {formatTime(recordingTime)}
              </div>
            </div>
          )}
          
          <div className="recording-controls">
            <button 
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              onClick={startRecording}
              disabled={isRecording}
              style={{ fontSize: fontStyles.bodyText.fontSize }}
            >
              {isRecording ? 'Recording...' : 'Start Recording'}
            </button>
            
            <button 
              className="stop-btn"
              onClick={stopRecording}
              disabled={!isRecording}
              style={{ fontSize: fontStyles.bodyText.fontSize }}
            >
              Stop Recording
            </button>
          </div>
          
          <p className="recording-instructions" style={{ fontSize: fontStyles.bodyText.fontSize }}>
            Click "Start Recording" and answer the question as if you were in an Amazon interview
          </p>
        </div>
        
        {audioUrl && (
          <div className="audio-playback">
            <audio src={audioUrl} controls />
          </div>
        )}
      </div>
      
      {(isTranscribing || isGeneratingFeedback) && (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <span>
            {isTranscribing ? 'Transcribing your answer...' : 'Analyzing your answer...'}
          </span>
        </div>
      )}
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      {transcription && (
        <>
          <h2 className="your-transcribed-answer">Your Transcribed Answer</h2>
          <div className="transcription-section">
            <p className="transcription-text">{transcription}</p>
            
            {!feedback && !isGeneratingFeedback && (
              <button 
                className="feedback-button"
                onClick={generateFeedback}
              >
                Get AI Feedback
              </button>
            )}
          </div>
        </>
      )}
      
      {feedback && (
        <div className="feedback-section">
          <h3>AI Feedback</h3>
          <div className="feedback-text">{feedback}</div>
        </div>
      )}
    </div>
  );
};

export default InterviewRecorder;