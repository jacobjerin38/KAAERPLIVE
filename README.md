<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1VO-bsHW6rhKE6w25hm8Ics52mT9SQdYh

## Run Locally

**Prerequisites:**
*   **Node.js**: You **must** have Node.js installed to run this application.
    *   [Download Node.js LTS](https://nodejs.org/)
    *   Verify installation by running `node -v` and `npm -v` in your terminal.

**Steps:**

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Configure Environment:**
    *   Create a file named `.env.local` in the root directory.
    *   Add your Gemini API key (get one [here](https://aistudio.google.com/app/apikey)):
        ```env
        GEMINI_API_KEY=your_actual_api_key_here
        ```

3.  **Start the App:**
    ```bash
    npm run dev
    ```
    *   Open the URL shown in the terminal (usually `http://localhost:5173`) in your browser.
