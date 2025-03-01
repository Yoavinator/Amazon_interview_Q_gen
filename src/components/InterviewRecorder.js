import React, { useState, useRef } from 'react';
import './InterviewRecorder.css';

const InterviewRecorder = () => {
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
        
        // Automatically transcribe the audio
        transcribeAudio(audioBlob);
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

  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true);
    setError('');
    
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.wav');
      formData.append('model', 'whisper-1');
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTranscription(data.text);
      
      // Automatically get feedback after transcription
      getInterviewFeedback(data.text);
    } catch (err) {
      console.error('Error transcribing audio:', err);
      setError(`Failed to transcribe audio: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const getInterviewFeedback = async (transcribedText) => {
    if (!transcribedText) return;
    
    setIsGeneratingFeedback(true);
    setError('');
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert Amazon interview coach. Analyze the candidate\'s response and provide constructive feedback.'
            },
            {
              role: 'user',
              content: `Candidate's Response: ${transcribedText}\n\nPlease provide feedback on this interview response. Evaluate clarity, structure, use of examples, and alignment with Amazon's leadership principles.`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        throw new Error(`Feedback generation failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setFeedback(data.choices[0].message.content);
    } catch (err) {
      console.error('Error generating feedback:', err);
      setError(`Failed to generate feedback: ${err.message}`);
    } finally {
      setIsGeneratingFeedback(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="interview-recorder">
      <h2>Practice Your Answer</h2>
      
      <div className="recording-section">
        <h3>Record Your Answer</h3>
        
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
              <div className="timer">{formatTime(recordingTime)}</div>
            </div>
          )}
          
          <div className="recording-controls">
            <button 
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              onClick={startRecording}
              disabled={isRecording}
            >
              {isRecording ? 'Recording...' : 'Start Recording'}
            </button>
            
            <button 
              className="stop-btn"
              onClick={stopRecording}
              disabled={!isRecording}
            >
              Stop Recording
            </button>
          </div>
          
          <p className="recording-instructions">
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
        <div className="transcription-section">
          <h3>Your Transcribed Answer</h3>
          <p className="transcription-text">{transcription}</p>
        </div>
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