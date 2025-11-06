import { GoogleGenAI, Modality, Type } from "@google/genai";

// TypeScript को बताने के लिए कि Razorpay ग्लोबल स्कोप में मौजूद है
declare var Razorpay: any;

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// DOM Elements
const uploadArea = document.getElementById('upload-area') as HTMLDivElement;
const imageUpload = document.getElementById('image-upload') as HTMLInputElement;
const imagePreview = document.getElementById('image-preview') as HTMLImageElement;
const titleText = document.getElementById('title-text') as HTMLTextAreaElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const loadingDiv = document.getElementById('loading') as HTMLDivElement;
const errorDiv = document.getElementById('error') as HTMLDivElement;
const resultDiv = document.getElementById('result') as HTMLDivElement;
const thumbnailGrid = document.getElementById('thumbnail-grid') as HTMLDivElement;
const textResultDiv = document.getElementById('text-result') as HTMLDivElement;
const uploadPrompt = uploadArea.querySelector('p') as HTMLParagraphElement;

// Subscription Elements
const subscriptionModal = document.getElementById('subscription-modal') as HTMLDivElement;
const subscribeBtn = document.getElementById('subscribe-btn') as HTMLButtonElement;
const appContent = document.getElementById('app-content') as HTMLDivElement;


let uploadedFile: { file: File, dataUrl: string } | null = null;

// --- Subscription Logic ---

function checkSubscriptionStatus() {
    const subEndDateStr = localStorage.getItem('subscription_end_date');
    if (subEndDateStr) {
        const subEndDate = new Date(subEndDateStr);
        if (subEndDate > new Date()) {
            // Active subscription
            showApp();
        } else {
            // Expired subscription
            showSubscriptionModal();
        }
    } else {
        // No subscription
        showSubscriptionModal();
    }
}

function showApp() {
    subscriptionModal.style.display = 'none';
    appContent.style.display = 'block';
}

function showSubscriptionModal() {
    subscriptionModal.style.display = 'flex';
    appContent.style.display = 'none';
}

function handleSubscription() {
    // महत्वपूर्ण: यह आपकी Razorpay Live Key है। कृपया इसे सुरक्षित रखें।
    const razorpayKey = "rzp_live_RbxWdYwEIYhbje"; 

    // --- असली Razorpay लॉजिक ---
    const options = {
        "key": razorpayKey, 
        "amount": 20000, // राशि पैसे में (200 * 100)
        "currency": "INR",
        "name": "AI YouTube कंटेंट जेनरेटर",
        "description": "30-दिन का प्रीमियम पास",
        "handler": function (response: any) {
            // पेमेंट सफल होने पर यह फ़ंक्शन चलेगा
            alert('पेमेंट सफल रहा! Payment ID: ' + response.razorpay_payment_id);
            
            // 30-दिन का सब्सक्रिप्शन एक्टिवेट करें
            const now = new Date();
            now.setDate(now.getDate() + 30);
            localStorage.setItem('subscription_end_date', now.toISOString());
            
            showApp();
        },
        "prefill": {
            // आप चाहें तो यूज़र की जानकारी पहले से भर सकते हैं
            "name": "",
            "email": "",
            "contact": ""
        },
        "theme": {
            "color": "#ff007a"
        }
    };

    const rzp1 = new Razorpay(options);
    rzp1.on('payment.failed', function (response: any){
            alert('पेमेंट फेल हो गया। कृपया फिर से प्रयास करें। Error: ' + response.error.description);
    });
    rzp1.open();
}

// Initial check when the script loads
document.addEventListener('DOMContentLoaded', checkSubscriptionStatus);
subscribeBtn.addEventListener('click', handleSubscription);


// --- App Logic ---

// Event Listeners
uploadArea.addEventListener('click', () => imageUpload.click());
document.addEventListener('click', handleCopyClick);


imageUpload.addEventListener('change', (event) => {
    const files = (event.target as HTMLInputElement).files;
    if (files && files.length > 0) {
        const file = files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            uploadedFile = { file, dataUrl };
            imagePreview.src = dataUrl;
            imagePreview.style.display = 'block';
            uploadPrompt.style.display = 'none';
            updateButtonState();
        };
        reader.readAsDataURL(file);
    }
});

titleText.addEventListener('input', updateButtonState);

