// Your Gemini API key
const API_KEY = 'AIzaSyB5Qxct2UnUXDlR90v9a5l4H-NwEYzuWqw';

// DOM Elements
const promptTextarea = document.querySelector('.prompt-textarea');
const codeTabs = document.querySelectorAll('.code-tab');
const editors = document.querySelectorAll('.editor');
const previewTab = document.querySelector('.tab:not(.active)');
const codeTab = document.querySelector('.tab.active');

// Initialize editors
let htmlEditor = document.getElementById('htmlEditor');
let cssEditor = document.getElementById('cssEditor');
let jsEditor = document.getElementById('jsEditor');

// Add Monaco Editor initialization
require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.33.0/min/vs' }});

let monacoEditors = {};

require(['vs/editor/editor.main'], function() {
    // First, clear any existing editors
    document.getElementById('htmlEditor').innerHTML = '';
    document.getElementById('cssEditor').innerHTML = '';
    document.getElementById('jsEditor').innerHTML = '';

    // Common editor options
    const editorOptions = {
        theme: 'vs-dark',
        minimap: { enabled: false },
        automaticLayout: true,
        fontSize: 14,
        lineHeight: 21,
        padding: { top: 10, bottom: 10 },
        scrollBeyondLastLine: false,
        roundedSelection: true,
        occurrencesHighlight: false,
        renderLineHighlight: 'none',
        contextmenu: false,
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        parameterHints: { enabled: false },
        snippetSuggestions: 'none',
        wordBasedSuggestions: false,
        rename: {
            enabled: false
        }
    };

    // Initialize Monaco editors
    monacoEditors = {
        html: monaco.editor.create(document.getElementById('htmlEditor'), {
            ...editorOptions,
            value: '',
            language: 'html'
        }),
        css: monaco.editor.create(document.getElementById('cssEditor'), {
            ...editorOptions,
            value: '',
            language: 'css'
        }),
        js: monaco.editor.create(document.getElementById('jsEditor'), {
            ...editorOptions,
            value: '',
            language: 'javascript'
        })
    };

    // Add controls and initialize
    addEditorControls();
    initializeControls();
    resizeEditors();

    // Add speech button after editors are initialized
    addSpeechButton();

    // Add CodePen button handler here, after editors are initialized
    const codepenBtn = document.querySelector('.codepen-btn');
    if (codepenBtn) {
        codepenBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('CodePen button clicked'); // Debug log
            exportToCodePen();
        });
    }
});

// Update the tab switching functionality
codeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        // Get the current active editor
        const currentEditor = document.querySelector('.editor.active');
        const newEditorType = tab.getAttribute('data-tab');
        const newEditor = document.querySelector(`.${newEditorType}-editor`);
        
        // Don't do anything if clicking the same tab
        if (currentEditor === newEditor) return;
        
        // Remove active class from all tabs
        codeTabs.forEach(t => t.classList.remove('active'));
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Animate out current editor
        if (currentEditor) {
            currentEditor.style.opacity = '0';
            currentEditor.style.transform = 'translateX(-20px)';
            currentEditor.style.visibility = 'hidden';
            currentEditor.classList.remove('active');
        }
        
        // Animate in new editor
        setTimeout(() => {
            newEditor.classList.add('active');
            newEditor.style.visibility = 'visible';
            newEditor.style.opacity = '1';
            newEditor.style.transform = 'translateX(0)';
            
            // Trigger a layout refresh for the visible editor
            if (monacoEditors[newEditorType]) {
                monacoEditors[newEditorType].layout();
            }
        }, 150); // Half of the transition time for smooth crossfade
    });
});

// Add these functions to handle chat messages
function addAIMessage(text) {
    const messagesContainer = document.querySelector('.chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addUserMessage(text) {
    const messagesContainer = document.querySelector('.chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update the prompt submission handler
const sendButton = document.querySelector('.send-button');

async function handlePromptSubmission() {
    const prompt = promptTextarea.value.trim();
    if (!prompt) return;
    
    // Show loading animation
    const loadingEl = document.querySelector('.code-loading');
    loadingEl.style.display = 'flex';
    
    try {
        const response = await generateCode(prompt);
        displayGeneratedCode(response);
    } catch (error) {
        console.error('Error:', error);
    } finally {
        // Hide loading animation
        loadingEl.style.display = 'none';
    }
    
    promptTextarea.value = '';
}

// Handle Enter key (with shift for new line)
promptTextarea.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handlePromptSubmission();
    }
});

