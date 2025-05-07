 # Rails of 1914 - Development Documentation

## Project Overview

Rails of 1914 is a turn-based strategy game set during World War I, where players engage in city building, railway construction, and military transportation to achieve victory in conflict zones.

## Technical Architecture

### Technology Stack
- **Backend**: Python 3.8+
- **Web Framework**: Flask
- **Frontend**: HTML5, CSS3, JavaScript
- **Map Rendering**: SVG/Canvas for hexagonal grid
- **Data Storage**: JSON-based state management

### Project Structure
```
rails-of-1914/
├── app.py             # Flask application entry point
├── routes.py          # API routes and endpoints
├── game/              # Core game logic
│   ├── __init__.py    
│   ├── models.py      # Game models (cities, railways, etc.)
│   ├── controller.py  # Game controller
│   └── map_generator.py # Map generation logic
├── static/            # Static resources
├── templates/         # HTML templates
└── docs/              # Documentation
```

## Core Components

### 1. Game State Management
- Implemented in `app.py`
- Uses JSON-based state persistence
- Key features:
  - Round tracking
  - Phase management
  - Player state
  - Region control
  - War status

### 2. Game Controller (`game/controller.py`)
- Central game logic management
- Handles:
  - Turn processing
  - Action validation
  - State updates
  - Player interactions

### 3. Game Models (`game/models.py`)
- Defines core game entities:
  - Regions
  - Cities
  - Railways
  - Military units
  - Resources

### 4. Map System (`game/map_generator.py`)
- Hexagonal grid-based map
- Region generation
- Territory control
- Resource distribution

## API Endpoints

### Game State
- `GET /api/game-state`: Retrieve current game state
- `GET /api/map-data`: Get map rendering data
- `POST /api/next-round`: Advance to next round
- `POST /api/reset-game`: Reset game state

### Game Actions
- `POST /api/build-town`: Construct new city
- `POST /api/build-railway`: Build railway connection
- `POST /api/mobilize-troops`: Deploy military units
- `POST /api/declare-war`: Initiate conflict
- `POST /api/upgrade-town`: Upgrade city facilities

## Game Mechanics

### 1. Turn Structure
- Protection Phase
- Building Phase
- Military Phase
- Resource Collection

### 2. Resource Management
- GDP
- Population
- Military strength
- Infrastructure

### 3. Victory Conditions
- Territorial control
- Economic dominance
- Military victory

## Development Guidelines

### Setup
1. Clone repository
2. Create virtual environment
3. Install dependencies: `pip install -r requirements.txt`
4. Run development server: `python app.py`

### Code Style
- Follow PEP 8 guidelines
- Use type hints
- Document all functions and classes
- Write unit tests for new features

### Deployment
- Supports multiple deployment platforms:
  - Heroku
  - Render
  - Vercel
  - Traditional VPS

## Future Development

### Planned Features
1. Enhanced AI opponents
2. Multiplayer support
3. Additional scenarios
4. Historical events system
5. Advanced diplomacy mechanics

### Known Issues
- Document any known bugs or limitations
- Track in issue management system

## Contributing

### Development Process
1. Fork repository
2. Create feature branch
3. Implement changes
4. Submit pull request
5. Code review
6. Merge to main branch

### Testing
- Unit tests for core logic
- Integration tests for API endpoints
- UI/UX testing
- Performance testing

## License
MIT License - See LICENSE file for details