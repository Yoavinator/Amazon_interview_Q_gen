import React, { useState, useEffect } from 'react';
import './RandomQuestionGenerator.css';

function RandomQuestionGenerator({ onQuestionGenerated }) {
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Set up sample categories and questions
    const sampleCategories = ['Leadership Principles', 'System Design', 'Coding', 'Behavioral'];
    setCategories(sampleCategories);
    setSelectedCategory(sampleCategories[0]);
  }, []);

  const generateQuestion = () => {
    setLoading(true);
    
    // Sample questions by category
    const questions = {
      'Leadership Principles': [
        'Tell me about a time you had to make a difficult decision.',
        'Describe a situation where you had to lead a team through a challenging project.',
        'Give an example of when you showed leadership qualities.'
      ],
      'System Design': [
        'How would you design a URL shortening service?',
        'Design a distributed cache system.',
        'How would you design Twitter\'s backend?'
      ],
      'Coding': [
        'Implement a function to check if a string is a palindrome.',
        'Write an algorithm to find the kth largest element in an array.',
        'Implement a basic version of a hash map.'
      ],
      'Behavioral': [
        'Tell me about a time you had to deal with a difficult team member.',
        'Describe a situation where you failed and what you learned from it.',
        'How do you handle stress and pressure?'
      ]
    };
    
    // Get questions for the selected category
    const categoryQuestions = questions[selectedCategory] || [];
    
    // Select a random question
    if (categoryQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * categoryQuestions.length);
      const randomQuestion = categoryQuestions[randomIndex];
      setQuestion(randomQuestion);
      
      // Notify parent component
      if (onQuestionGenerated) {
        onQuestionGenerated(randomQuestion);
      }
    } else {
      setQuestion('No questions available for this category.');
    }
    
    setLoading(false);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  return (
    <div className="question-generator">
      <h2>Generate Interview Question</h2>
      
      <div className="category-selector">
        <label htmlFor="category">Select Category:</label>
        <select 
          id="category" 
          value={selectedCategory} 
          onChange={handleCategoryChange}
          disabled={loading || categories.length === 0}
        >
          {categories.map((category, index) => (
            <option key={index} value={category}>{category}</option>
          ))}
        </select>
      </div>
      
      <button 
        onClick={generateQuestion} 
        disabled={loading || !selectedCategory}
        className="generate-button"
      >
        {loading ? 'Generating...' : 'Generate Question'}
      </button>
      
      {question && (
        <div className="question-box">
          <p>{question}</p>
        </div>
      )}
    </div>
  );
}

export default RandomQuestionGenerator;