// Handle send button click
sendButton.addEventListener('click', handlePromptSubmission);

// Function to call Gemini API
async function generateCode(prompt, currentCode = null) {
    // Create loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">Generating code...</div>
    `;
    document.querySelector('.code-editors').appendChild(loadingOverlay);
    
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`;
        
        // Get current code from editors
        const existingHTML = monacoEditors.html.getValue();
        const existingCSS = monacoEditors.css.getValue();
        const existingJS = monacoEditors.js.getValue();

        // Check if this is a modification request or new generation
        const isModification = existingHTML.trim() !== '' || existingCSS.trim() !== '' || existingJS.trim() !== '';

        let promptText = isModification ? 
            `Modify the following existing code according to this request: "${prompt}"

Current HTML code:
${existingHTML}

Current CSS code:
${existingCSS}

Current JavaScript code:
${existingJS}

Instructions:
1. Keep the existing code structure
2. Only modify what's needed to implement the requested changes
3. Keep all existing functionality
4. Add new features by modifying the existing code
5. Preserve existing styles and only add/modify what's needed
6. Keep existing JavaScript functions and add/modify as needed` :
            `Create a complete web application for: "${prompt}"

Instructions:
1. Create a complete, working web application
2. Include proper HTML structure
3. Add necessary CSS styles
4. Include required JavaScript functionality
5. Make the code clean and well-organized
6. Ensure all features are properly implemented`;

        promptText += `

Please provide the code using these EXACT markers:

---HTML---
[Code here]
---CSS---
[Code here]
---JavaScript---
[Code here]`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: promptText
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0]) {
            throw new Error('No response from API');
        }
        
        const generatedText = data.candidates[0].content.parts[0].text;
        
        // Extract code sections
        const sections = {
            html: generatedText.split('---HTML---')[1]?.split('---CSS---')[0]?.trim() || existingHTML,
            css: generatedText.split('---CSS---')[1]?.split('---JavaScript---')[0]?.trim() || existingCSS,
            js: generatedText.split('---JavaScript---')[1]?.trim() || existingJS
        };

        // Update editors
        if (monacoEditors.html) {
            monacoEditors.html.setValue(sections.html);
        }
        if (monacoEditors.css) {
            monacoEditors.css.setValue(sections.css);
        }
        if (monacoEditors.js) {
            monacoEditors.js.setValue(sections.js);
        }

        // Store for export
        window.completeCode = sections;

        return generatedText;

    } catch (error) {
        console.error('API Error:', error);
        return null;
    } finally {
        // Remove loading overlay with fade out animation
        loadingOverlay.style.opacity = '0';
        setTimeout(() => loadingOverlay.remove(), 300);
    }
}

// Function to display generated code in editors
function displayGeneratedCode(response) {
    if (!response) {
        console.error('No response to display');
        return;
    }

    try {
        // Extract code sections with better parsing
        const sections = {
            html: response.split('---HTML---')[1]?.split('---CSS---')[0]?.replace(/```html|```/g, '').trim() || '',
            css: response.split('---CSS---')[1]?.split('---JavaScript---')[0]?.replace(/```css|```/g, '').trim() || '',
            js: response.split('---JavaScript---')[1]?.replace(/```javascript|```/g, '').trim() || ''
        };

        // Update editors
        if (monacoEditors.html) {
            monacoEditors.html.setValue(sections.html);
        }
        if (monacoEditors.css) {
            monacoEditors.css.setValue(sections.css);
        }
        if (monacoEditors.js) {
            monacoEditors.js.setValue(sections.js);
        }

        // Store for export
        window.completeCode = sections;

    } catch (error) {
        console.error('Error parsing code:', error);
    }
}

