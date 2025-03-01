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
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
      }}>Interview Feedback Report</h2>
      
      <div className="markdown-content">
        {typeof ReactMarkdown !== 'undefined' ? (
          <ReactMarkdown
            components={{
              h2: ({node, ...props}) => {
                const text = props.children[0] || '';
                
                // Extract section type
                let sectionType = '';
                let backgroundColor = '#f0f4f8'; // Default light blue-gray
                let borderColor = '#cbd5e1';
                let headerGradient = 'linear-gradient(to right, #e0e7ff, #c7d2fe)';
                
                if (text.toString().includes('📊')) {
                  sectionType = 'score';
                  backgroundColor = '#eef2ff'; // Light indigo
                  borderColor = '#c7d2fe';
                  headerGradient = 'linear-gradient(to right, #c7d2fe, #a5b4fc)';
                } else if (text.toString().includes('📌')) {
                  sectionType = 'star';
                  backgroundColor = '#ecfdf5'; // Light green
                  borderColor = '#a7f3d0';
                  headerGradient = 'linear-gradient(to right, #d1fae5, #a7f3d0)';
                } else if (text.toString().includes('🏆')) {
                  sectionType = 'leadership';
                  backgroundColor = '#fff1f2'; // Light red
                  borderColor = '#fecdd3';
                  headerGradient = 'linear-gradient(to right, #fee2e2, #fecaca)';
                } else if (text.toString().includes('🧠')) {
                  sectionType = 'skills';
                  backgroundColor = '#eff6ff'; // Light blue
                  borderColor = '#bfdbfe';
                  headerGradient = 'linear-gradient(to right, #dbeafe, #bfdbfe)';
                } else if (text.toString().includes('🚀')) {
                  sectionType = 'improvements';
                  backgroundColor = '#f5f3ff'; // Light purple
                  borderColor = '#ddd6fe';
                  headerGradient = 'linear-gradient(to right, #ede9fe, #ddd6fe)';
                } else if (text.toString().includes('⚡')) {
                  sectionType = 'summary';
                  backgroundColor = '#fefce8'; // Light yellow
                  borderColor = '#fef08a';
                  headerGradient = 'linear-gradient(to right, #fef9c3, #fef08a)';
                }
                
                return (
                  <div style={{
                    marginTop: '18px',
                    marginBottom: '18px',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                  }}>
                    <h2 style={{
                      background: headerGradient,
                      padding: '10px 15px',
                      margin: 0,
                      color: '#1e293b', // Darker text for better contrast
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      borderBottom: `1px solid ${borderColor}`,
                    }} {...props}/>
                    <div style={{
                      padding: '15px',
                      backgroundColor: backgroundColor,
                      lineHeight: '1.6',
                    }} id={`section-${sectionType}`} className={`section-${sectionType}`}>
                      {/* Content will be inserted here by ReactMarkdown */}
                    </div>
                  </div>
                );
              },
              // Special handling for overall score section
              p: ({node, children, ...props}) => {
                const text = children.toString();
                const parentElement = node.position ? 
                  document.getElementById(`section-${getParentSectionType(node)}`) : null;
                
                // Special handling for score display
                if (text.includes('Score:') && parentElement?.id === 'section-score') {
                  const score = text.match(/Score:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i)?.[1] || '?';
                  return (
                    <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                      <div style={{ 
                        fontSize: '36px', 
                        fontWeight: 'bold', 
                        color: getScoreColor(parseFloat(score)),
                        margin: '5px 0'
                      }}>
                        {score}/10
                      </div>
                      <p style={{ 
                        fontSize: '14px', 
                        color: '#64748b',
                        marginTop: '0'
                      }}>
                        {text.replace(/Score:\s*\d+(?:\.\d+)?\s*\/\s*10/i, '')}
                      </p>
                    </div>
                  );
                }
                
                // Special styling for improvement suggestions
                if (parentElement?.id === 'section-improvements') {
                  if (text.match(/^\d+\.\s+/)) {
                    // This is a numbered item in improvements
                    const number = text.match(/^(\d+)\.\s+/)[1];
                    const content = text.replace(/^\d+\.\s+/, '');
                    
                    // Bold the first phrase (up to the first dash or period)
                    let styledContent = content;
                    const mainPoint = content.split(/\s+[–—-]\s+|\.\s+/)[0];
                    if (mainPoint && mainPoint !== content) {
                      styledContent = content.replace(
                        mainPoint, 
                        `<strong style="color:#4338ca">${mainPoint}</strong>`
                      );
                    }
                    
                    return (
                      <p style={{
                        marginBottom: '12px',
                        paddingLeft: '10px',
                        borderLeft: '3px solid #818cf8'
                      }}>
                        <span style={{
                          display: 'inline-block',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#4f46e5',
                          color: 'white',
                          textAlign: 'center',
                          marginRight: '10px',
                          fontWeight: 'bold',
                          lineHeight: '24px'
                        }}>{number}</span>
                        <span dangerouslySetInnerHTML={{ __html: styledContent }} />
                      </p>
                    );
                  }
                }
                
                // Default paragraph styling with appropriate spacing
                return (
                  <p style={{
                    marginBottom: '12px',
                    lineHeight: '1.6'
                  }} {...props}>{children}</p>
                );
              },
              strong: ({node, children, ...props}) => {
                // Get parent section type
                const parentSectionType = getParentSectionType(node);
                
                // Different styling based on section
                let color = '#1e293b'; // Default dark color
                
                if (parentSectionType === 'score') color = '#4338ca'; // Indigo
                if (parentSectionType === 'star') color = '#047857'; // Green
                if (parentSectionType === 'leadership') color = '#b91c1c'; // Red
                if (parentSectionType === 'skills') color = '#1d4ed8'; // Blue
                if (parentSectionType === 'improvements') color = '#7c3aed'; // Purple
                if (parentSectionType === 'summary') color = '#b45309'; // Amber
                  
                return (
                  <strong style={{
                    fontWeight: 'bold', 
                    color: color
                  }} {...props}>
                    {children}
                  </strong>
                );
              },
              ul: ({node, ...props}) => (
                <ul style={{
                  marginLeft: '20px',
                  listStyleType: 'disc',
                  marginBottom: '15px'
                }} {...props}/>
              ),
              ol: ({node, ...props}) => (
                <ol style={{
                  marginLeft: '20px',
                  marginBottom: '15px'
                }} {...props}/>
              ),
              li: ({node, children, ...props}) => {
                // Get parent section type
                const parentSectionType = getParentSectionType(node);
                
                return (
                  <li style={{
                    marginBottom: '8px',
                    paddingLeft: '5px',
                    ...(parentSectionType === 'leadership' || parentSectionType === 'skills' ? 
                      { borderLeft: `2px solid ${parentSectionType === 'leadership' ? '#fca5a5' : '#93c5fd'}` } : {})
                  }} {...props}>
                    {children}
                  </li>
                );
              },
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

  // Helper function to get parent section type
  const getParentSectionType = (node) => {
    if (!node || !node.position) return '';
    
    // Find the closest section div
    const sections = document.querySelectorAll('[id^="section-"]');
    for (const section of sections) {
      // Simple position-based check
      if (section.id) {
        return section.id.replace('section-', '');
      }
    }
    return '';
  };

  // Helper function to get color based on score
  const getScoreColor = (score) => {
    if (score >= 8) return '#16a34a'; // Green for high scores
    if (score >= 6) return '#ca8a04'; // Yellow for medium scores
    if (score >= 4) return '#ea580c'; // Orange for below average
    return '#dc2626'; // Red for poor scores
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
          <div className="audio-playback">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={fontStyles.feedbackHeading}>Review Your Answer</h4>
              <button
                onClick={downloadAudio}
                style={{...buttonStyle, padding: '5px 10px', fontSize: '0.9rem'}}
              >
                Download Recording
              </button>
            </div>
            <audio controls src={audioUrl} style={{ width: '100%', marginTop: '10px' }}></audio>
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
                style={{...buttonStyle, padding: '5px 10px', fontSize: '0.9rem'}}
              >
                Download Transcript
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
            }}>Interview Feedback Report</h2>
            
            <div className="markdown-content">
              {typeof ReactMarkdown !== 'undefined' ? (
                <ReactMarkdown
                  components={{
                    h2: ({node, ...props}) => {
                      const text = props.children[0] || '';
                      
                      // Extract section type
                      let sectionType = '';
                      let backgroundColor = '#f0f4f8'; // Default light blue-gray
                      let borderColor = '#cbd5e1';
                      let headerGradient = 'linear-gradient(to right, #e0e7ff, #c7d2fe)';
                      
                      if (text.toString().includes('📊')) {
                        sectionType = 'score';
                        backgroundColor = '#eef2ff'; // Light indigo
                        borderColor = '#c7d2fe';
                        headerGradient = 'linear-gradient(to right, #c7d2fe, #a5b4fc)';
                      } else if (text.toString().includes('📌')) {
                        sectionType = 'star';
                        backgroundColor = '#ecfdf5'; // Light green
                        borderColor = '#a7f3d0';
                        headerGradient = 'linear-gradient(to right, #d1fae5, #a7f3d0)';
                      } else if (text.toString().includes('🏆')) {
                        sectionType = 'leadership';
                        backgroundColor = '#fff1f2'; // Light red
                        borderColor = '#fecdd3';
                        headerGradient = 'linear-gradient(to right, #fee2e2, #fecaca)';
                      } else if (text.toString().includes('🧠')) {
                        sectionType = 'skills';
                        backgroundColor = '#eff6ff'; // Light blue
                        borderColor = '#bfdbfe';
                        headerGradient = 'linear-gradient(to right, #dbeafe, #bfdbfe)';
                      } else if (text.toString().includes('🚀')) {
                        sectionType = 'improvements';
                        backgroundColor = '#f5f3ff'; // Light purple
                        borderColor = '#ddd6fe';
                        headerGradient = 'linear-gradient(to right, #ede9fe, #ddd6fe)';
                      } else if (text.toString().includes('⚡')) {
                        sectionType = 'summary';
                        backgroundColor = '#fefce8'; // Light yellow
                        borderColor = '#fef08a';
                        headerGradient = 'linear-gradient(to right, #fef9c3, #fef08a)';
                      }
                      
                      return (
                        <div style={{
                          marginTop: '18px',
                          marginBottom: '18px',
                          border: `1px solid ${borderColor}`,
                          borderRadius: '8px',
                          overflow: 'hidden',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                        }}>
                          <h2 style={{
                            background: headerGradient,
                            padding: '10px 15px',
                            margin: 0,
                            color: '#1e293b', // Darker text for better contrast
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            borderBottom: `1px solid ${borderColor}`,
                          }} {...props}/>
                          <div style={{
                            padding: '15px',
                            backgroundColor: backgroundColor,
                            lineHeight: '1.6',
                          }} id={`section-${sectionType}`} className={`section-${sectionType}`}>
                            {/* Content will be inserted here by ReactMarkdown */}
                          </div>
                        </div>
                      );
                    },
                    // Special handling for overall score section
                    p: ({node, children, ...props}) => {
                      const text = children.toString();
                      const parentElement = node.position ? 
                        document.getElementById(`section-${getParentSectionType(node)}`) : null;
                      
                      // Special handling for score display
                      if (text.includes('Score:') && parentElement?.id === 'section-score') {
                        const score = text.match(/Score:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i)?.[1] || '?';
                        return (
                          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                            <div style={{ 
                              fontSize: '36px', 
                              fontWeight: 'bold', 
                              color: getScoreColor(parseFloat(score)),
                              margin: '5px 0'
                            }}>
                              {score}/10
                            </div>
                            <p style={{ 
                              fontSize: '14px', 
                              color: '#64748b',
                              marginTop: '0'
                            }}>
                              {text.replace(/Score:\s*\d+(?:\.\d+)?\s*\/\s*10/i, '')}
                            </p>
                          </div>
                        );
                      }
                      
                      // Special styling for improvement suggestions
                      if (parentElement?.id === 'section-improvements') {
                        if (text.match(/^\d+\.\s+/)) {
                          // This is a numbered item in improvements
                          const number = text.match(/^(\d+)\.\s+/)[1];
                          const content = text.replace(/^\d+\.\s+/, '');
                          
                          // Bold the first phrase (up to the first dash or period)
                          let styledContent = content;
                          const mainPoint = content.split(/\s+[–—-]\s+|\.\s+/)[0];
                          if (mainPoint && mainPoint !== content) {
                            styledContent = content.replace(
                              mainPoint, 
                              `<strong style="color:#4338ca">${mainPoint}</strong>`
                            );
                          }
                          
                          return (
                            <p style={{
                              marginBottom: '12px',
                              paddingLeft: '10px',
                              borderLeft: '3px solid #818cf8'
                            }}>
                              <span style={{
                                display: 'inline-block',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: '#4f46e5',
                                color: 'white',
                                textAlign: 'center',
                                marginRight: '10px',
                                fontWeight: 'bold',
                                lineHeight: '24px'
                              }}>{number}</span>
                              <span dangerouslySetInnerHTML={{ __html: styledContent }} />
                            </p>
                          );
                        }
                      }
                      
                      // Default paragraph styling with appropriate spacing
                      return (
                        <p style={{
                          marginBottom: '12px',
                          lineHeight: '1.6'
                        }} {...props}>{children}</p>
                      );
                    },
                    strong: ({node, children, ...props}) => {
                      // Get parent section type
                      const parentSectionType = getParentSectionType(node);
                      
                      // Different styling based on section
                      let color = '#1e293b'; // Default dark color
                      
                      if (parentSectionType === 'score') color = '#4338ca'; // Indigo
                      if (parentSectionType === 'star') color = '#047857'; // Green
                      if (parentSectionType === 'leadership') color = '#b91c1c'; // Red
                      if (parentSectionType === 'skills') color = '#1d4ed8'; // Blue
                      if (parentSectionType === 'improvements') color = '#7c3aed'; // Purple
                      if (parentSectionType === 'summary') color = '#b45309'; // Amber
                        
                      return (
                        <strong style={{
                          fontWeight: 'bold', 
                          color: color
                        }} {...props}>
                          {children}
                        </strong>
                      );
                    },
                    ul: ({node, ...props}) => (
                      <ul style={{
                        marginLeft: '20px',
                        listStyleType: 'disc',
                        marginBottom: '15px'
                      }} {...props}/>
                    ),
                    ol: ({node, ...props}) => (
                      <ol style={{
                        marginLeft: '20px',
                        marginBottom: '15px'
                      }} {...props}/>
                    ),
                    li: ({node, children, ...props}) => {
                      // Get parent section type
                      const parentSectionType = getParentSectionType(node);
                      
                      return (
                        <li style={{
                          marginBottom: '8px',
                          paddingLeft: '5px',
                          ...(parentSectionType === 'leadership' || parentSectionType === 'skills' ? 
                            { borderLeft: `2px solid ${parentSectionType === 'leadership' ? '#fca5a5' : '#93c5fd'}` } : {})
                        }} {...props}>
                          {children}
                        </li>
                      );
                    },
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
    </div>
  );
};

export default InterviewRecorder;