import React from 'react';
import './App.css';
import RandomQuestionGenerator from './RandomQuestionGenerator';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <RandomQuestionGenerator />
        <div className="footer" style={{ position: 'fixed', bottom: '10px', width: '100%', textAlign: 'center', color: 'white' }}>
          <p style={{ fontSize: '0.9rem', marginBottom: '5px' }}>
            Created by Yoav Marziano™
          </p>
          <p style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
            For educational purposes only. Not affiliated with Amazon. All trademarks belong to their respective owners.
          </p>
        </div>
      </header>
    </div>
  );
}

export default App;