// Add new function for code typing animation
function animateCode(editor, finalCode) {
    const lines = finalCode.split('\n');
    let currentLine = 0;
    let currentText = '';
    
    function typeNextLine() {
        if (currentLine < lines.length) {
            currentText += lines[currentLine] + '\n';
            editor.setValue(currentText);
            
            // Scroll to the current line
            const lineNumber = currentLine + 1;
            editor.revealLine(lineNumber);
            
            // Set cursor position
            editor.setPosition({ 
                lineNumber: lineNumber, 
                column: lines[currentLine].length + 1 
            });
            
            currentLine++;
            setTimeout(typeNextLine, 30); // Faster typing speed
        }
    }
    
    typeNextLine();
}

// Update the preview functionality
previewTab.addEventListener('click', () => {
    try {
        // Toggle active states
        previewTab.classList.add('active');
        codeTab.classList.remove('active');
        
        // Store current code
        window.storedCode = {
            html: monacoEditors.html.getValue(),
            css: monacoEditors.css.getValue(),
            js: monacoEditors.js.getValue()
        };
        
        // Create preview iframe with proper sizing
        const preview = document.createElement('iframe');
        preview.className = 'preview-iframe';
        preview.style.cssText = `
            width: 100%;
            height: calc(100vh - 110px);
            border: none;
            background-color: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        `;
        
        // Replace editors with preview
        const editorsContainer = document.querySelector('.code-editors');
        editorsContainer.innerHTML = '';
        editorsContainer.appendChild(preview);
        
        // Write content to iframe
        preview.contentDocument.open();
        preview.contentDocument.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>${window.storedCode.css}</style>
            </head>
            <body>
                ${window.storedCode.html}
                <script>${window.storedCode.js}</script>
            </body>
            </html>
        `);
        preview.contentDocument.close();
    } catch (error) {
        console.error('Preview Error:', error);
        showNotification('Error creating preview. Please try again.', 'error');
    }
});

// Return to code view
codeTab.addEventListener('click', () => {
    try {
        // Toggle active states
        codeTab.classList.add('active');
        previewTab.classList.remove('active');
        
        // Store the current code
        if (!window.storedCode) {
            window.storedCode = {
                html: monacoEditors.html?.getValue() || '',
                css: monacoEditors.css?.getValue() || '',
                js: monacoEditors.js?.getValue() || ''
            };
        }
        
        // Restore editors container with stored code
        const editorsContainer = document.querySelector('.code-editors');
        editorsContainer.innerHTML = `
            <div class="editor html-editor active" id="htmlEditor"></div>
            <div class="editor css-editor" id="cssEditor"></div>
            <div class="editor js-editor" id="jsEditor"></div>
            
            <!-- Add back the input container -->
            <div class="chat-input-container">
                <textarea placeholder="Enter your prompt here..." class="prompt-textarea"></textarea>
                <button class="send-button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M2.01 21L23 12L2.01 3L2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Initialize Monaco editors with stored code
        require(['vs/editor/editor.main'], function() {
            const editorOptions = {
                theme: 'vs-dark',
                minimap: { enabled: false },
                automaticLayout: true,
                fontSize: 14,
                lineHeight: 21,
                padding: { top: 10, bottom: 10 },
                scrollBeyondLastLine: false
            };

            // Create editors with stored code
            monacoEditors = {
                html: monaco.editor.create(document.getElementById('htmlEditor'), {
                    ...editorOptions,
                    value: window.storedCode.html,
                    language: 'html'
                }),
                css: monaco.editor.create(document.getElementById('cssEditor'), {
                    ...editorOptions,
                    value: window.storedCode.css,
                    language: 'css'
                }),
                js: monaco.editor.create(document.getElementById('jsEditor'), {
                    ...editorOptions,
                    value: window.storedCode.js,
                    language: 'javascript'
                })
            };

            // Make sure HTML editor is visible
            document.querySelector('.html-editor').classList.add('active');
            document.querySelector('[data-tab="html"]').classList.add('active');

            // Add controls and initialize
            addEditorControls();
            initializeControls();
            resizeEditors();

            // Update global references to the new elements
            window.promptTextarea = document.querySelector('.prompt-textarea');
            window.sendButton = document.querySelector('.send-button');

            // Reattach event listeners for the input box
            window.promptTextarea.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePromptSubmission();
                }
            });
            
            window.sendButton.addEventListener('click', handlePromptSubmission);

            // Ensure the code is visible by triggering a layout refresh
            setTimeout(() => {
                Object.values(monacoEditors).forEach(editor => {
                    editor.layout();
                });
            }, 100);
        });
    } catch (error) {
        console.error('Code View Error:', error);
    }
});

