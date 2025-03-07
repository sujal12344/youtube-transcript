document.addEventListener('DOMContentLoaded', function() {
  const getTranscriptButton = document.getElementById('get-transcript');
  const statusMessage = document.getElementById('status-message');
  const loadingElement = document.getElementById('loading');
  const transcriptContainer = document.getElementById('transcript-container');
  const transcriptContent = document.getElementById('transcript-content');

  getTranscriptButton.addEventListener('click', async function() {
    // Show loading state
    getTranscriptButton.disabled = true;
    statusMessage.textContent = 'Analyzing video...';
    loadingElement.classList.remove('hidden');
    transcriptContainer.classList.add('hidden');

    try {
      // Get the current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we're on a YouTube video page
      if (!tab.url.includes('youtube.com/watch')) {
        statusMessage.textContent = 'Please navigate to a YouTube video page first.';
        loadingElement.classList.add('hidden');
        getTranscriptButton.disabled = false;
        return;
      }

      // Add a timeout to prevent hanging
      const responsePromise = new Promise((resolve) => {
        chrome.tabs.sendMessage(
          tab.id,
          { action: 'getTranscript' },
          function(response) {
            resolve(response);
          }
        );
      });
      
      // Add a timeout of 15 seconds
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({ error: 'Request timed out. The video might not have a transcript available.' });
        }, 15000);
      });
      
      // Race between the response and the timeout
      const response = await Promise.race([responsePromise, timeoutPromise]);
      
      loadingElement.classList.add('hidden');
      getTranscriptButton.disabled = false;

      // Check if response is undefined or null
      if (!response) {
        statusMessage.textContent = 'Error: No response received from content script';
        return;
      }

      if (response.error) {
        statusMessage.textContent = response.error;
        return;
      }

      if (response.isCodingVideo) {
        statusMessage.textContent = 'This appears to be a coding video. Redirecting...';
        // Redirect to YouTube home page
        chrome.tabs.update(tab.id, { url: 'https://www.youtube.com/' });
      } else {
        // Display the important points from the transcript
        statusMessage.textContent = 'Transcript processed successfully!';
        transcriptContainer.classList.remove('hidden');
        
        // Format and display the important points
        if (response.importantPoints && response.importantPoints.length > 0) {
          const pointsHTML = response.importantPoints.map(point => 
            `<p>• ${point}</p>`
          ).join('');
          transcriptContent.innerHTML = pointsHTML;
        } else {
          transcriptContent.innerHTML = '<p>No important points found in this video.</p>';
        }
      }
    } catch (error) {
      loadingElement.classList.add('hidden');
      getTranscriptButton.disabled = false;
      statusMessage.textContent = 'Error: ' + (error.message || 'Unknown error occurred');
      console.error('Transcript error:', error);
    }
  });
}); 