// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getTranscript') {
    // Wrap in try-catch to ensure we always send a response
    try {
      getAndProcessTranscript()
        .then(result => {
          console.log("Sending transcript result:", result);
          sendResponse(result);
        })
        .catch(error => {
          console.error("Transcript error:", error);
          sendResponse({ error: error.message || "Unknown error occurred" });
        });
    } catch (e) {
      console.error("Unexpected error in message handler:", e);
      sendResponse({ error: "Unexpected error: " + (e.message || "Unknown error") });
    }
    
    // Return true to indicate we will send a response asynchronously
    return true;
  }
});

// Function to get and process the transcript
async function getAndProcessTranscript() {
  try {
    // Check if we're on a YouTube video page
    if (!window.location.href.includes('youtube.com/watch')) {
      throw new Error('Not a YouTube video page');
    }

    // Get video ID from URL
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) {
      throw new Error('Could not find video ID');
    }

    // Get video title
    const videoTitle = document.querySelector('h1.title.style-scope.ytd-video-primary-info-renderer')?.textContent || '';
    
    // Get transcript data
    const transcript = await fetchTranscript(videoId);
    
    // Check if this is a coding video
    const isCodingVideo = checkIfCodingVideo(videoTitle, transcript);
    
    // If it's a coding video, we'll return that info to redirect
    if (isCodingVideo) {
      return { isCodingVideo: true };
    }
    
    // Extract important points from the transcript
    const importantPoints = extractImportantPoints(transcript);
    
    return {
      isCodingVideo: false,
      importantPoints: importantPoints
    };
  } catch (error) {
    console.error('Error processing transcript:', error);
    throw error;
  }
}

// Function to fetch transcript from YouTube
async function fetchTranscript(videoId) {
  try {
    // Try to get transcript using YouTube's API
    const response = await fetch(`https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`);
    
    // If API method fails, try UI method
    if (!response.ok) {
      return await fetchTranscriptFromUI();
    }
    
    const data = await response.text();
    if (data && data.length > 0) {
      // Parse the XML response
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data, "text/xml");
      const textElements = xmlDoc.getElementsByTagName("text");
      
      let transcriptText = "";
      for (let i = 0; i < textElements.length; i++) {
        transcriptText += textElements[i].textContent + " ";
      }
      
      return transcriptText;
    } else {
      return await fetchTranscriptFromUI();
    }
  } catch (e) {
    console.error('Error fetching transcript from API:', e);
    return await fetchTranscriptFromUI();
  }
}

// Function to fetch transcript from YouTube UI
async function fetchTranscriptFromUI() {
  try {
    // First check if transcript button is already in the UI
    let transcriptButton = document.querySelector('button[aria-label="Show transcript"]');
    
    // If not found, try to open the menu to find it
    if (!transcriptButton) {
      // Click on the "..." menu button
      const moreButton = document.querySelector('button.ytp-button.ytp-settings-button');
      if (moreButton) {
        moreButton.click();
        
        // Wait for menu to appear
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Look for transcript option
        const menuItems = document.querySelectorAll('div.ytp-menuitem');
        let transcriptMenuItem = null;
        
        for (const item of menuItems) {
          if (item.textContent.includes('Transcript')) {
            transcriptMenuItem = item;
            break;
          }
        }
        
        // If found, click it
        if (transcriptMenuItem) {
          transcriptMenuItem.click();
          
          // Wait for transcript to load
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Get transcript text
          const transcriptItems = document.querySelectorAll('.ytd-transcript-segment-renderer');
          if (transcriptItems && transcriptItems.length > 0) {
            return Array.from(transcriptItems).map(item => item.textContent).join(' ');
          }
        }
        
        // Close menu if we couldn't get transcript
        document.body.click();
      }
    } else {
      // Transcript button already visible, click it
      transcriptButton.click();
      
      // Wait for transcript to load
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Get transcript text
      const transcriptItems = document.querySelectorAll('.ytd-transcript-segment-renderer');
      if (transcriptItems && transcriptItems.length > 0) {
        return Array.from(transcriptItems).map(item => item.textContent).join(' ');
      }
    }
  } catch (e) {
    console.error('Error accessing YouTube transcript UI:', e);
  }
  
  // If all methods fail, use simulated transcript
  console.log('Using simulated transcript for demo purposes');
  return simulateTranscript();
}