// Add this to prevent the rename widget from showing
window.addEventListener('load', () => {
    setTimeout(() => {
        const renameInputs = document.querySelectorAll('.rename-box');
        renameInputs.forEach(input => input.remove());
    }, 1000);
});

// Add error handling for Monaco editor initialization
window.addEventListener('error', function(e) {
    if (e.message === 'ResizeObserver loop limit exceeded') {
        e.stopPropagation();
        return false;
    }
}, true);

// Add these new variables at the top
let currentChat = {
    id: Date.now(),
    messages: []
};
let chats = [currentChat];

// Add this function to handle chat history
function addMessageToChat(prompt, response) {
    currentChat.messages.push({
        prompt,
        response,
        timestamp: Date.now()
    });
    updateChatList();
}

// Add function to update chat list in sidebar
function updateChatList() {
    const chatList = document.querySelector('.chat-list');
    chatList.innerHTML = '';
    
    chats.forEach(chat => {
        const firstPrompt = chat.messages[0]?.prompt || 'New Chat';
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === currentChat.id ? 'active' : ''}`;
        chatItem.innerHTML = `
            <img src="chat-icon.png" alt="Chat" class="chat-icon">
            <span class="chat-title">${firstPrompt.substring(0, 20)}${firstPrompt.length > 20 ? '...' : ''}</span>
        `;
        
        chatItem.addEventListener('click', () => {
            switchToChat(chat);
        });
        
        chatList.appendChild(chatItem);
    });
}

// Add function to switch between chats
function switchToChat(chat) {
    currentChat = chat;
    updateChatList();
    
    // Clear editors
    monacoEditors.html.setValue('');
    monacoEditors.css.setValue('');
    monacoEditors.js.setValue('');
    
    // Load last message if exists
    const lastMessage = chat.messages[chat.messages.length - 1];
    if (lastMessage) {
        displayGeneratedCode(lastMessage.response);
    }
}

// Update the new chat button functionality
document.querySelector('.new-chat-btn').addEventListener('click', () => {
    currentChat = {
        id: Date.now(),
        messages: []
    };
    chats.unshift(currentChat);
    updateChatList();
    
    // Clear editors
    monacoEditors.html.setValue('');
    monacoEditors.css.setValue('');
    monacoEditors.js.setValue('');
    promptTextarea.value = '';
});

// Add styles for chat messages
const style = document.createElement('style');
style.textContent = `
    .chat-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow-y: auto;
        max-height: calc(100vh - 200px);
    }

    .chat-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.3s ease;
    }

    .chat-item:hover {
        background-color: #2a2a2a;
    }

    .chat-item.active {
        background-color: #333;
    }

    .chat-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`;
document.head.appendChild(style);

// Initialize the chat list
updateChatList();

function addCodeBoxControls(codeBox) {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'code-controls';
    controlsContainer.innerHTML = `
        <div class="controls-wrapper">
            <button class="control-btn copy-btn" title="Copy Code">
                <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M16 1H4C3 1 2 2 2 3v14h2V3h12V1zm3 4H8C7 5 6 6 6 7v14c0 1 1 2 2 2h11c1 0 2-1 2-2V7c0-1-1-2-2-2zm0 16H8V7h11v14z"/>
                </svg>
            </button>
            <button class="control-btn share-btn" title="Share Code">
                <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                </svg>
            </button>
            <button class="control-btn download-btn" title="Download Code">
                <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
            </button>
        </div>
    `;

    // Add styles
    const styles = document.createElement('style');
    styles.textContent = `
        .code-controls {
            position: absolute;
            top: 0;
            right: 0;
            padding: 8px;
            background: linear-gradient(to left, var(--bg-color) 70%, transparent);
            border-radius: 0 4px 0 4px;
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.3s ease;
        }

        .code-box:hover .code-controls {
            opacity: 1;
            transform: translateY(0);
        }

        .controls-wrapper {
            display: flex;
            gap: 8px;
        }

        .control-btn {
            background: transparent;
            border: none;
            color: var(--text-color);
            padding: 4px;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s ease;
        }

        .control-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            transform: scale(1.1);
        }

        .control-btn:active {
            transform: scale(0.95);
        }

        .control-btn svg {
            display: block;
        }
    `;
    document.head.appendChild(styles);

    // Add event listeners
    const copyBtn = controlsContainer.querySelector('.copy-btn');
    const shareBtn = controlsContainer.querySelector('.share-btn');
    const downloadBtn = controlsContainer.querySelector('.download-btn');

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(codeBox.textContent);
            showNotification('Code copied to clipboard!');
        } catch (err) {
            showNotification('Failed to copy code', 'error');
        }
    });

    shareBtn.addEventListener('click', async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Share Code',
                    text: codeBox.textContent
                });
            } else {
                const shareUrl = createShareableUrl(codeBox.textContent);
                await navigator.clipboard.writeText(shareUrl);
                showNotification('Share link copied to clipboard!');
            }
        } catch (err) {
            showNotification('Failed to share code', 'error');
        }
    });

    downloadBtn.addEventListener('click', () => {
        const blob = new Blob([codeBox.textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'code.txt';
        a.click();
        URL.revokeObjectURL(url);
        showNotification('Code downloaded!');
    });

    codeBox.appendChild(controlsContainer);
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    const styles = document.createElement('style');
    styles.textContent = `
        .notification {
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 12px 24px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
            z-index: 1000;
        }

        .notification.success {
            background: #4caf50;
        }

        .notification.error {
            background: #f44336;
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes fadeOut {
            from {
                opacity: 1;
            }
            to {
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(styles);

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function createShareableUrl(code) {
    // You can implement your own sharing logic here
    // For example, using a service like GitHub Gist or Pastebin
    // For now, we'll just encode the code in the URL (not recommended for large code)
    return `${window.location.origin}?code=${encodeURIComponent(code)}`;
}

// Add the controls to each code box
document.querySelectorAll('.code-box').forEach(addCodeBoxControls);

// After the existing editor initialization code, add these new functions

function addEditorControls() {
    const controlsBar = document.createElement('div');
    controlsBar.className = 'editor-controls-bar';
    
    const group = document.createElement('div');
    group.className = 'control-group customize-group';
    
    group.innerHTML = `
        <div class="editor-controls">
            <div class="export-group">
                <div class="dropdown">
                    <button class="control-btn dropdown-toggle">
                        <svg width="16" height="16" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                        </svg>
                        Export
                    </button>
                    <div class="dropdown-menu">
                        <button class="dropdown-item" data-action="codepen">
                            <svg width="16" height="16" viewBox="0 0 24 24">
                                <path fill="currentColor" d="M12 2L2 8.5v7L12 22l10-6.5v-7L12 2zm0 4L8 8.5l4 2.5 4-2.5L12 6z"/>
                            </svg>
                            Open in CodePen
                        </button>
                    </div>
                </div>
            </div>
            <select class="theme-select">
                <option value="vs-dark">Dark Theme</option>
                <option value="vs-light">Light Theme</option>
                <option value="hc-black">High Contrast</option>
            </select>
            <select class="font-size-select">
                <option value="12">12px</option>
                <option value="14" selected>14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
                <option value="20">20px</option>
            </select>
        </div>
    `;
    
    controlsBar.appendChild(group);
    document.querySelector('.code-editors').prepend(controlsBar);
    
    // Add styles for the controls
    addControlStyles();
}

function addControlStyles() {
    const styles = document.createElement('style');
    styles.textContent = `
        .editor-controls-bar {
            display: flex;
            justify-content: flex-end;
            padding: 8px;
            background: #1e1e1e;
            border-bottom: 1px solid #333;
            position: absolute;
            top: 0;
            right: 24px;
            left: 24px;
            z-index: 10;
            border-radius: 12px 12px 0 0;
        }

        .editor-controls {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .export-group {
            display: flex;
            gap: 8px;
            position: relative;
        }

        .dropdown {
            position: relative;
        }

        .dropdown-toggle {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: #2d2d2d;
            border: 1px solid #404040;
            border-radius: 4px;
            color: #fff;
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s ease;
        }

        .dropdown-toggle:hover {
            background: #3d3d3d;
        }

        .dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            margin-top: 4px;
            background: #2d2d2d;
            border: 1px solid #404040;
            border-radius: 4px;
            min-width: 180px;
            display: none;
            z-index: 1000;
        }

        .dropdown:hover .dropdown-menu {
            display: block;
        }

        .dropdown-item {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 8px 12px;
            border: none;
            background: none;
            color: #fff;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.2s ease;
            text-align: left;
        }

        .dropdown-item:hover {
            background: #3d3d3d;
        }

        .theme-select,
        .font-size-select {
            padding: 6px 12px;
            background: #2d2d2d;
            border: 1px solid #404040;
            border-radius: 4px;
            color: #fff;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .theme-select:hover,
        .font-size-select:hover {
            background: #3d3d3d;
        }

        .customize-group {
            display: flex;
            gap: 8px;
        }
    `;
    
    document.head.appendChild(styles);
}

// Add event listeners for the controls
function initializeControls() {
    // Export actions for dropdown items
    document.querySelectorAll('.dropdown-item').forEach(btn => {
        btn.addEventListener('click', () => handleExportAction(btn.dataset.action));
    });

    // Theme changes
    document.querySelector('.theme-select').addEventListener('change', (e) => {
        Object.values(monacoEditors).forEach(editor => {
            monaco.editor.setTheme(e.target.value);
        });
    });

    // Font size changes
    document.querySelector('.font-size-select').addEventListener('change', (e) => {
        Object.values(monacoEditors).forEach(editor => {
            editor.updateOptions({ fontSize: parseInt(e.target.value) });
        });
    });

    // Create slide menu once
    const slideMenu = createSlideMenu();

    // Update menu button click handler
    document.querySelector('.menu-btn').addEventListener('click', () => {
        slideMenu.classList.add('active');
    });
}

// Update the handleExportAction function
async function handleExportAction(action) {
    try {
        const code = window.completeCode || {
            html: monacoEditors.html.getValue(),
            css: monacoEditors.css.getValue(),
            js: monacoEditors.js.getValue()
        };

        if (action === 'codepen') {
            exportToCodePen(code);
        }
    } catch (error) {
        console.error('Export error:', error);
    }
}

// Add this simple exportToCodePen function at the top level
function exportToCodePen() {
    // Get code from editors
    const html = monacoEditors.html.getValue();
    const css = monacoEditors.css.getValue();
    const js = monacoEditors.js.getValue();

    // Create form
    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';
    form.style.display = 'none';

    // Create input with proper data structure for CodePen
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({
        title: 'AI Generated Code',
        html: html,
        css: css,
        js: js
    });

    // Submit form
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}

// Remove all other CodePen-related code and just add this single event listener
window.addEventListener('load', () => {
    document.querySelector('.codepen-btn').addEventListener('click', function(e) {
        e.preventDefault();
        exportToCodePen();
    });
});

// Add this function to handle preview
function showPreview() {
    try {
        // Get current code
        const html = monacoEditors.html.getValue();
        const css = monacoEditors.css.getValue();
        const js = monacoEditors.js.getValue();
        
        // Create preview iframe
        const preview = document.createElement('iframe');
        preview.className = 'preview-iframe';
        
        // Replace editors with preview
        const editorsContainer = document.querySelector('.code-editors');
        const oldPreview = editorsContainer.querySelector('.preview-iframe');
        if (oldPreview) {
            oldPreview.remove();
        }
        
        editorsContainer.querySelectorAll('.editor').forEach(editor => {
            editor.style.display = 'none';
        });
        
        editorsContainer.appendChild(preview);
        
        // Write content to iframe
        preview.contentDocument.open();
        preview.contentDocument.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>${css}</style>
            </head>
            <body>
                ${html}
                <script>${js}<\/script>
            </body>
            </html>
        `);
        preview.contentDocument.close();
    } catch (error) {
        console.error('Preview Error:', error);
    }
}

// Add this function to return to code view
function hidePreview() {
    const editorsContainer = document.querySelector('.code-editors');
    const preview = editorsContainer.querySelector('.preview-iframe');
    if (preview) {
        preview.remove();
    }
    
    editorsContainer.querySelectorAll('.editor').forEach(editor => {
        if (editor.classList.contains('active')) {
            editor.style.display = 'block';
        }
    });
}

// Add click handler for preview button
window.addEventListener('load', () => {
    const previewBtn = document.querySelector('.preview-btn');
    let isPreviewMode = false;
    
    if (previewBtn) {
        previewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isPreviewMode) {
                showPreview();
                previewBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                    Code
                `;
            } else {
                hidePreview();
                previewBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                    </svg>
                    Preview
                `;
            }
            isPreviewMode = !isPreviewMode;
        });
    }
});

// Add this function to handle preview in new tab
function openPreviewInNewTab() {
    const html = monacoEditors.html.getValue();
    const css = monacoEditors.css.getValue();
    const js = monacoEditors.js.getValue();
    
    // Create a new window/tab with the preview content
    const previewWindow = window.open('', '_blank');
    
    // Write the content to the new window
    previewWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Preview</title>
            <style>${css}</style>
        </head>
        <body>
            ${html}
            <script>${js}<\/script>
        </body>
        </html>
    `);
    
    previewWindow.document.close();
}

// Add these functions after the existing code

function showExportOptions() {
    const modal = document.querySelector('.export-modal');
    modal.classList.add('active');
}

function closeExportModal() {
    const modal = document.querySelector('.export-modal');
    modal.classList.remove('active');
}

// Update the window load event listener to include click-outside handling for the export modal
window.addEventListener('load', () => {
    // ... existing code ...

    // Close export modal when clicking outside
    document.addEventListener('click', (e) => {
        const modal = document.querySelector('.export-modal');
        const modalContent = document.querySelector('.export-modal-content');
        const exportBtn = document.querySelector('.export-btn');
        
        if (modal.classList.contains('active') && 
            !modalContent.contains(e.target) && 
            !exportBtn.contains(e.target)) {
            modal.classList.remove('active');
        }
    });
});

// Make sure these functions exist
function exportToCodePen() {
    // Get code from editors
    const html = monacoEditors.html.getValue();
    const css = monacoEditors.css.getValue();
    const js = monacoEditors.js.getValue();

    // Create form
    const form = document.createElement('form');
    form.action = 'https://codepen.io/pen/define';
    form.method = 'POST';
    form.target = '_blank';
    form.style.display = 'none';

    // Create input with proper data structure for CodePen
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'data';
    input.value = JSON.stringify({
        title: 'AI Generated Code',
        html: html,
        css: css,
        js: js
    });

    // Submit form
    form.appendChild(input);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
    
    // Close the modal
    closeExportModal();
}

function exportIndividualFiles() {
    const files = {
        'index.html': monacoEditors.html.getValue(),
        'styles.css': monacoEditors.css.getValue(),
        'script.js': monacoEditors.js.getValue()
    };

    Object.entries(files).forEach(([filename, content]) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    closeExportModal();
    showNotification('Files downloaded successfully!');
}

function exportAsZip() {
    const zip = new JSZip();
    
    // Add files to zip
    zip.file("index.html", monacoEditors.html.getValue());
    zip.file("styles.css", monacoEditors.css.getValue());
    zip.file("script.js", monacoEditors.js.getValue());
    
    // Generate and download zip file
    zip.generateAsync({type: "blob"}).then(function(content) {
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "code.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        closeExportModal();
        showNotification('ZIP file downloaded successfully!');
    });
}