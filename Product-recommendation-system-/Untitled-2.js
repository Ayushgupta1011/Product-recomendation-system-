// The entire application logic is wrapped in an IIFE to prevent global scope pollution.
(async function() {
  // Wait for the DOM   to be fully loaded before running the script
  document.addEventListener('DOMContentLoaded', () => {
    // Get necessary DOM elements
    const form = document.getElementById('recommender-form');
    const queryInput = document.getElementById('query-input');
    const modelSelect = document.getElementById('model-select');
    const loadingSpinner = document.getElementById('loading-spinner');
    const resultsContainer = document.getElementById('results-container');

    /**
     * Function to generate the HTML for a data table based on the provided data.
     * @param {Array<Object>} data The array of product objects to display.
     * @returns {string} The HTML string for the table.
     */
    function createDataTable(data) {
      if (!data || data.length === 0) {
        return '<p class="text-gray-500 text-center mt-4">No recommendations found.</p>';
      }

      let tableHtml = `
        <div class="overflow-x-auto mt-6">
          <table class="min-w-full bg-white rounded-xl shadow-md overflow-hidden">
            <thead class="bg-gray-100 border-b border-gray-200">
              <tr>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product Name</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Reviews</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Brand</th>
                <th class="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Rating</th>
              </tr>
            </thead>
            <tbody>
      `;

      // Loop through the data to create table rows
      data.forEach((row) => {
        tableHtml += `
          <tr class="border-b border-gray-200 hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${row.Name || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${row.ReviewCount || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${row.Brand || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">${row.Rating || 'N/A'}</td>
          </tr>
        `;
      });

      tableHtml += `
            </tbody>
          </table>
        </div>
      `;
      return tableHtml;
    }

    /**
     * A utility function to fetch data with exponential backoff for retries.
     * This helps in handling transient API errors or rate limiting.
     * @param {string} url The URL to fetch from.
     * @param {Object} options The fetch options object.
     * @param {number} retries The number of retries left.
     * @returns {Promise<Response>} The fetch response.
     */
    const fetchWithRetry = async (url, options, retries = 3) => {
        try {
            const response = await fetch(url, options);
            if (response.status === 429 && retries > 0) {
                const delay = Math.pow(2, 4 - retries) * 1000 + Math.random() * 1000;
                console.warn(`Too many requests. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                return fetchWithRetry(url, options, retries - 1);
            }
            if (!response.ok) {
                throw new Error(`API call failed with status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (retries > 0) {
                const delay = Math.pow(2, 4 - retries) * 1000 + Math.random() * 1000;
                console.warn(`Fetch failed. Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
                return fetchWithRetry(url, options, retries - 1);
            }
            throw error;
        }
    };

    /**
     * Handles the form submission to get recommendations from the API.
     * @param {Event} event The form submission event.
     */
    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      // Get user input and model choice
      const query = queryInput.value.trim();
      const modelType = modelSelect.value;

      // Display a validation message instead of an alert
      if (!query) {
        resultsContainer.innerHTML = `<div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong class="font-bold">Heads up!</strong>
          <span class="block sm:inline">Please enter a product or category to get recommendations.</span>
        </div>`;
        return;
      }

      // Show loading spinner and clear previous results
      loadingSpinner.classList.remove('hidden');
      resultsContainer.innerHTML = '';

      try {
        // Construct the prompt for the LLM based on the user's input and model type
        let prompt = `You are a product recommendation system for Walmart. Given the user's query and a recommendation type, provide a list of 5 diverse, high-quality, and realistic product recommendations. The recommendations should be formatted as a JSON array of objects.
        
        User Query: "${query}"
        Recommendation Type: "${modelType}"
        
        The JSON schema should be an array of objects, with each object having the following properties:
        - "Name": (string) The full product name, for example 'OPI Nail Lacquer Polish'.
        - "ReviewCount": (number) A realistic number of reviews.
        - "Brand": (string) The brand of the product.
        - "Rating": (number) A realistic rating between 4.0 and 5.0, formatted to one decimal place.`;
        
        // API call payload
        const payload = {
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  "Name": { "type": "STRING" },
                  "ReviewCount": { "type": "NUMBER" },
                  "Brand": { "type": "STRING" },
                  "Rating": { "type": "NUMBER" }
                },
                "propertyOrdering": ["Name", "ReviewCount", "Brand", "Rating"]
              }
            }
          }
        };

        // Define API key and URL
        const apiKey = "";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        // Make the API call with retry logic
        const response = await fetchWithRetry(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        const jsonString = result?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!jsonString) {
          throw new Error("Invalid response from API. Content is missing or malformed.");
        }
        
        // Parse the JSON string into an object
        const recommendations = JSON.parse(jsonString);

        // Render the recommendations table
        const title = `Recommendations for "${query}" using ${modelType} model`;
        resultsContainer.innerHTML = `
          <h3 class="text-2xl font-semibold text-blue-700 mb-4">${title}</h3>
          ${createDataTable(recommendations)}
        `;

      } catch (error) {
        console.error('Error generating recommendations:', error);
        resultsContainer.innerHTML = `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong class="font-bold">Error!</strong>
          <span class="block sm:inline">Something went wrong while fetching recommendations. Please try again.</span>
        </div>`;
      } finally {
        // Hide the loading spinner
        loadingSpinner.classList.add('hidden');
      }
    });
  });
})();