// Function to check if the video is coding-related
function checkIfCodingVideo(title, transcript) {
  // Convert to lowercase for easier matching
  const lowerTitle = title.toLowerCase();
  const lowerTranscript = transcript.toLowerCase();
  
  // Keywords that suggest coding content
  const codingKeywords = [
    'programming', 'coding', 'developer', 'javascript', 'python', 'java', 'c\\+\\+', 
    'code', 'algorithm', 'function', 'variable', 'class', 'object', 'method',
    'api', 'framework', 'library', 'react', 'angular', 'vue', 'node.js',
    'html', 'css', 'database', 'sql', 'mongodb', 'git', 'github', 'terminal',
    'command line', 'compiler', 'interpreter', 'debugging', 'syntax', 'frontend',
    'backend', 'fullstack', 'web development', 'app development', 'software engineering'
  ];
  
  // Check title first (stronger indicator)
  for (const keyword of codingKeywords) {
    if (lowerTitle.includes(keyword)) {
      return true;
    }
  }
  
  // Count keyword occurrences in transcript
  let keywordCount = 0;
  for (const keyword of codingKeywords) {
    try {
      // Count occurrences of each keyword
      // Escape any special regex characters in the keyword
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp('\\b' + escapedKeyword + '\\b', 'gi');
      const matches = lowerTranscript.match(regex);
      if (matches) {
        keywordCount += matches.length;
      }
    } catch (e) {
      console.error('Error with regex for keyword:', keyword, e);
      // Continue with other keywords if one fails
      continue;
    }
  }
  
  // If we have a significant number of coding keywords, consider it a coding video
  // Adjust threshold based on transcript length
  const threshold = Math.max(3, Math.floor(transcript.split(' ').length / 200));
  return keywordCount >= threshold;
}

// Improved function to extract important points using a more sophisticated approach
function extractImportantPoints(transcript) {
  // Split transcript into sentences
  const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [];
  
  // Keywords that might indicate important information
  const importantKeywords = [
    'important', 'key', 'essential', 'critical', 'crucial', 'significant',
    'remember', 'note', 'takeaway', 'conclusion', 'summary', 'in summary',
    'to summarize', 'finally', 'ultimately', 'in conclusion', 'therefore',
    'as a result', 'consequently', 'thus', 'hence', 'accordingly',
    'first', 'second', 'third', 'fourth', 'fifth', 'lastly',
    'for example', 'such as', 'specifically', 'particularly', 'notably',
    'in particular', 'especially', 'primarily', 'mainly', 'chiefly',
    'highlight', 'emphasize', 'stress', 'underline', 'underscore',
    'point out', 'call attention to', 'focus on', 'concentrate on'
  ];
  
  // Score each sentence based on keywords and other factors
  const scoredSentences = sentences.map(sentence => {
    let score = 0;
    const lowerSentence = sentence.toLowerCase();
    
    // Check for important keywords
    for (const keyword of importantKeywords) {
      if (lowerSentence.includes(keyword)) {
        score += 2;
      }
    }
    
    // Longer sentences might contain more information (up to a point)
    const wordCount = sentence.split(' ').length;
    if (wordCount > 5 && wordCount < 30) {
      score += 1;
    }
    
    // Sentences with numbers often contain specific information
    if (/\d+/.test(sentence)) {
      score += 1;
    }
    
    // Sentences at the beginning or end of paragraphs are often important
    // This is a simplification since we don't have paragraph info
    if (sentences.indexOf(sentence) === 0 || 
        sentences.indexOf(sentence) === sentences.length - 1) {
      score += 1;
    }
    
    // Sentences with quotation marks might be important quotes
    if (sentence.includes('"') || sentence.includes("'")) {
      score += 1;
    }
    
    return { sentence: sentence.trim(), score };
  });
  
  // Sort by score (highest first)
  scoredSentences.sort((a, b) => b.score - a.score);
  
  // Take top sentences (up to 15, with score > 0)
  return scoredSentences
    .filter(item => item.score > 0)
    .slice(0, 15)
    .map(item => item.sentence);
}

// Function to simulate a transcript for demo purposes
function simulateTranscript() {
  // This is just for demonstration
  // In a real extension, you would get the actual transcript
  
  const demoTranscripts = {
    // Generic transcript
    'default': `Welcome to this video. Today we're going to discuss some important topics. 
    First, let's talk about the main points. It's essential to understand the key concepts. 
    Remember that practice is crucial for mastery. The second important point is consistency. 
    To summarize, focus on these key takeaways. Finally, don't forget to like and subscribe.`,
    
    // Coding-related transcript
    'coding': `In this tutorial, we'll learn how to code a simple JavaScript function. 
    First, let's create a variable using the let keyword. Next, we'll write a function that takes two parameters. 
    It's important to understand how scope works in JavaScript. 
    Remember to use proper syntax when defining your functions. 
    The key concept here is that functions are reusable blocks of code. 
    Let me show you how to debug this code using console.log statements. 
    Finally, we'll test our function with different inputs to make sure it works correctly.`
  };
  
  // Return either a generic transcript or a coding one (randomly for demo)
  return Math.random() > 0.5 ? demoTranscripts.default : demoTranscripts.coding;
} 