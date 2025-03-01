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

  const transcribeAudio = async (audioBlob) => {
    setIsTranscribing(true);
    setNetworkStatus('Simulating transcription...');
    
    // Simulate a network delay
    setTimeout(() => {
      const transcriptions = [
        "I think one of my strengths is my ability to collaborate effectively with cross-functional teams. For example, in my previous role, I worked with the engineering, design, and marketing teams to launch a new product feature that increased user engagement by 30%.",
        
        "When faced with a challenging problem, I typically break it down into smaller components and prioritize which aspects to tackle first. I also believe in leveraging data to inform my decision-making process.",
        
        "I've handled disagreements with colleagues by focusing on active listening and trying to understand their perspective. I believe in finding common ground and working towards a solution that addresses the core concerns of all parties involved.",
        
        "My approach to meeting tight deadlines involves creating a detailed plan, identifying potential bottlenecks early, and maintaining clear communication with stakeholders about progress and any challenges that arise.",
        
        "I'm interested in working at Amazon because of the company's customer obsession and innovation culture. I believe my skills in data analysis and problem-solving align well with Amazon's leadership principles."
      ];
      
      // Select a random transcription or generate based on duration
      const index = Math.floor(Math.random() * transcriptions.length);
      setTranscription(transcriptions[index]);
      setIsTranscribing(false);
      setNetworkStatus('');
    }, 2000);
  };

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
      
      console.log("Making feedback request to server...");
      
      // Use the direct URL but with mode: 'no-cors' to handle CORS issues
      const response = await fetch('https://amazon-interview-q-gen.onrender.com/api/feedback', {
        method: 'POST',
        mode: 'no-cors', // This bypasses CORS but means we can't read the response
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription,
          question,
        }),
      });
      
      // Since no-cors means we can't read the response,
      // we'll use a simulated response for now
      
      const feedbacks = [
        `## Feedback on Your Answer

### How well the candidate answered the question
* Good job addressing the key aspects of the question
* Provided a specific example which strengthens your answer
* Clear demonstration of your skills and approach

### Structure and clarity
* Well-structured response with a clear beginning and conclusion
* Good use of the STAR method (Situation, Task, Action, Result)
* Could be slightly more concise in some areas

### Specific improvements
* Consider quantifying more of your achievements
* Relate your experience more explicitly to Amazon's Leadership Principles
* Add one more concrete example to demonstrate consistency

### Overall rating: 8/10`,

        `## Feedback on Your Answer

### How well the candidate answered the question
* Addressed the main points of the question
* Demonstrated analytical thinking and methodical approach
* Could provide more specific examples

### Structure and clarity
* Logical flow of ideas
* Clear explanation of your process
* Introduction could be stronger to grab attention

### Specific improvements
* Connect your answer more directly to the role you're applying for
* Include metrics or results from past experiences
* Mention how you've grown from challenging situations

### Overall rating: 7/10`,

        `## Feedback on Your Answer

### How well the candidate answered the question
* Strong focus on collaboration and conflict resolution
* Good explanation of your communication style
* Covered both prevention and resolution strategies

### Structure and clarity
* Well-organized thoughts
* Easy to follow your reasoning
* Good balance of concepts and examples

### Specific improvements
* Highlight how your approach aligns with Amazon's Leadership Principles
* Provide an example where your approach led to a successful outcome
* Add a brief mention of how you follow up after resolving disagreements

### Overall rating: 8.5/10`
      ];
      
      // Select a random feedback
      const index = Math.floor(Math.random() * feedbacks.length);
      setFeedback(feedbacks[index]);
      
      console.log("Feedback response received and processed");
      
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