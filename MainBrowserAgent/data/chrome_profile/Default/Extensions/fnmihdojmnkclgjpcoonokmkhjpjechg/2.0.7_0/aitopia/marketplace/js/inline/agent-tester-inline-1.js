const BASE_URL = window.__AITOPIA_DOMAIN__ || 'https://aitopia.ai';
    let ws = null;
    let selectedAgent = null;
    let agents = [];
    let currentJobId = null;
    let uploadedImages = {};
    let activeCategory = 'all';

    // Comprehensive agent form configurations for all 33 agents
    const agentForms = {
      // =====================================================================
      // MULERUN AGENTS (13)
      // =====================================================================
      'smart-data-analyzer': {
        title: 'Smart Data Analyzer',
        fields: [
          { name: 'data', type: 'textarea', label: 'Data to Analyze', placeholder: 'Enter JSON array, CSV data, or numbers separated by commas...', required: true, rows: 6 },
          { name: 'analysisType', type: 'select', label: 'Analysis Type', options: ['summary', 'trends', 'anomalies', 'correlations', 'statistics'], default: 'summary' },
          { name: 'format', type: 'select', label: 'Output Format', options: ['json', 'text', 'markdown'] }
        ]
      },
      'virtual-try-on': {
        title: 'Virtual Try-On',
        fields: [
          { name: 'personImage', type: 'image', label: 'Person Photo', hint: 'Upload a full-body or upper-body photo of the person', required: true },
          { name: 'garmentImage', type: 'image', label: 'Garment Image', hint: 'Upload the clothing item to try on', required: true },
          { name: 'garmentType', type: 'select', label: 'Garment Type', options: ['upper_body', 'lower_body', 'full_body', 'dress'], default: 'upper_body' }
        ]
      },
      'ai-background-generator': {
        title: 'AI Background Generator',
        fields: [
          { name: 'productImage', type: 'image', label: 'Product Image', hint: 'Upload the product photo to add background to', required: true },
          { name: 'backgroundStyle', type: 'select', label: 'Background Style', options: ['studio', 'lifestyle', 'outdoor', 'minimalist', 'luxury', 'nature', 'urban'], required: true },
          { name: 'backgroundPrompt', type: 'textarea', label: 'Custom Background Description', placeholder: 'Optional: Describe the specific background you want...' },
          { name: 'lighting', type: 'select', label: 'Lighting', options: ['natural', 'studio', 'dramatic', 'soft', 'golden_hour'] }
        ]
      },
      'product-description-writer': {
        title: 'Product Description Writer',
        fields: [
          { name: 'productName', type: 'text', label: 'Product Name', placeholder: 'e.g., Premium Wireless Headphones', required: true },
          { name: 'productCategory', type: 'text', label: 'Category', placeholder: 'e.g., Electronics, Fashion, Home' },
          { name: 'features', type: 'textarea', label: 'Key Features', placeholder: 'List the main features (one per line or comma-separated)', required: true },
          { name: 'targetAudience', type: 'text', label: 'Target Audience', placeholder: 'e.g., Tech enthusiasts, Fitness lovers' },
          { name: 'tone', type: 'select', label: 'Tone', options: ['professional', 'casual', 'luxury', 'playful', 'technical', 'friendly'] }
        ]
      },
      'pro-headshot-generator': {
        title: 'Pro Headshot Generator',
        fields: [
          { name: 'sourceImage', type: 'image', label: 'Source Photo', hint: 'Upload a clear face photo to transform into a professional headshot', required: true },
          { name: 'style', type: 'select', label: 'Headshot Style', options: ['corporate', 'creative', 'casual', 'executive', 'startup'], required: true },
          { name: 'background', type: 'select', label: 'Background', options: ['studio_gray', 'studio_white', 'studio_blue', 'gradient', 'office_blur'] },
          { name: 'lighting', type: 'select', label: 'Lighting Style', options: ['natural', 'studio', 'rembrandt', 'butterfly', 'soft'] },
          { name: 'retouchingLevel', type: 'slider', label: 'Retouching Level', min: 0, max: 100, default: 50, hint: '0 = Natural, 100 = Polished' }
        ]
      },
      'resume-builder': {
        title: 'Resume Builder',
        fields: [
          { name: 'fullName', type: 'text', label: 'Full Name', required: true },
          { name: 'email', type: 'text', label: 'Email', required: true },
          { name: 'phone', type: 'text', label: 'Phone Number' },
          { name: 'targetRole', type: 'text', label: 'Target Job Title', placeholder: 'e.g., Senior Software Engineer', required: true },
          { name: 'experience', type: 'textarea', label: 'Work Experience', placeholder: 'List your work experience...', rows: 5 },
          { name: 'education', type: 'textarea', label: 'Education', placeholder: 'List your education background...' },
          { name: 'skills', type: 'textarea', label: 'Skills', placeholder: 'List your key skills (comma-separated)' }
        ]
      },
      'meeting-transcriber': {
        title: 'Meeting Transcriber',
        fields: [
          { name: 'audioFile', type: 'audio', label: 'Audio File', hint: 'Upload the meeting recording (MP3, WAV, M4A)', required: true },
          { name: 'audioUrl', type: 'text', label: 'Or Audio URL', placeholder: 'https://... (alternative to file upload)' },
          { name: 'language', type: 'select', label: 'Language', options: ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'] },
          { name: 'speakerDiarization', type: 'checkbox', label: 'Enable Speaker Detection', default: true },
          { name: 'summaryFormat', type: 'select', label: 'Summary Format', options: ['bullet_points', 'paragraph', 'action_items', 'full_transcript'] }
        ]
      },
      'email-template-generator': {
        title: 'Email Template Generator',
        fields: [
          { name: 'purpose', type: 'select', label: 'Email Purpose', options: ['welcome', 'newsletter', 'promotion', 'notification', 'follow_up', 'thank_you', 'announcement', 'invitation'], required: true },
          { name: 'businessName', type: 'text', label: 'Business/Brand Name', placeholder: 'e.g., Acme Inc.' },
          { name: 'tone', type: 'select', label: 'Tone', options: ['professional', 'friendly', 'formal', 'casual', 'enthusiastic'] },
          { name: 'keyMessage', type: 'textarea', label: 'Key Message', placeholder: 'What is the main message you want to convey?', required: true }
        ]
      },
      'seo-content-optimizer': {
        title: 'SEO Content Optimizer',
        fields: [
          { name: 'content', type: 'textarea', label: 'Content to Optimize', placeholder: 'Paste your article, blog post, or page content here...', required: true, rows: 8 },
          { name: 'targetKeywords', type: 'text', label: 'Target Keywords', placeholder: 'keyword1, keyword2, keyword3', required: true },
          { name: 'contentType', type: 'select', label: 'Content Type', options: ['blog_post', 'product_page', 'landing_page', 'article', 'homepage'] },
          { name: 'targetLength', type: 'select', label: 'Target Length', options: ['short (500 words)', 'medium (1000 words)', 'long (2000+ words)'] }
        ]
      },
      'social-media-caption-generator': {
        title: 'Social Media Caption Generator',
        fields: [
          { name: 'platform', type: 'select', label: 'Platform', options: ['instagram', 'twitter', 'linkedin', 'facebook', 'tiktok', 'threads'], required: true },
          { name: 'topic', type: 'text', label: 'Topic / Product', placeholder: 'What is this post about?', required: true },
          { name: 'contentImage', type: 'image', label: 'Post Image (Optional)', hint: 'Upload the image for context-aware captions' },
          { name: 'tone', type: 'select', label: 'Tone', options: ['professional', 'casual', 'humorous', 'inspirational', 'educational', 'promotional'] },
          { name: 'includeHashtags', type: 'checkbox', label: 'Include Hashtags', default: true },
          { name: 'includeEmojis', type: 'checkbox', label: 'Include Emojis', default: true },
          { name: 'captionCount', type: 'select', label: 'Number of Variations', options: ['1', '3', '5'] }
        ]
      },
      'image-translator': {
        title: 'Image Translator',
        fields: [
          { name: 'sourceImage', type: 'image', label: 'Image with Text', hint: 'Upload an image containing text to translate', required: true },
          { name: 'targetLanguage', type: 'select', label: 'Target Language', options: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh', 'ar', 'ru', 'hi', 'tr'], required: true },
          { name: 'sourceLanguage', type: 'select', label: 'Source Language', options: ['auto', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'] },
          { name: 'preserveLayout', type: 'checkbox', label: 'Preserve Original Layout', default: true },
          { name: 'outputFormat', type: 'select', label: 'Output Format', options: ['text_overlay', 'text_only', 'json'] }
        ]
      },
      'video-script-generator': {
        title: 'Video Script Generator',
        fields: [
          { name: 'topic', type: 'text', label: 'Video Topic', placeholder: 'What is the video about?', required: true },
          { name: 'duration', type: 'select', label: 'Target Duration', options: ['30 seconds', '1 minute', '2-3 minutes', '5-10 minutes', '15+ minutes'], required: true },
          { name: 'platform', type: 'select', label: 'Platform', options: ['youtube', 'tiktok', 'instagram_reels', 'linkedin', 'corporate', 'podcast'] },
          { name: 'style', type: 'select', label: 'Video Style', options: ['educational', 'entertaining', 'promotional', 'documentary', 'tutorial', 'vlog'] },
          { name: 'targetAudience', type: 'text', label: 'Target Audience', placeholder: 'e.g., Beginners, Professionals, Teens' }
        ]
      },
      'customer-support-bot': {
        title: 'Customer Support Bot',
        fields: [
          { name: 'query', type: 'textarea', label: 'Customer Query', placeholder: 'Enter the customer question or issue...', required: true },
          { name: 'businessContext', type: 'textarea', label: 'Business Context', placeholder: 'Describe your business, products, or services for better responses...' },
          { name: 'tone', type: 'select', label: 'Response Tone', options: ['professional', 'friendly', 'empathetic', 'technical', 'casual'] },
          { name: 'includeFollowUp', type: 'checkbox', label: 'Include Follow-up Questions', default: true }
        ]
      },

      // =====================================================================
      // HIGGSFIELD IMAGE AGENTS (11)
      // =====================================================================
      'image-generator': {
        title: 'AI Image Generator',
        fields: [
          { name: 'prompt', type: 'textarea', label: 'Image Description', placeholder: 'Describe the image you want to generate in detail...', required: true, rows: 4 },
          { name: 'negativePrompt', type: 'textarea', label: 'Negative Prompt', placeholder: 'Things to avoid in the image...' },
          { name: 'style', type: 'select', label: 'Style', options: ['photorealistic', 'artistic', 'anime', '3d_render', 'digital_art', 'oil_painting', 'watercolor', 'sketch'] },
          { name: 'aspectRatio', type: 'select', label: 'Aspect Ratio', options: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'] },
          { name: 'quality', type: 'select', label: 'Quality', options: ['standard', 'hd', '4k'] },
          { name: 'count', type: 'select', label: 'Number of Images', options: ['1', '2', '4'] }
        ]
      },
      'headshot-generator': {
        title: 'AI Headshot Generator',
        fields: [
          { name: 'sourceImage', type: 'image', label: 'Source Photo', hint: 'Upload a face photo to generate professional headshots', required: true },
          { name: 'style', type: 'select', label: 'Style', options: ['corporate', 'creative', 'casual', 'executive', 'linkedin', 'actor'], required: true },
          { name: 'background', type: 'select', label: 'Background', options: ['studio_white', 'studio_gray', 'gradient_blue', 'gradient_purple', 'office', 'outdoor'] },
          { name: 'expression', type: 'select', label: 'Expression', options: ['friendly_smile', 'confident', 'approachable', 'serious', 'natural'] },
          { name: 'count', type: 'select', label: 'Number of Variations', options: ['1', '3', '5', '10'] }
        ]
      },
      'character-creator': {
        title: 'Character Creator',
        fields: [
          { name: 'characterName', type: 'text', label: 'Character Name', required: true },
          { name: 'description', type: 'textarea', label: 'Character Description', placeholder: 'Describe the character appearance, personality, etc.', required: true },
          { name: 'style', type: 'select', label: 'Art Style', options: ['realistic', 'anime', 'cartoon', 'fantasy', 'sci-fi', 'chibi', 'comic'] },
          { name: 'gender', type: 'select', label: 'Gender', options: ['male', 'female', 'non-binary', 'other'] },
          { name: 'age', type: 'select', label: 'Age Range', options: ['child', 'teen', 'young_adult', 'adult', 'elderly'] },
          { name: 'pose', type: 'select', label: 'Pose', options: ['portrait', 'full_body', 'action', 'sitting', 'walking'] }
        ]
      },
      'image-upscaler': {
        title: 'Image Upscaler',
        fields: [
          { name: 'sourceImage', type: 'image', label: 'Image to Upscale', hint: 'Upload a low-resolution image to enhance', required: true },
          { name: 'scaleFactor', type: 'select', label: 'Scale Factor', options: ['2x', '4x', '8x'], default: '2x' },
          { name: 'denoise', type: 'slider', label: 'Denoise Strength', min: 0, max: 100, default: 30 },
          { name: 'sharpening', type: 'slider', label: 'Sharpening', min: 0, max: 100, default: 50 },
          { name: 'faceEnhance', type: 'checkbox', label: 'Enhance Faces', default: true }
        ]
      },
      'object-remover': {
        title: 'Object Remover',
        fields: [
          { name: 'sourceImage', type: 'image', label: 'Source Image', hint: 'Upload the image with objects to remove', required: true },
          { name: 'maskImage', type: 'image', label: 'Mask Image (Optional)', hint: 'Upload a mask where white areas indicate objects to remove' },
          { name: 'objectDescription', type: 'text', label: 'Object to Remove', placeholder: 'Describe what to remove (e.g., "person on the left", "watermark")' },
          { name: 'fillMethod', type: 'select', label: 'Fill Method', options: ['ai_inpaint', 'content_aware', 'blur', 'solid_color'] }
        ]
      },
      'style-transfer': {
        title: 'Style Transfer',
        fields: [
          { name: 'contentImage', type: 'image', label: 'Content Image', hint: 'Upload the image to apply style to', required: true },
          { name: 'styleImage', type: 'image', label: 'Style Reference (Optional)', hint: 'Upload an image whose style you want to apply' },
          { name: 'styleName', type: 'select', label: 'Or Choose a Style', options: ['none', 'van_gogh', 'monet', 'picasso', 'anime', 'comic', 'watercolor', 'oil_painting', 'sketch', 'pop_art'] },
          { name: 'styleStrength', type: 'slider', label: 'Style Strength', min: 0, max: 100, default: 75 },
          { name: 'preserveColor', type: 'checkbox', label: 'Preserve Original Colors' }
        ]
      },
      'background-replacer': {
        title: 'Background Replacer',
        fields: [
          { name: 'sourceImage', type: 'image', label: 'Source Image', hint: 'Upload image with subject to extract', required: true },
          { name: 'backgroundImage', type: 'image', label: 'New Background Image (Optional)', hint: 'Upload custom background image' },
          { name: 'backgroundType', type: 'select', label: 'Or Choose Background', options: ['transparent', 'solid_white', 'solid_black', 'gradient', 'office', 'outdoor', 'studio', 'beach', 'city'] },
          { name: 'backgroundColor', type: 'text', label: 'Custom Color (Hex)', placeholder: '#FFFFFF' },
          { name: 'edgeRefinement', type: 'slider', label: 'Edge Refinement', min: 0, max: 100, default: 50 },
          { name: 'addShadow', type: 'checkbox', label: 'Add Natural Shadow', default: true }
        ]
      },
      'scene-generator': {
        title: 'Scene Generator',
        fields: [
          { name: 'sceneDescription', type: 'textarea', label: 'Scene Description', placeholder: 'Describe the scene you want to create...', required: true },
          { name: 'setting', type: 'select', label: 'Setting', options: ['indoor', 'outdoor', 'urban', 'nature', 'fantasy', 'sci-fi', 'underwater', 'space'] },
          { name: 'timeOfDay', type: 'select', label: 'Time of Day', options: ['dawn', 'morning', 'noon', 'afternoon', 'sunset', 'dusk', 'night'] },
          { name: 'weather', type: 'select', label: 'Weather', options: ['clear', 'cloudy', 'rainy', 'snowy', 'foggy', 'stormy'] },
          { name: 'mood', type: 'select', label: 'Mood', options: ['peaceful', 'dramatic', 'mysterious', 'cheerful', 'melancholic', 'epic'] },
          { name: 'cameraAngle', type: 'select', label: 'Camera Angle', options: ['eye_level', 'low_angle', 'high_angle', 'birds_eye', 'dutch_angle'] }
        ]
      },
      'product-photographer': {
        title: 'AI Product Photographer',
        fields: [
          { name: 'productImage', type: 'image', label: 'Product Image', hint: 'Upload a product photo (preferably with transparent or simple background)', required: true },
          { name: 'shootStyle', type: 'select', label: 'Shoot Style', options: ['hero_shot', 'lifestyle', 'flat_lay', '360_view', 'macro', 'in_context'], required: true },
          { name: 'background', type: 'select', label: 'Background', options: ['white', 'gradient', 'lifestyle', 'studio', 'contextual', 'transparent'] },
          { name: 'lighting', type: 'select', label: 'Lighting', options: ['soft_box', 'natural', 'dramatic', 'product_studio', 'golden_hour'] },
          { name: 'angle', type: 'select', label: 'Camera Angle', options: ['front', '45_degree', 'side', 'top_down', 'hero_angle'] },
          { name: 'props', type: 'text', label: 'Props/Context', placeholder: 'e.g., coffee beans, plants, lifestyle setting' }
        ]
      },
      'portrait-enhancer': {
        title: 'Portrait Enhancer',
        fields: [
          { name: 'portraitImage', type: 'image', label: 'Portrait Photo', hint: 'Upload a portrait to enhance', required: true },
          { name: 'skinSmoothing', type: 'slider', label: 'Skin Smoothing', min: 0, max: 100, default: 40 },
          { name: 'eyeEnhancement', type: 'slider', label: 'Eye Enhancement', min: 0, max: 100, default: 30 },
          { name: 'teethWhitening', type: 'slider', label: 'Teeth Whitening', min: 0, max: 100, default: 20 },
          { name: 'blemishRemoval', type: 'checkbox', label: 'Remove Blemishes', default: true },
          { name: 'facialContouring', type: 'select', label: 'Facial Contouring', options: ['none', 'subtle', 'moderate'] },
          { name: 'colorGrading', type: 'select', label: 'Color Grading', options: ['natural', 'warm', 'cool', 'vibrant', 'film'] }
        ]
      },
      'sketch-to-image': {
        title: 'Sketch to Image',
        fields: [
          { name: 'sketchImage', type: 'image', label: 'Sketch / Drawing', hint: 'Upload your sketch or line drawing', required: true },
          { name: 'outputStyle', type: 'select', label: 'Output Style', options: ['photorealistic', 'illustration', 'anime', 'oil_painting', 'watercolor', '3d_render'], required: true },
          { name: 'colorScheme', type: 'select', label: 'Color Scheme', options: ['ai_suggested', 'vibrant', 'pastel', 'monochrome', 'warm', 'cool'] },
          { name: 'detailLevel', type: 'select', label: 'Detail Level', options: ['low', 'medium', 'high', 'ultra'] },
          { name: 'additionalPrompt', type: 'textarea', label: 'Additional Details', placeholder: 'Add more context about what the sketch represents...' }
        ]
      },

      // =====================================================================
      // HIGGSFIELD VIDEO AGENTS (6)
      // =====================================================================
      'video-generator': {
        title: 'AI Video Generator',
        fields: [
          { name: 'prompt', type: 'textarea', label: 'Video Description', placeholder: 'Describe the video you want to generate...', required: true },
          { name: 'referenceImage', type: 'image', label: 'Reference Image (Optional)', hint: 'Upload an image to base the video on' },
          { name: 'duration', type: 'select', label: 'Duration', options: ['4 seconds', '8 seconds', '16 seconds'], required: true },
          { name: 'aspectRatio', type: 'select', label: 'Aspect Ratio', options: ['16:9', '9:16', '1:1'] },
          { name: 'style', type: 'select', label: 'Style', options: ['cinematic', 'documentary', 'commercial', 'artistic', 'anime'] },
          { name: 'cameraMotion', type: 'select', label: 'Camera Motion', options: ['static', 'pan_left', 'pan_right', 'zoom_in', 'zoom_out', 'orbit', 'dolly'] }
        ]
      },
      'face-swap-video': {
        title: 'Face Swap Video',
        fields: [
          { name: 'targetVideo', type: 'video', label: 'Target Video', hint: 'Upload the video where face will be replaced', required: true },
          { name: 'targetVideoUrl', type: 'text', label: 'Or Video URL', placeholder: 'https://...' },
          { name: 'faceImage', type: 'image', label: 'Face Image', hint: 'Upload the face to swap in', required: true },
          { name: 'consentConfirmed', type: 'checkbox', label: 'I confirm I have consent from all parties', required: true },
          { name: 'addWatermark', type: 'checkbox', label: 'Add AI-generated watermark', default: true }
        ]
      },
      'lip-sync': {
        title: 'Lip Sync Video',
        fields: [
          { name: 'videoFile', type: 'video', label: 'Video File', hint: 'Upload video with face to lip-sync', required: true },
          { name: 'videoUrl', type: 'text', label: 'Or Video URL', placeholder: 'https://...' },
          { name: 'audioFile', type: 'audio', label: 'Audio File', hint: 'Upload the audio to sync lips to', required: true },
          { name: 'audioUrl', type: 'text', label: 'Or Audio URL', placeholder: 'https://...' },
          { name: 'syncQuality', type: 'select', label: 'Sync Quality', options: ['fast', 'standard', 'high'] }
        ]
      },
      'talking-avatar': {
        title: 'Talking Avatar',
        fields: [
          { name: 'avatarImage', type: 'image', label: 'Avatar Image', hint: 'Upload a face photo or illustrated avatar', required: true },
          { name: 'script', type: 'textarea', label: 'Script to Speak', placeholder: 'Enter the text for the avatar to speak...', required: true, rows: 5 },
          { name: 'voiceStyle', type: 'select', label: 'Voice Style', options: ['professional', 'casual', 'energetic', 'calm', 'friendly'] },
          { name: 'language', type: 'select', label: 'Language', options: ['en-US', 'en-GB', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'] },
          { name: 'avatarStyle', type: 'select', label: 'Avatar Style', options: ['realistic', 'stylized', 'cartoon'] },
          { name: 'expressiveness', type: 'slider', label: 'Expressiveness', min: 0, max: 100, default: 50 }
        ]
      },
      'image-animator': {
        title: 'Image Animator',
        fields: [
          { name: 'sourceImage', type: 'image', label: 'Image to Animate', hint: 'Upload a static image to bring to life', required: true },
          { name: 'motionType', type: 'select', label: 'Motion Type', options: ['subtle', 'zoom_pan', 'parallax', '3d_rotation', 'cinemagraph'], required: true },
          { name: 'duration', type: 'select', label: 'Duration', options: ['2 seconds', '4 seconds', '6 seconds', '10 seconds'] },
          { name: 'loop', type: 'checkbox', label: 'Loop Animation', default: true },
          { name: 'motionStrength', type: 'slider', label: 'Motion Strength', min: 0, max: 100, default: 50 }
        ]
      },
      'video-upscaler': {
        title: 'Video Upscaler',
        fields: [
          { name: 'videoFile', type: 'video', label: 'Video to Upscale', hint: 'Upload a low-resolution video', required: true },
          { name: 'videoUrl', type: 'text', label: 'Or Video URL', placeholder: 'https://...' },
          { name: 'targetResolution', type: 'select', label: 'Target Resolution', options: ['720p', '1080p', '4K'], required: true },
          { name: 'frameInterpolation', type: 'select', label: 'Frame Interpolation', options: ['none', '2x', '4x'] },
          { name: 'denoising', type: 'slider', label: 'Denoising', min: 0, max: 100, default: 30 },
          { name: 'sharpening', type: 'slider', label: 'Sharpening', min: 0, max: 100, default: 40 }
        ]
      },

      // =====================================================================
      // HIGGSFIELD AUDIO AGENTS (2)
      // =====================================================================
      'music-generator': {
        title: 'AI Music Generator',
        fields: [
          { name: 'prompt', type: 'textarea', label: 'Music Description', placeholder: 'Describe the music you want (genre, mood, instruments, etc.)', required: true },
          { name: 'genre', type: 'select', label: 'Genre', options: ['ambient', 'electronic', 'cinematic', 'pop', 'rock', 'jazz', 'classical', 'hip-hop', 'lofi'] },
          { name: 'mood', type: 'select', label: 'Mood', options: ['happy', 'sad', 'energetic', 'calm', 'mysterious', 'epic', 'romantic', 'tense'] },
          { name: 'duration', type: 'select', label: 'Duration', options: ['15 seconds', '30 seconds', '60 seconds', '2 minutes', '3 minutes'] },
          { name: 'tempo', type: 'select', label: 'Tempo', options: ['slow (60-80 BPM)', 'medium (80-120 BPM)', 'fast (120-160 BPM)', 'very fast (160+ BPM)'] },
          { name: 'instruments', type: 'text', label: 'Instruments', placeholder: 'e.g., piano, strings, drums, synth' }
        ]
      },
      'voice-cloner': {
        title: 'Voice Cloner',
        fields: [
          { name: 'voiceSample', type: 'audio', label: 'Voice Sample', hint: 'Upload a clear audio sample of the voice to clone (10-60 seconds)', required: true },
          { name: 'voiceSampleUrl', type: 'text', label: 'Or Audio URL', placeholder: 'https://...' },
          { name: 'textToSpeak', type: 'textarea', label: 'Text to Speak', placeholder: 'Enter the text to generate with the cloned voice...', required: true, rows: 5 },
          { name: 'stability', type: 'slider', label: 'Voice Stability', min: 0, max: 100, default: 75 },
          { name: 'similarity', type: 'slider', label: 'Similarity Boost', min: 0, max: 100, default: 75 },
          { name: 'consentConfirmed', type: 'checkbox', label: 'I confirm I have consent to clone this voice', required: true }
        ]
      },

      // =====================================================================
      // HIGGSFIELD AI ASSISTANT (1)
      // =====================================================================
      'ai-assistant': {
        title: 'AI Multi-Agent Assistant',
        fields: [
          { name: 'query', type: 'textarea', label: 'Your Request', placeholder: 'Describe what you want to accomplish (the AI will plan and execute using multiple agents)', required: true, rows: 5 },
          { name: 'context', type: 'textarea', label: 'Additional Context', placeholder: 'Any additional information that might help...' },
          { name: 'priority', type: 'select', label: 'Priority', options: ['speed', 'quality', 'cost_effective'] },
          { name: 'maxAgents', type: 'select', label: 'Max Agents to Use', options: ['1', '3', '5', 'auto'] }
        ]
      }
    };

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      checkServerStatus();
      connectWebSocket();
      loadAgents();
      setInterval(checkServerStatus, 30000);
    });

    async function checkServerStatus() {
      try {
        const res = await fetch(`${BASE_URL}/health`);
        const data = await res.json();
        document.getElementById('serverStatus')?.classList.remove('disconnected');
        const sst = document.getElementById('serverStatusText');
        if (sst) sst.textContent = `Server: ${data.status}`;
      } catch (e) {
        document.getElementById('serverStatus')?.classList.add('disconnected');
        const sst = document.getElementById('serverStatusText');
        if (sst) sst.textContent = 'Server: Offline';
      }
    }

    function connectWebSocket() {
      try {
        ws = new WebSocket(`ws://${window.location.host}/ws`);
        ws.onopen = () => {
          document.getElementById('wsStatus')?.classList.remove('disconnected');
          const wst = document.getElementById('wsStatusText');
          if (wst) wst.textContent = 'WebSocket: Connected';
        };
        ws.onclose = () => {
          document.getElementById('wsStatus')?.classList.add('disconnected');
          const wst2 = document.getElementById('wsStatusText');
          if (wst2) wst2.textContent = 'WebSocket: Disconnected';
          setTimeout(connectWebSocket, 5000);
        };
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'job_update' && data.jobId === currentJobId) {
              updateJobStatus(data);
            }
          } catch (e) {}
        };
        ws.onerror = () => {
          document.getElementById('wsStatus')?.classList.add('disconnected');
        };
      } catch (e) {}
    }

    async function loadAgents() {
      try {
        const res = await fetch(`${BASE_URL}/api/store`);
        const data = await res.json();
        agents = data.agents || [];
        const ac = document.getElementById('agentCount');
        if (ac) ac.textContent = `Agents: ${agents.length}`;
        const acd = document.getElementById('agentCountDisplay');
        if (acd) acd.textContent = agents.length;
        renderCategoryFilter();
        renderAgentList();
      } catch (e) {
        console.error('Failed to load agents:', e);
      }
    }

    function renderCategoryFilter() {
      const categories = [...new Set(agents.map(a => a.category))].sort();
      const container = document.getElementById('categoryFilter');
      container.innerHTML = `
        <button class="filter-btn active" data-action="filterByCategory" data-param="all">All</button>
        ${categories.map(cat => `
          <button class="filter-btn" data-action="filterByCategory" data-param="${cat}">${cat}</button>
        `).join('')}
      `;
    }

    function filterByCategory(category) {
      activeCategory = category;
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      renderAgentList();
    }

    function renderAgentList() {
      const filtered = activeCategory === 'all' ? agents : agents.filter(a => a.category === activeCategory);
      const container = document.getElementById('agentListContainer');

      container.innerHTML = filtered.map(agent => `
        <div class="agent-item" data-id="${agent.id}" data-action="selectAgent" data-param="${agent.id}">
          <h4>${agent.name}</h4>
          <p>${(agent.description || '').slice(0, 50)}...</p>
          <div class="agent-meta">
            <span class="badge ${agent.isAsync ? 'async' : 'sync'}">${agent.isAsync ? 'Async' : 'Sync'}</span>
            <span class="badge available">Ready</span>
            <span class="badge">${agent.category}</span>
          </div>
        </div>
      `).join('');
    }

    function selectAgent(agentId) {
      selectedAgent = agents.find(a => a.id === agentId);
      if (!selectedAgent) return;

      document.querySelectorAll('.agent-item').forEach(el => el.classList.remove('selected'));
      document.querySelector(`.agent-item[data-id="${agentId}"]`)?.classList.add('selected');

      const san = document.getElementById('selectedAgentName');
      if (san) san.textContent = selectedAgent.name;
      const sad = document.getElementById('selectedAgentDesc');
      if (sad) sad.textContent = selectedAgent.description || '';

      uploadedImages = {};
      renderAgentForm(agentId);
    }

    function renderAgentForm(agentId) {
      const container = document.getElementById('agentFormContainer');
      const formConfig = agentForms[agentId];

      if (!formConfig) {
        container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 40px;">
          Form configuration not found for this agent. Using generic input.
        </p>
        <div class="form-group">
          <label>Input (JSON)</label>
          <textarea id="genericInput" rows="6" placeholder='{"key": "value"}'></textarea>
        </div>
        <button class="btn btn-primary" data-action="runGenericAgent" data-param="${agentId}">Run Agent</button>`;
        return;
      }

      const agent = selectedAgent;
      const costHtml = agent?.costEstimate ? `
        <div class="cost-estimate">
          Estimated Cost: <span>$${agent.costEstimate.minCost.toFixed(2)} - $${agent.costEstimate.maxCost.toFixed(2)} USD</span>
        </div>
      ` : '';

      const featuresHtml = agent?.features?.length ? `
        <div class="agent-features">
          ${agent.features.map(f => `<span class="feature-tag">${f}</span>`).join('')}
        </div>
      ` : '';

      container.innerHTML = `
        ${costHtml}
        ${featuresHtml}
        <form id="agentForm" data-onsubmit="runAgent">
          ${formConfig.fields.map(f => renderField(f)).join('')}
          <div class="btn-group">
            <button type="submit" class="btn btn-primary">
              ${agent?.isAsync ? 'Create Job' : 'Run Agent'}
            </button>
            <button type="button" class="btn btn-secondary" data-action="resetForm">Reset</button>
          </div>
        </form>
        <div class="result-section" id="resultSection" style="display: none;">
          <div class="result-header">
            <h3>Result</h3>
            <div class="result-status" id="resultStatus"></div>
          </div>
          <div class="job-progress" id="jobProgress" style="display: none;">
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill" style="width: 0%"></div>
            </div>
            <p style="margin-top: 8px; font-size: 0.85rem; color: var(--text-secondary);" id="progressText">Processing...</p>
          </div>
          <div class="output-preview" id="outputPreview"></div>
          <div class="result-box" id="resultBox"></div>
        </div>
      `;

      // Set default values
      formConfig.fields.forEach(f => {
        if (f.default !== undefined) {
          const el = document.querySelector(`[name="${f.name}"]`);
          if (el) {
            if (f.type === 'checkbox') {
              el.checked = f.default;
            } else if (f.type === 'slider') {
              el.value = f.default;
              const display = el.parentNode.querySelector('.slider-value');
              if (display) display.textContent = f.default;
            } else {
              el.value = f.default;
            }
          }
        }
      });
    }

    function renderField(field) {
      const required = field.required ? '<span class="required">*</span>' : '';
      const hint = field.hint ? `<div class="hint">${field.hint}</div>` : '';

      switch (field.type) {
        case 'image':
          return `
            <div class="form-group">
              <label>${field.label} ${required}</label>
              <div class="image-upload-area" id="upload-${field.name}" data-click-target="file-${field.name}">
                <input type="file" id="file-${field.name}" name="${field.name}" accept="image/*" data-onchange="handleImageUpload" data-param="${field.name}" style="display:none">
                <div id="preview-${field.name}">
                  <div class="upload-icon">📷</div>
                  <div class="upload-text">Click or drag image here</div>
                  <div class="upload-hint">PNG, JPG, WebP (max 10MB)</div>
                </div>
              </div>
              ${hint}
            </div>
          `;

        case 'video':
          return `
            <div class="form-group">
              <label>${field.label} ${required}</label>
              <div class="image-upload-area" id="upload-${field.name}" data-click-target="file-${field.name}">
                <input type="file" id="file-${field.name}" name="${field.name}" accept="video/*" data-onchange="handleVideoUpload" data-param="${field.name}" style="display:none">
                <div id="preview-${field.name}">
                  <div class="upload-icon">🎬</div>
                  <div class="upload-text">Click or drag video here</div>
                  <div class="upload-hint">MP4, WebM, MOV (max 100MB)</div>
                </div>
              </div>
              ${hint}
            </div>
          `;

        case 'audio':
          return `
            <div class="form-group">
              <label>${field.label} ${required}</label>
              <div class="image-upload-area" id="upload-${field.name}" data-click-target="file-${field.name}">
                <input type="file" id="file-${field.name}" name="${field.name}" accept="audio/*" data-onchange="handleAudioUpload" data-param="${field.name}" style="display:none">
                <div id="preview-${field.name}">
                  <div class="upload-icon">🎵</div>
                  <div class="upload-text">Click or drag audio here</div>
                  <div class="upload-hint">MP3, WAV, M4A (max 50MB)</div>
                </div>
              </div>
              ${hint}
            </div>
          `;

        case 'textarea':
          return `
            <div class="form-group">
              <label>${field.label} ${required}</label>
              <textarea name="${field.name}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} rows="${field.rows || 4}"></textarea>
              ${hint}
            </div>
          `;

        case 'select':
          return `
            <div class="form-group">
              <label>${field.label} ${required}</label>
              <select name="${field.name}" ${field.required ? 'required' : ''}>
                ${field.options.map(o => `<option value="${o}">${o}</option>`).join('')}
              </select>
              ${hint}
            </div>
          `;

        case 'checkbox':
          return `
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                <input type="checkbox" name="${field.name}" style="width: auto;" ${field.required ? 'required' : ''}>
                ${field.label}
              </label>
              ${hint}
            </div>
          `;

        case 'slider':
          return `
            <div class="form-group">
              <label>${field.label}</label>
              <div class="slider-container">
                <input type="range" name="${field.name}" min="${field.min}" max="${field.max}" value="${field.default || 50}"
                  class="sync-slider-value">
                <span class="slider-value">${field.default || 50}</span>
              </div>
              ${hint}
            </div>
          `;

        default:
          return `
            <div class="form-group">
              <label>${field.label} ${required}</label>
              <input type="${field.type || 'text'}" name="${field.name}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>
              ${hint}
            </div>
          `;
      }
    }

    function handleImageUpload(input, fieldName) {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        uploadedImages[fieldName] = e.target.result;
        const preview = document.getElementById(`preview-${fieldName}`);
        preview.innerHTML = `
          <div class="image-preview-container">
            <img src="${e.target.result}" class="image-preview" alt="Preview">
            <button type="button" class="remove-image" data-action="removeImage" data-param="${fieldName}">×</button>
          </div>
        `;
        document.getElementById(`upload-${fieldName}`)?.classList.add('has-image');
      };
      reader.readAsDataURL(file);
    }

    function handleVideoUpload(input, fieldName) {
      const file = input.files[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      uploadedImages[fieldName] = { type: 'video', file: file, url: url };
      const preview = document.getElementById(`preview-${fieldName}`);
      preview.innerHTML = `
        <div class="image-preview-container">
          <video src="${url}" class="image-preview" style="max-height: 150px;" controls></video>
          <button type="button" class="remove-image" data-action="removeImage" data-param="${fieldName}">×</button>
        </div>
      `;
      document.getElementById(`upload-${fieldName}`)?.classList.add('has-image');
    }

    function handleAudioUpload(input, fieldName) {
      const file = input.files[0];
      if (!file) return;

      const url = URL.createObjectURL(file);
      uploadedImages[fieldName] = { type: 'audio', file: file, url: url };
      const preview = document.getElementById(`preview-${fieldName}`);
      preview.innerHTML = `
        <div class="image-preview-container">
          <audio src="${url}" controls style="width: 100%;"></audio>
          <button type="button" class="remove-image" data-action="removeImage" data-param="${fieldName}" style="top: -8px; right: -8px;">×</button>
        </div>
      `;
      document.getElementById(`upload-${fieldName}`)?.classList.add('has-image');
    }

    function removeImage(fieldName, event) {
      event.stopPropagation();
      delete uploadedImages[fieldName];
      const preview = document.getElementById(`preview-${fieldName}`);
      const uploadArea = document.getElementById(`upload-${fieldName}`);

      const fieldConfig = agentForms[selectedAgent?.id]?.fields.find(f => f.name === fieldName);
      const icon = fieldConfig?.type === 'video' ? '🎬' : fieldConfig?.type === 'audio' ? '🎵' : '📷';
      const fileType = fieldConfig?.type === 'video' ? 'video' : fieldConfig?.type === 'audio' ? 'audio' : 'image';

      preview.innerHTML = `
        <div class="upload-icon">${icon}</div>
        <div class="upload-text">Click or drag ${fileType} here</div>
      `;
      uploadArea.classList.remove('has-image');
      const fileEl = document.getElementById(`file-${fieldName}`);
      if (fileEl) fileEl.value = '';
    }

    async function runAgent(event) {
      event.preventDefault();
      if (!selectedAgent) return;

      const form = event.target;
      const formData = new FormData(form);
      const input = {};

      // Collect form data
      for (let [key, value] of formData.entries()) {
        const el = form.querySelector(`[name="${key}"]`);
        if (el?.type === 'checkbox') {
          input[key] = el.checked;
        } else if (el?.type === 'file') {
          // Handle file uploads
          if (uploadedImages[key]) {
            if (typeof uploadedImages[key] === 'string') {
              input[key] = uploadedImages[key]; // Base64 for images
            } else {
              input[key + 'Url'] = 'file-uploaded'; // Placeholder for video/audio
            }
          }
        } else if (value) {
          input[key] = value;
        }
      }

      // Add uploaded images
      Object.keys(uploadedImages).forEach(key => {
        if (typeof uploadedImages[key] === 'string') {
          input[key] = uploadedImages[key];
        }
      });

      const rs = document.getElementById('resultSection');
      if (rs) rs.style.display = 'block';
      const rst = document.getElementById('resultStatus');
      if (rst) rst.innerHTML = '<span class="result-status pending">Submitting...</span>';
      const rb = document.getElementById('resultBox');
      if (rb) rb.textContent = 'Processing...';
      const op = document.getElementById('outputPreview');
      if (op) op.innerHTML = '';

      try {
        const res = await fetch(`${BASE_URL}/api/store/${selectedAgent.id}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input })
        });

        const data = await res.json();

        if (res.status === 202 || data.jobId) {
          currentJobId = data.jobId;
          const rstJ = document.getElementById('resultStatus');
          if (rstJ) rstJ.innerHTML = '<span class="result-status processing">Job Created</span>';
          const jpJ = document.getElementById('jobProgress');
          if (jpJ) jpJ.style.display = 'block';
          const rbJ = document.getElementById('resultBox');
          if (rbJ) rbJ.textContent = JSON.stringify(data, null, 2);
          pollJobStatus(data.jobId);
        } else if (res.ok) {
          const rstOk = document.getElementById('resultStatus');
          if (rstOk) rstOk.innerHTML = '<span class="result-status completed">Completed</span>';
          displayResult(data);
        } else {
          throw new Error(data.error?.message || data.error || 'Request failed');
        }
      } catch (e) {
        const rstE = document.getElementById('resultStatus');
        if (rstE) rstE.innerHTML = '<span class="result-status failed">Failed</span>';
        const rbE = document.getElementById('resultBox');
        if (rbE) rbE.textContent = `Error: ${e.message}`;
      }
    }

    function displayResult(data) {
      const preview = document.getElementById('outputPreview');
      const resultBox = document.getElementById('resultBox');
      const output = data.output || {};

      // Helper to extract image URLs from output
      function getImageUrls(obj) {
        const urls = [];
        if (Array.isArray(obj.images)) urls.push(...obj.images);
        if (obj.resultImage) urls.push(obj.resultImage);
        if (obj.upscaledImage) urls.push(obj.upscaledImage);
        if (obj.enhancedImage) urls.push(obj.enhancedImage);
        if (obj.stylizedImage) urls.push(obj.stylizedImage);
        if (obj.generatedImage) urls.push(obj.generatedImage);
        if (obj.sceneImage) urls.push(obj.sceneImage);
        if (obj.productImage) urls.push(obj.productImage);
        if (obj.subjectWithTransparentBg) urls.push(obj.subjectWithTransparentBg);
        if (obj.generatedBackground) urls.push(obj.generatedBackground);
        if (obj.productWithTransparentBg) urls.push(obj.productWithTransparentBg);
        if (Array.isArray(obj.characterImages)) urls.push(...obj.characterImages);
        if (obj.imageUrl) urls.push(obj.imageUrl);
        // Support array-based outputs (mockups, thumbnails, creatives, packshots)
        if (Array.isArray(obj.mockups)) urls.push(...obj.mockups.map(m => m.imageUrl).filter(Boolean));
        if (Array.isArray(obj.thumbnails)) urls.push(...obj.thumbnails.map(t => t.url || t.imageUrl).filter(Boolean));
        if (Array.isArray(obj.creatives)) urls.push(...obj.creatives.map(c => c.imageUrl).filter(Boolean));
        if (Array.isArray(obj.packshots)) urls.push(...obj.packshots.map(p => p.imageUrl).filter(Boolean));
        if (Array.isArray(obj.variations)) urls.push(...obj.variations.map(v => v.imageUrl || v.url).filter(Boolean));
        if (Array.isArray(obj.results)) urls.push(...obj.results.map(r => r.imageUrl || r.url).filter(Boolean));
        return urls.filter(url => url && typeof url === 'string' && url.startsWith('http'));
      }

      // Helper to get video/audio URLs
      function getVideoUrl(obj) {
        return obj.video || obj.videoUrl || obj.syncedVideo || null;
      }
      function getAudioUrl(obj) {
        return obj.audioUrl || obj.audio || null;
      }

      // Display images
      const imageUrls = getImageUrls(output);
      if (imageUrls.length > 0) {
        preview.innerHTML = imageUrls.map(url =>
          `<img src="${url}" alt="Generated Image" style="max-width: 100%; margin: 5px 0; border-radius: 8px;">`
        ).join('');
        preview.style.display = 'block';
      }
      // Display video
      else if (getVideoUrl(output)) {
        preview.innerHTML = `<video src="${getVideoUrl(output)}" controls style="max-width: 100%; border-radius: 8px;"></video>`;
        preview.style.display = 'block';
      }
      // Display audio
      else if (getAudioUrl(output)) {
        preview.innerHTML = `<audio src="${getAudioUrl(output)}" controls style="width: 100%;"></audio>`;
        preview.style.display = 'block';
      }
      else {
        preview.style.display = 'none';
      }

      // Show JSON output
      resultBox.textContent = JSON.stringify(data, null, 2);
    }

    async function pollJobStatus(jobId) {
      try {
        const res = await fetch(`${BASE_URL}/jobs/${jobId}`);
        const job = await res.json();

        const progress = job.progress || 0;
        const pf = document.getElementById('progressFill');
        if (pf) pf.style.width = `${progress}%`;
        const pt = document.getElementById('progressText');
        if (pt) pt.textContent = `${job.status} - ${progress}%`;

        if (job.status === 'completed') {
          const rstC = document.getElementById('resultStatus');
          if (rstC) rstC.innerHTML = '<span class="result-status completed">Completed</span>';
          const jpC = document.getElementById('jobProgress');
          if (jpC) jpC.style.display = 'none';
          displayResult(job);
        } else if (job.status === 'failed') {
          const rstF = document.getElementById('resultStatus');
          if (rstF) rstF.innerHTML = '<span class="result-status failed">Failed</span>';
          const rbF = document.getElementById('resultBox');
          if (rbF) rbF.textContent = JSON.stringify(job, null, 2);
          const jpF = document.getElementById('jobProgress');
          if (jpF) jpF.style.display = 'none';
        } else {
          setTimeout(() => pollJobStatus(jobId), 2000);
        }
      } catch (e) {
        setTimeout(() => pollJobStatus(jobId), 5000);
      }
    }

    function resetForm() {
      document.getElementById('agentForm')?.reset();
      const rsR = document.getElementById('resultSection');
      if (rsR) rsR.style.display = 'none';
      uploadedImages = {};

      // Reset image previews
      document.querySelectorAll('.image-upload-area').forEach(area => {
        area.classList.remove('has-image');
      });

      if (selectedAgent) {
        renderAgentForm(selectedAgent.id);
      }
    }

    async function runGenericAgent(agentId) {
      const input = document.getElementById('genericInput')?.value || '{}';
      try {
        const parsed = JSON.parse(input);
        selectedAgent = { id: agentId };

        document.getElementById('resultSection')?.remove();
        const container = document.getElementById('agentFormContainer');
        container.innerHTML += `
          <div class="result-section" id="resultSection">
            <div class="result-header">
              <h3>Result</h3>
              <div class="result-status processing" id="resultStatus">Processing...</div>
            </div>
            <div class="result-box" id="resultBox">Loading...</div>
          </div>
        `;

        const res = await fetch(`${BASE_URL}/api/store/${agentId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: parsed })
        });
        const data = await res.json();
        const rstG = document.getElementById('resultStatus');
        if (rstG) rstG.innerHTML = res.ok ?
          '<span class="result-status completed">Completed</span>' :
          '<span class="result-status failed">Failed</span>';
        const rbG = document.getElementById('resultBox');
        if (rbG) rbG.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        alert('Invalid JSON: ' + e.message);
      }
    }

    function updateJobStatus(data) {
      if (data.status === 'completed') {
        const rstU = document.getElementById('resultStatus');
        if (rstU) rstU.innerHTML = '<span class="result-status completed">Completed</span>';
        const jpU = document.getElementById('jobProgress');
        if (jpU) jpU.style.display = 'none';
        displayResult(data);
      } else if (data.status === 'failed') {
        const rstUF = document.getElementById('resultStatus');
        if (rstUF) rstUF.innerHTML = '<span class="result-status failed">Failed</span>';
        const jpUF = document.getElementById('jobProgress');
        if (jpUF) jpUF.style.display = 'none';
      } else if (data.progress !== undefined) {
        const pfU = document.getElementById('progressFill');
        if (pfU) pfU.style.width = `${data.progress}%`;
        const ptU = document.getElementById('progressText');
        if (ptU) ptU.textContent = `${data.status} - ${data.progress}%`;
      }
    }