generateBtn.addEventListener('click', async () => {
    if (!uploadedFile || !titleText.value.trim()) {
        showError('कृपया एक इमेज अपलोड करें और टाइटल लिखें।');
        return;
    }

    setLoading(true);

    try {
        const imagePart = {
            inlineData: {
                mimeType: uploadedFile.file.type,
                data: uploadedFile.dataUrl.split(',')[1],
            },
        };
        const textInput = titleText.value.trim();

        // --- Promise for Title, Description, and Hashtags (Enhanced for SEO) ---
        const textContentPrompt = `Act as a YouTube SEO expert. Based on the provided image and the user's video idea "${textInput}", create a complete, SEO-optimized content package for a YouTube video. Your response must be a JSON object with the keys "title", "description", and "hashtags".

- "title": Craft a highly clickable, SEO-friendly title in Hindi or Hinglish. It should be compelling and include relevant keywords that people would search for.
- "description": Write a detailed, well-structured video description in Hindi or Hinglish. It must be at least 3 paragraphs long.
    - Start with a compelling hook that repeats the main keywords from the title.
    - Include a detailed summary of the video's content.
    - Add timestamps (e.g., "00:00 - Introduction") if applicable.
    - Include links to social media (use placeholders like "[Your Instagram Link]").
    - End with a call to action (e.g., "Like, Share, Subscribe").
- "hashtags": Provide a string of at least 10 relevant and trending hashtags, including both broad and specific terms. Separate them with spaces (e.g., "#YouTubeSEO #VideoMarketing #DigitalCreator").`;
        
        const textContentPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, {text: textContentPrompt}]},
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        hashtags: { type: Type.STRING },
                    },
                },
            },
        });

        // --- Promises for Thumbnails ---
        const thumbnailPromises = [];
        for (let i = 0; i < 4; i++) {
            const thumbnailPrompt = `Create a visually stunning, 3D-style, clickbait YouTube thumbnail for a video titled "${textInput}". Use the provided image as a central element. The design should be vibrant, professional, and eye-catching, with bold, readable text. Ensure the final image has a 16:9 aspect ratio, perfect for YouTube. Variation ${i + 1}.`;
            const promise = ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [imagePart, { text: thumbnailPrompt }] },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
            thumbnailPromises.push(promise);
        }
        
        // --- Await all promises ---
        loadingDiv.textContent = 'AI सोच रहा है... टाइटल, डिस्क्रिप्शन और थंबनेल बन रहे हैं...';
        const [textContentResponse, ...thumbnailResponses] = await Promise.all([textContentPromise, ...thumbnailPromises]);

        // --- Process and display results ---
        const textContent = JSON.parse(textContentResponse.text);
        showTextResults(textContent.title, textContent.description, textContent.hashtags);
        
        const generatedImages = thumbnailResponses.map(response => {
            const part = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
            return part ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : null;
        }).filter(Boolean) as string[];

        showThumbnailResults(generatedImages);

    } catch (err) {
        console.error(err);
        showError('कुछ गलत हो गया। कृपया बाद में फिर से प्रयास करें।');
    } finally {
        setLoading(false);
    }
});

// Helper Functions
function updateButtonState() {
    generateBtn.disabled = !uploadedFile || !titleText.value.trim();
}

function setLoading(isLoading: boolean) {
    if (isLoading) {
        loadingDiv.style.display = 'block';
        loadingDiv.textContent = 'AI सोच रहा है...';
        errorDiv.style.display = 'none';
        resultDiv.style.display = 'none';
        textResultDiv.style.display = 'none';
        thumbnailGrid.innerHTML = '';
    } else {
        loadingDiv.style.display = 'none';
    }
}

function showError(message: string) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function showThumbnailResults(images: string[]) {
    thumbnailGrid.innerHTML = '';
    if (images.length === 0) return;

    images.forEach((imageUrl, index) => {
        const container = document.createElement('div');
        container.className = 'thumbnail-container';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = `Generated Thumbnail ${index + 1}`;

        const downloadLink = document.createElement('a');
        downloadLink.href = imageUrl;
        downloadLink.download = `thumbnail_${index + 1}.png`;
        downloadLink.className = 'download-btn';
        downloadLink.textContent = 'डाउनलोड करें';

        container.appendChild(img);
        container.appendChild(downloadLink);
        thumbnailGrid.appendChild(container);
    });
    resultDiv.style.display = 'block';
}

function showTextResults(title: string, description: string, hashtags: string) {
    document.getElementById('generated-title')!.textContent = title;
    document.getElementById('generated-description')!.textContent = description;
    document.getElementById('generated-hashtags')!.textContent = hashtags;
    textResultDiv.style.display = 'block';
}

function handleCopyClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.classList.contains('copy-btn')) {
        const targetId = target.dataset.target;
        if (targetId) {
            const elementToCopy = document.getElementById(targetId);
            if (elementToCopy) {
                navigator.clipboard.writeText(elementToCopy.textContent || '').then(() => {
                    const originalText = target.textContent;
                    target.textContent = 'कॉपी हुआ!';
                    setTimeout(() => {
                        target.textContent = originalText;
                    }, 2000);
                });
            }
        }
    }
}