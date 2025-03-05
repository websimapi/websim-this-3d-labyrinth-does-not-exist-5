const { useState, useEffect, useRef } = React;

const App = () => {
    const [showForm, setShowForm] = useState(true);
    const [roomReady, setRoomReady] = useState(false);
    const [room, setRoom] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [labyrinths, setLabyrinths] = useState([]);
    const [currentLabyrinth, setCurrentLabyrinth] = useState(null);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        theme: '',
        difficulty: 'medium',
        biome: '',
        mood: '',
    });
    const [showDescription, setShowDescription] = useState(false);
    const musicRef = useRef(null);
    const musicPlayedRef = useRef(false);

    useEffect(() => {
        const initRoom = async () => {
            const newRoom = new WebsimSocket();
            setRoom(newRoom);
            
            newRoom.onmessage = (event) => {
                const data = event.data;
                if (data.type === 'connected') {
                    console.log(`Client ${data.clientId} connected`);
                    setRoomReady(true);
                }
                else if (data.type === 'labyrinthEntered') {
                    playBackgroundMusic();
                }
            };
        };
        
        initRoom();
        musicRef.current = document.getElementById('backgroundMusic');
    }, []);

    useEffect(() => {
        if (room && roomReady) {
            // Load labyrinths from the database
            loadLabyrinths();
            
            // Subscribe to labyrinth collection
            const unsubscribe = room.collection('labyrinth').subscribe((updatedLabyrinths) => {
                setLabyrinths(updatedLabyrinths);
            });
            
            return () => unsubscribe();
        }
    }, [room, roomReady]);

    const loadLabyrinths = async () => {
        if (room) {
            const loadedLabyrinths = room.collection('labyrinth').getList();
            setLabyrinths(loadedLabyrinths);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const generateLabyrinth = async (e) => {
        e.preventDefault();
        if (!room) return;
        
        setIsGenerating(true);
        setError('');
        
        try {
            // Step 1: Generate the description using LLM
            const descriptionCompletion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `You are an expert labyrinth description generator. Create an evocative, detailed description 
                        of a mysterious, immersive labyrinth based on the provided parameters. The description should be 
                        atmospheric and include details about paths, walls, features, and overall feeling. Mention specific 
                        architectural elements, materials, lighting, sounds, and any unique aspects. Keep it between 100-200 words.`
                    },
                    {
                        role: "user",
                        content: `Generate a labyrinth description with these parameters:
                        Theme: ${formData.theme}
                        Difficulty: ${formData.difficulty}
                        Biome: ${formData.biome}
                        Mood: ${formData.mood}`
                    }
                ]
            });
            
            const description = descriptionCompletion.content;
            
            // Step 2: Generate an image based on the description
            const imagePrompt = `A detailed aerial view of a labyrinth: ${description}. 3D rendered, intricate maze design, atmospheric lighting, detailed textures, cinematic quality`;
            const imageResult = await websim.imageGen({
                prompt: imagePrompt,
                aspect_ratio: "1:1",
            });
            
            // Step 3: Generate a wall texture pattern for the biome
            const textureCompletion = await websim.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content: `Create a detailed SVG pattern that would serve as a suitable wall texture for a labyrinth 
                        in the described biome. Provide only the SVG code with no explanation. The SVG should be a seamless 
                        pattern that could be used as a texture on 3D walls. Include appropriate colors and designs that match 
                        the biome. The SVG should be 200x200 pixels with a viewBox of 0 0 100 100.`
                    },
                    {
                        role: "user",
                        content: `Create a wall texture SVG pattern for a labyrinth in a ${formData.biome} biome with a ${formData.mood} mood.`
                    }
                ]
            });
            
            // Extract SVG code from the completion
            const svgCode = textureCompletion.content.replace(/```svg|```/g, '').trim();
            const svgDataUrl = `data:image/svg+xml;base64,${btoa(svgCode)}`;
            
            // Step 4: Store in the database
            const newLabyrinth = await room.collection('labyrinth').create({
                title: formData.theme || 'Mysterious Labyrinth',
                description: description,
                imageUrl: imageResult.url,
                wallTexture: svgDataUrl,
                difficulty: formData.difficulty,
                biome: formData.biome,
                mood: formData.mood,
                createdAt: new Date().toISOString()
            });
            
            setCurrentLabyrinth(newLabyrinth);
            loadLabyrinths();
            
            // Broadcast an event to all players that a new labyrinth was created
            room.send({
                type: 'newLabyrinthCreated',
                id: newLabyrinth.id,
                title: newLabyrinth.title
            });
            
            // Generate the labyrinth in 3D
            window.generateLabyrinth(newLabyrinth);
            
            // Play background music
            playBackgroundMusic();
            
        } catch (err) {
            console.error('Error generating labyrinth:', err);
            setError('Failed to generate labyrinth. Please try again.');
        } finally {
            setIsGenerating(false);
            setShowForm(false);
        }
    };

    const selectLabyrinth = (labyrinth) => {
        setCurrentLabyrinth(labyrinth);
        window.generateLabyrinth(labyrinth);
        room.send({
            type: 'labyrinthEntered',
            id: labyrinth.id,
            username: room.party.client.username
        });
        playBackgroundMusic();
    };

    const playBackgroundMusic = () => {
        if (musicRef.current && !musicPlayedRef.current) {
            musicRef.current.play().catch(e => console.log('Music autoplay prevented:', e));
            musicPlayedRef.current = true;
        }
    };

    const toggleFormVisibility = () => {
        setShowForm(!showForm);
    };

    return (
        <div>
            <div className="ui-container">
                <div className="toggle-panel" onClick={toggleFormVisibility}>
                    <svg viewBox="0 0 24 24">
                        <path d={showForm ? "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" : "M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"} />
                    </svg>
                </div>
                
                <div className="form-panel" style={{ transform: showForm ? 'translateX(0)' : 'translateX(-350px)' }}>
                    <h2>Generate Labyrinth</h2>
                    <form onSubmit={generateLabyrinth}>
                        <div className="form-group">
                            <label htmlFor="theme">Theme/Name:</label>
                            <input 
                                type="text" 
                                id="theme" 
                                name="theme" 
                                value={formData.theme}
                                onChange={handleInputChange}
                                placeholder="Ancient Greek, Cyberpunk, etc."
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="difficulty">Difficulty:</label>
                            <select 
                                id="difficulty" 
                                name="difficulty" 
                                value={formData.difficulty}
                                onChange={handleInputChange}
                            >
                                <option value="easy">Easy</option>
                                <option value="medium">Medium</option>
                                <option value="hard">Hard</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="biome">Biome:</label>
                            <input 
                                type="text" 
                                id="biome" 
                                name="biome" 
                                value={formData.biome}
                                onChange={handleInputChange}
                                placeholder="Desert, Jungle, Arctic, etc."
                            />
                        </div>
                        
                        <div className="form-group">
                            <label htmlFor="mood">Mood/Atmosphere:</label>
                            <input 
                                type="text" 
                                id="mood" 
                                name="mood" 
                                value={formData.mood}
                                onChange={handleInputChange}
                                placeholder="Eerie, Magical, Tense, etc."
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            className="generate-btn"
                            disabled={isGenerating}
                        >
                            {isGenerating ? 'Generating...' : 'Generate Labyrinth'}
                        </button>
                        
                        {error && <p className="error-msg">{error}</p>}
                    </form>
                </div>
                
                <div className="labyrinth-description" style={{ display: currentLabyrinth ? 'block' : 'none' }} className={`labyrinth-description ${showDescription ? 'visible' : ''}`}>
                    <h3>{currentLabyrinth?.title}</h3>
                    <p>{currentLabyrinth?.description}</p>
                </div>
                
                <div className="gallery-panel">
                    <h3>Labyrinth Gallery</h3>
                    <div className="gallery-items">
                        {labyrinths.map(lab => (
                            <div 
                                key={lab.id} 
                                className="gallery-item" 
                                onClick={() => selectLabyrinth(lab)}
                            >
                                <img src={lab.imageUrl} alt={lab.title} />
                                <div className="gallery-item-title">{lab.title}</div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div className="mobile-controls">
                    <div id="moveJoystick" className="joystick">
                        <div className="joystick-handle"></div>
                    </div>
                    <div id="lookJoystick" className="joystick">
                        <div className="joystick-handle"></div>
                    </div>
                </div>
            </div>
            
            {isGenerating && (
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>Generating your labyrinth...</p>
                    <p>This may take a moment</p>
                </div>
            )}
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));

